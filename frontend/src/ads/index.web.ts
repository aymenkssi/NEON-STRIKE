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
