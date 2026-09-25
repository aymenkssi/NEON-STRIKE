// Player accounts (unique username + password), see backend/accounts.py.
import { ApiError, backendConfigured, clearSession, get, post, setSession } from "./client";
import type { Key } from "@/src/i18n";

export type AuthError = "taken" | "invalid" | "credentials" | "rate" | "network" | "offline";
export type AuthResult = { username: string } | { error: AuthError };

export const accountsAvailable = backendConfigured;
export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const PASSWORD_MIN = 6;

function toError(e: unknown): AuthError {
  if (e instanceof ApiError) {
    if (e.status === 409) return "taken";
    if (e.status === 422) return "invalid";
    if (e.status === 401) return "credentials";
    if (e.status === 429) return "rate";
    if (e.status === 0) return "network";
  }
  return "network";
}

// Creating an account keeps this phone's anonymous player (and its purchases) when there is one.
export async function registerAccount(username: string, password: string): Promise<AuthResult> {
  if (!backendConfigured) return { error: "offline" };
  try {
    const r = await post<{ id: string; token: string; username: string }>("/accounts/register", { username: username.trim(), password });
    await setSession(r.id, r.token);
    return { username: r.username };
  } catch (e) {
    return { error: toError(e) };
  }
}

export async function loginAccount(username: string, password: string): Promise<AuthResult> {
  if (!backendConfigured) return { error: "offline" };
  try {
    const r = await post<{ id: string; token: string; username: string }>("/accounts/login", { username: username.trim(), password });
    await setSession(r.id, r.token);
    return { username: r.username };
  } catch (e) {
    return { error: toError(e) };
  }
}

export async function checkUsername(username: string): Promise<"ok" | "taken" | "invalid" | "unknown"> {
  if (!USERNAME_RE.test(username.trim())) return "invalid";
  try {
    const r = await get<{ available: boolean; reason: string | null }>(`/accounts/available?username=${encodeURIComponent(username.trim())}`);
    return r.available ? "ok" : r.reason === "taken" ? "taken" : "invalid";
  } catch {
    return "unknown";
  }
}

export async function logoutAccount() {
  await clearSession();
}

// Deletes the account and its online data (Google Play requires it), then forgets the session.
export async function deleteAccount(password: string): Promise<"deleted" | "credentials" | "rate" | "network"> {
  if (!backendConfigured) return "network";
  // post (not authed): never re-register a new player and delete that one by mistake.
  try {
    await post("/accounts/delete", { password });
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return "credentials";
    if (e instanceof ApiError && e.status === 429) return "rate";
    return "network";
  }
  await clearSession();
  return "deleted";
}

export const AUTH_ERRORS: Record<AuthError, Key> = {
  taken: "auth.err.taken",
  invalid: "auth.err.invalid",
  credentials: "auth.err.credentials",
  rate: "auth.err.rate",
  network: "auth.err.network",
  offline: "auth.err.offline",
};
