// Messages sent to this player from the admin page (Players tab → ✉), shown once each.
import { authed, backendConfigured, post } from "./client";
import type { RemoteMessage } from "./config";

export async function fetchInbox(): Promise<RemoteMessage[]> {
  if (!backendConfigured) return [];
  try {
    return await authed<RemoteMessage[]>("/inbox");
  } catch {
    return [];
  }
}

export function markRead(id: string) {
  return post(`/inbox/${id}/read`, {}).catch(() => {});
}
