import { ApiError, authed, backendConfigured } from "./client";

// "skipped": no backend configured (local development) — the purchase is trusted as is.
// "unreachable": server or Google Play down — retry later, never grant yet.
export type VerifyStatus = "valid" | "pending" | "invalid" | "unreachable" | "skipped";

export async function verifyPurchaseOnServer(productId: string, purchaseToken: string): Promise<VerifyStatus> {
  if (!backendConfigured) return "skipped";
  try {
    const res = await authed<{ status: "valid" | "pending" | "invalid" }>("/purchases/verify", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, purchase_token: purchaseToken }),
    });
    return res.status;
  } catch (e) {
    // 422 = unknown product for the server: treat as invalid. Anything else: try again later.
    if (e instanceof ApiError && e.status === 422) return "invalid";
    return "unreachable";
  }
}
