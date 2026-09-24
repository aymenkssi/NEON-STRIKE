import { ApiError, authed, backendConfigured } from "./client";

// "skipped": no backend configured (local development) — the purchase is trusted as is.
// "unreachable": server or Google Play down — retry later, never grant yet.
export type VerifyStatus = "valid" | "pending" | "invalid" | "unreachable" | "skipped";
// credits: amount decided by the server for a valid purchase (admin-configured).
export type VerifyResult = { status: VerifyStatus; credits?: number };

// price / currency: what Google Play showed the player (admin statistics only).
export async function verifyPurchaseOnServer(
  productId: string,
  purchaseToken: string,
  paid?: { price: number; currency: string } | null
): Promise<VerifyResult> {
  if (!backendConfigured) return { status: "skipped" };
  try {
    const res = await authed<{ status: "valid" | "pending" | "invalid"; credits: number }>("/purchases/verify", {
      method: "POST",
      body: JSON.stringify({
        product_id: productId,
        purchase_token: purchaseToken,
        ...(paid ? { price: paid.price, currency: paid.currency } : {}),
      }),
    });
    return { status: res.status, credits: res.credits };
  } catch (e) {
    // 422 = unknown product for the server: treat as invalid. Anything else: try again later.
    if (e instanceof ApiError && e.status === 422) return { status: "invalid" };
    return { status: "unreachable" };
  }
}
