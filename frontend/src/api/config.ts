// Remote configuration edited from the admin page: shop packs and messages to players.
// The last config received is cached so the shop keeps the admin's packs when offline.
import { storage } from "@/src/utils/storage";
import { backendConfigured, get } from "./client";

export type RemotePack = { sku: string; credits: number; bonus: string | null; tag: string | null; sort: number };
export type RemoteMessage = { id: string; title: string; body: string; kind: "info" | "promo" | "warning" };
export type RemoteConfig = { packs: RemotePack[]; messages: RemoteMessage[] };

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
    // Messages are time-limited: cache only the packs.
    await storage.setItem(CACHE_KEY, JSON.stringify({ packs: cfg.packs, messages: [] }));
    return cfg;
  } catch {
    return null;
  }
}
