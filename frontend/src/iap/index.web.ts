// Web preview: Google Play Billing does not exist in the browser. The shop still renders
// (with suggested prices) but purchases are disabled.
import type { PurchaseOutcome, StoreStatus } from "./types";
import { t } from "@/src/i18n";

export function getStoreStatus(): StoreStatus {
  return "unavailable";
}
export function onStoreChange(_fn: () => void) {
  return () => {};
}
export function getLocalizedPrice(_sku: string): string | null {
  return null;
}
export async function initStore(_onGrant: (credits: number, sku: string) => void) {}
export async function buyPack(_sku: string): Promise<PurchaseOutcome> {
  return { kind: "error", message: t("iap.webOnly") };
}
export async function retryUnfinishedPurchases() {}
