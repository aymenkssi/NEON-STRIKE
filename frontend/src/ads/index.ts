// Safe AdMob wrapper. Native ads only work in a development/production build,
// NOT in Expo Go or web. We detect that and no-op gracefully so the game keeps
// running everywhere, while real ads light up in a native build.
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

export const adsSupported =
  Platform.OS !== "web" &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// Lazily require the native module only when supported.
let mod: any = null;
if (adsSupported) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("react-native-google-mobile-ads");
  } catch {
    mod = null;
  }
}

export const AdMob = mod;

// Real ads are served only when EXPO_PUBLIC_AD_MODE=production (set by the EAS "production"
// profile). Every other build uses Google's test IDs: clicking your own live ads can get the
// AdMob account suspended.
const production = process.env.EXPO_PUBLIC_AD_MODE === "production";

// NEON STRIKE (Android) ad units — ca-app-pub-7488746561313974. Env vars can override them.
const PROD_AD_UNITS = {
  banner: process.env.EXPO_PUBLIC_BANNER_AD_UNIT || "ca-app-pub-7488746561313974/5771431884",
  interstitial: process.env.EXPO_PUBLIC_INTERSTITIAL_AD_UNIT || "ca-app-pub-7488746561313974/3145268547",
  rewarded: process.env.EXPO_PUBLIC_REWARDED_AD_UNIT || "ca-app-pub-7488746561313974/9864036785",
};

export const AD_IDS = {
  banner: production ? PROD_AD_UNITS.banner : mod?.TestIds?.BANNER,
  interstitial: production ? PROD_AD_UNITS.interstitial : mod?.TestIds?.INTERSTITIAL,
  rewarded: production ? PROD_AD_UNITS.rewarded : mod?.TestIds?.REWARDED,
};

// ---------------- Consent (GDPR / UMP) ----------------
// Ads may only be requested once Google's consent flow says so (canRequestAds). The consent
// message itself is configured in AdMob > Privacy & messaging.
let canRequestAds = false;
let privacyOptionsRequired = false;
const readyListeners = new Set<() => void>();

export function adsReady() {
  return canRequestAds;
}

// Subscribe to "ads can now be requested" (used by banners mounted before consent resolves).
export function onAdsReady(fn: () => void) {
  readyListeners.add(fn);
  return () => {
    readyListeners.delete(fn);
  };
}

export function isPrivacyOptionsRequired() {
  return privacyOptionsRequired;
}

// Lets the player change their consent later (required by Google when the status is REQUIRED).
export async function showPrivacyOptions() {
  if (!mod?.AdsConsent) return;
  try {
    const info = await mod.AdsConsent.showPrivacyOptionsForm();
    applyConsent(info);
    await startAds();
  } catch {}
}

function applyConsent(info: any) {
  canRequestAds = !!info?.canRequestAds;
  privacyOptionsRequired =
    info?.privacyOptionsRequirementStatus === mod?.AdsConsentPrivacyOptionsRequirementStatus?.REQUIRED;
}

let initStarted = false;

export async function initAds() {
  if (!mod?.default || initStarted) return;
  initStarted = true;
  try {
    // Updates consent info, then shows the consent form only if the user still has to answer it.
    applyConsent(await mod.AdsConsent.gatherConsent());
  } catch {
    // Offline or form unavailable: fall back to the consent collected in a previous session.
    try {
      applyConsent(await mod.AdsConsent.getConsentInfo());
    } catch {}
  }
  await startAds();
}

let sdkStarted = false;

// Starts the Mobile Ads SDK once consent allows it (at launch, or later from the privacy form).
async function startAds() {
  if (!canRequestAds || sdkStarted) return;
  sdkStarted = true;
  try {
    await mod.default().setRequestConfiguration({
      maxAdContentRating: mod.MaxAdContentRating?.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mod.default().initialize();
  } catch {}
  readyListeners.forEach((fn) => fn());
  preloadInterstitial();
}

// ---------------- Interstitial ----------------
// Shown at natural breaks (leaving a level-complete or game-over screen), once every
// INTERSTITIAL_EVERY breaks, and never right after the player watched a rewarded ad.
export const INTERSTITIAL_EVERY = 2;
const REWARDED_GRACE_MS = 60_000;
let interstitial: any = null;
let breaks = 0;
let lastRewardedAt = 0;

function preloadInterstitial() {
  if (!canRequestAds || !mod?.InterstitialAd || interstitial) return;
  try {
    const ad = mod.InterstitialAd.createForAdRequest(AD_IDS.interstitial);
    const offError = ad.addAdEventListener(mod.AdEventType.ERROR, () => {
      offError();
      if (interstitial === ad) interstitial = null;
    });
    interstitial = ad;
    ad.load();
  } catch {
    interstitial = null;
  }
}

// Call when the player leaves a break screen; onDone runs after the ad closes (or right away).
export function showInterstitialAtBreak(onDone: () => void) {
  breaks++;
  const due = breaks % INTERSTITIAL_EVERY === 0;
  const ad = interstitial;
  const justRewarded = Date.now() - lastRewardedAt < REWARDED_GRACE_MS;
  if (!due || justRewarded || !ad?.loaded) {
    if (due) breaks--; // not shown: keep it due for the next break
    preloadInterstitial();
    onDone();
    return;
  }
  interstitial = null;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    offClosed();
    offError();
    preloadInterstitial();
    onDone();
  };
  const offClosed = ad.addAdEventListener(mod.AdEventType.CLOSED, finish);
  const offError = ad.addAdEventListener(mod.AdEventType.ERROR, finish);
  Promise.resolve()
    .then(() => ad.show())
    .catch(finish);
}

// Show a rewarded ad. onReward fires when the reward is earned.
// In unsupported environments (Expo Go / web) we grant immediately so the
// "Revive" flow is fully testable during development.
export function showRewarded(onReward: () => void, onClose?: () => void) {
  if (!mod?.RewardedAd || !canRequestAds) {
    onReward();
    onClose?.();
    return;
  }
  try {
    const { RewardedAd, RewardedAdEventType, AdEventType } = mod;
    // No requestNonPersonalizedAdsOnly: the consent collected by UMP decides personalization.
    const ad = RewardedAd.createForAdRequest(AD_IDS.rewarded);
    let earned = false;
    const offLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      ad.show();
    });
    const offReward = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
      lastRewardedAt = Date.now();
      onReward();
    });
    const offClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      offLoaded();
      offReward();
      offClosed();
      offError();
      onClose?.();
    });
    const offError = ad.addAdEventListener(AdEventType.ERROR, () => {
      offLoaded();
      offReward();
      offClosed();
      offError();
      if (!earned) onReward(); // fail-open in dev so flow is testable
      onClose?.();
    });
    ad.load();
  } catch {
    onReward();
    onClose?.();
  }
}
