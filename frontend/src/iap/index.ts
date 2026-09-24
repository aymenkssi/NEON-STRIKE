// Coin purchases through Google Play Billing (expo-iap).
// Only works in a native Android build (dev client or store build) — not in Expo Go or on web,
// where the shop stays visible but purchases are disabled.
//
// Flow: buyPack() -> Play purchase sheet -> purchaseUpdatedListener -> backend verifies the
// token with Google Play -> credits granted -> finishTransaction(isConsumable) so the pack can
// be bought again. A purchase is never granted or consumed before the server says it is valid:
// unverified purchases stay unfinished and are retried (shop reopened, next launch). Google
// refunds purchases left unfinished for 3 days, so a rejected purchase costs the player nothing.
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { storage } from "@/src/utils/storage";
import { verifyPurchaseOnServer } from "@/src/api/purchases";
import { getPack, getPacks, onPacksChange } from "./catalog";
import type { PurchaseOutcome, StoreStatus } from "./types";

type ExpoIap = typeof import("expo-iap");
type Purchase = import("expo-iap").Purchase;

const supported =
  Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let iap: ExpoIap | null = null;
if (supported) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iap = require("expo-iap");
  } catch {
    iap = null;
  }
}

// Purchase tokens already credited: protects against double credits when Play replays a
// purchase whose finishTransaction did not go through.
const GRANTED_KEY = "np_iap_granted";

let status: StoreStatus = iap ? "connecting" : "unavailable";
const prices: Record<string, string> = {};
const listeners = new Set<() => void>();
let onGrant: ((credits: number, sku: string) => void) | null = null;
let granted: string[] = [];
let inFlight: { sku: string; resolve: (o: PurchaseOutcome) => void } | null = null;
let started = false;
const PURCHASE_TIMEOUT_MS = 5 * 60 * 1000;

function emit() {
  listeners.forEach((fn) => fn());
}

export function getStoreStatus() {
  return status;
}

export function onStoreChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getLocalizedPrice(sku: string): string | null {
  return prices[sku] ?? null;
}

function settle(outcome: PurchaseOutcome) {
  const current = inFlight;
  inFlight = null;
  current?.resolve(outcome);
}

async function handlePurchase(purchase: Purchase) {
  if (!iap) return;
  const sku = purchase.productId;
  const pack = getPack(sku);
  if (purchase.purchaseState === "pending") {
    // Paid later (e.g. cash at a store): Play sends the purchase again once it clears.
    if (inFlight?.sku === sku) settle({ kind: "pending", sku });
    return;
  }
  if (purchase.purchaseState !== "purchased") return;

  const token = purchase.purchaseToken || purchase.id;
  if (!granted.includes(token)) {
    const verdict = await verifyPurchaseOnServer(sku, token);
    if (verdict.status === "pending") {
      if (inFlight?.sku === sku) settle({ kind: "pending", sku });
      return;
    }
    if (verdict.status === "invalid") {
      if (inFlight?.sku === sku) settle({ kind: "error", message: "Achat non reconnu par Google Play." });
      return;
    }
    if (verdict.status === "unreachable") {
      if (inFlight?.sku === sku) {
        settle({
          kind: "error",
          message: "Paiement reçu, vérification en cours. Tes crédits seront ajoutés automatiquement.",
        });
      }
      return;
    }
    // The server decides the amount (admin page); the local catalog is only the offline fallback.
    const credits = verdict.credits ?? pack?.credits;
    if (!credits) return;
    onGrant?.(credits, sku);
    granted = [...granted, token].slice(-200);
    await storage.setItem(GRANTED_KEY, JSON.stringify(granted));
    if (inFlight?.sku === sku) settle({ kind: "granted", sku, credits });
  }
  try {
    // Consumes the purchase: without this Google refunds it after 3 days.
    await iap.finishTransaction({ purchase, isConsumable: true });
  } catch {
    // Retried at the next launch through getAvailablePurchases().
  }
}

// Call once at startup with the function that adds credits to the player's balance.
export async function initStore(grant: (credits: number, sku: string) => void) {
  onGrant = grant;
  if (!iap || started) return;
  started = true;
  const lib = iap;

  const raw = await storage.getItem(GRANTED_KEY, null as string | null);
  try {
    granted = typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    granted = [];
  }

  lib.purchaseUpdatedListener((p) => {
    handlePurchase(p);
  });
  lib.purchaseErrorListener((err) => {
    if (lib.isUserCancelledError(err)) settle({ kind: "cancelled" });
    else settle({ kind: "error", message: lib.getUserFriendlyErrorMessage(err) || err.message });
  });

  try {
    await lib.initConnection();
    status = "ready";
    await refreshProducts();
  } catch {
    status = "error";
    emit();
  }
  // Packs edited on the server may add product IDs: fetch their Play prices too.
  onPacksChange(() => {
    refreshProducts();
  });

  // Credit purchases left unfinished by a previous session.
  await retryUnfinishedPurchases();
}

// Loads Google Play prices for the packs currently shown in the shop.
async function refreshProducts() {
  if (!iap || status !== "ready") return;
  try {
    const products = await iap.fetchProducts({ skus: getPacks().map((p) => p.sku), type: "in-app" });
    for (const p of (products ?? []) as { id: string; displayPrice: string }[]) prices[p.id] = p.displayPrice;
  } catch {}
  emit();
}

// Re-processes purchases Google still holds (verification failed earlier, pending cash payments).
let retrying = false;
export async function retryUnfinishedPurchases() {
  if (!iap || status !== "ready" || retrying) return;
  retrying = true;
  try {
    const pending = await iap.getAvailablePurchases();
    for (const p of pending ?? []) await handlePurchase(p);
  } catch {
  } finally {
    retrying = false;
  }
}

export async function buyPack(sku: string): Promise<PurchaseOutcome> {
  if (!iap || status !== "ready") {
    return { kind: "error", message: "La boutique Google Play n’est pas disponible. Vérifie ta connexion." };
  }
  if (!prices[sku]) return { kind: "error", message: "Ce pack n’est pas encore disponible." };
  if (inFlight) return { kind: "error", message: "Un achat est déjà en cours." };
  const lib = iap;
  return new Promise<PurchaseOutcome>((resolve) => {
    inFlight = { sku, resolve };
    // Safety net: never leave the shop locked if Play sends no result at all.
    setTimeout(() => {
      if (inFlight?.resolve === resolve) {
        settle({ kind: "error", message: "Aucune réponse de Google Play. Si tu as payé, tes crédits arriveront automatiquement." });
      }
    }, PURCHASE_TIMEOUT_MS);
    Promise.resolve()
      .then(() => lib.requestPurchase({ request: { google: { skus: [sku] } }, type: "in-app" }))
      .catch((err) => {
        if (lib.isUserCancelledError(err)) settle({ kind: "cancelled" });
        else settle({ kind: "error", message: lib.getUserFriendlyErrorMessage(err) || String(err?.message ?? err) });
      });
  });
}
