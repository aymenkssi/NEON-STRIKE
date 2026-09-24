// Web stub — AdMob native SDK cannot run on web. No-op everything so the
// bundle stays clean and layouts still render placeholders.
export const adsSupported = false;
export const AdMob: any = null;
export const AD_IDS = {
  banner: undefined as string | undefined,
  interstitial: undefined as string | undefined,
  rewarded: undefined as string | undefined,
};

export async function initAds() {}

export function showRewarded(onReward: () => void, onClose?: () => void) {
  onReward();
  onClose?.();
}

export function adsReady() {
  return false;
}
export function onAdsReady(_fn: () => void) {
  return () => {};
}
export function isPrivacyOptionsRequired() {
  return false;
}
export async function showPrivacyOptions() {}
export const INTERSTITIAL_EVERY = 2;
export function showInterstitialAtBreak(onDone: () => void) {
  onDone();
}
