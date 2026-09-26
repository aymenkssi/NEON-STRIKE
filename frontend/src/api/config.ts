// Remote configuration edited from the admin page: shop packs, weapon prices and messages.
// The last config received is cached so the shop keeps the admin's packs when offline.
import { storage } from "@/src/utils/storage";
import { backendConfigured, get } from "./client";

export type RemotePack = { sku: string; credits: number; bonus: string | null; tag: string | null; tag_en?: string | null; sort: number };
// title_en / body_en: optional English version written in the admin page.
export type RemoteMessage = {
  id: string;
  title: string;
  body: string;
  title_en?: string | null;
  body_en?: string | null;
  kind: "info" | "promo" | "warning";
};
export type RemoteWeaponPrice = { key: string; price: number; on_sale: boolean };
export type RemoteConfig = { packs: RemotePack[]; messages: RemoteMessage[]; weapons?: RemoteWeaponPrice[] };

const CACHE_KEY = "np_remote_config";

export async function loadCachedConfig(): Promise<RemoteConfig | null> {
  const raw = await storage.getItem(CACHE_KEY, null as string | null);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchRemoteConfig(): Promise<RemoteConfig | null> {
  if (!backendConfigured) return null;
  try {
    const cfg = await get<RemoteConfig>("/config");
    if (!Array.isArray(cfg?.packs) || !Array.isArray(cfg?.messages)) return null;
    // Messages are time-limited: cache only the packs and weapon prices.
    await storage.setItem(CACHE_KEY, JSON.stringify({ packs: cfg.packs, messages: [], weapons: cfg.weapons ?? [] }));
    return cfg;
  } catch {
    return null;
  }
}
