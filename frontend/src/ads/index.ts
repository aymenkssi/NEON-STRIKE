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

const production = process.env.EXPO_PUBLIC_AD_MODE === "production";

export const AD_IDS = {
  banner:
    production && process.env.EXPO_PUBLIC_BANNER_AD_UNIT
      ? process.env.EXPO_PUBLIC_BANNER_AD_UNIT
      : mod?.TestIds?.BANNER,
  interstitial:
    production && process.env.EXPO_PUBLIC_INTERSTITIAL_AD_UNIT
      ? process.env.EXPO_PUBLIC_INTERSTITIAL_AD_UNIT
      : mod?.TestIds?.INTERSTITIAL,
  rewarded:
    production && process.env.EXPO_PUBLIC_REWARDED_AD_UNIT
      ? process.env.EXPO_PUBLIC_REWARDED_AD_UNIT
      : mod?.TestIds?.REWARDED,
};

export async function initAds() {
  if (!mod?.default) return;
  try {
    await mod
      .default()
      .setRequestConfiguration({
        maxAdContentRating: mod.MaxAdContentRating?.T,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
    await mod.default().initialize();
  } catch {}
}

// Show a rewarded ad. onReward fires when the reward is earned.
// In unsupported environments (Expo Go / web) we grant immediately so the
// "Revive" flow is fully testable during development.
export function showRewarded(onReward: () => void, onClose?: () => void) {
  if (!mod?.RewardedAd) {
    onReward();
    onClose?.();
    return;
  }
  try {
    const { RewardedAd, RewardedAdEventType, AdEventType } = mod;
    const ad = RewardedAd.createForAdRequest(AD_IDS.rewarded, {
      requestNonPersonalizedAdsOnly: true,
    });
    let earned = false;
    const offLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      ad.show();
    });
    const offReward = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
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
