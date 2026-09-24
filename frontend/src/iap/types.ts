// Shared contract between the native store (index.ts) and the web stub (index.web.ts).

export type StoreStatus = "unavailable" | "connecting" | "ready" | "error";

// A purchase the player has paid for and that must be credited.
export type GrantEvent = { sku: string; credits: number };

export type PurchaseOutcome =
  | { kind: "granted"; sku: string; credits: number }
  | { kind: "pending"; sku: string } // e.g. cash payment still processing
  | { kind: "cancelled" }
  | { kind: "error"; message: string };
