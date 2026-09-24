// Online save and recovery code (see backend/cloudsave.py).
import { storage } from "@/src/utils/storage";
import { ApiError, authed, backendConfigured, post, setSession } from "./client";

export type RemoteSave = { data: Record<string, unknown>; updated_at: number };

const CODE_KEY = "np_recovery_code";

export const cloudAvailable = backendConfigured;

export function fetchSave(): Promise<RemoteSave | null> {
  return authed<RemoteSave | null>("/save");
}

export function pushSave(data: object, updatedAt: number): Promise<{ stored: boolean; updated_at: number }> {
  return authed("/save", { method: "PUT", body: JSON.stringify({ data, updated_at: updatedAt }) });
}

// The code is only returned once by the server, so the app keeps a copy to show it again.
export async function getRecoveryCode(forceNew = false): Promise<string> {
  if (!forceNew) {
    const cached = await storage.getItem(CODE_KEY, null as string | null);
    if (typeof cached === "string") return cached;
  }
  const { code } = await authed<{ code: string }>("/players/recovery-code", { method: "POST" });
  await storage.setItem(CODE_KEY, code);
  return code;
}

export type RecoverError = "unknown" | "rate" | "network";

// Links this phone to the player owning `code`. Returns the player's name.
export async function recoverAccount(code: string): Promise<{ name: string } | { error: RecoverError }> {
  try {
    const r = await post<{ id: string; token: string; name: string }>("/players/recover", { code });
    await setSession(r.id, r.token);
    await storage.removeItem(CODE_KEY); // belonged to the previous identity of this phone
    return { name: r.name };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { error: "unknown" };
    if (e instanceof ApiError && e.status === 429) return { error: "rate" };
    return { error: "network" };
  }
}
