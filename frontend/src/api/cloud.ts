// Online save of an account's progress (see backend/cloudsave.py).
import { authed, backendConfigured } from "./client";

export type RemoteSave = { data: Record<string, unknown>; updated_at: number };

export const cloudAvailable = backendConfigured;

export function fetchSave(): Promise<RemoteSave | null> {
  return authed<RemoteSave | null>("/save");
}

export function pushSave(data: object, updatedAt: number): Promise<{ stored: boolean; updated_at: number }> {
  return authed("/save", { method: "PUT", body: JSON.stringify({ data, updated_at: updatedAt }) });
}
