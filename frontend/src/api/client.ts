// HTTP client for the Neon Strike backend with an anonymous player session.
// On first use the app registers a player and keeps its secret token in secure storage;
// every authenticated call sends it as a Bearer token.
import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
const SESSION_KEY = "np_player_session";

export const backendConfigured = BASE.length > 0;

type Session = { id: string; token: string };
let session: Session | null = null;
let creating: Promise<Session> | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request(path: string, init: RequestInit = {}, token?: string) {
  if (!backendConfigured) throw new ApiError(0, "Backend not configured");
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new ApiError(0, "Network error");
  }
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  return res.json();
}

async function loadOrCreateSession(name: string, forceNew = false): Promise<Session> {
  if (session && !forceNew) return session;
  if (!forceNew) {
    const raw = await storage.secureGet(SESSION_KEY, null as string | null);
    if (typeof raw === "string") {
      try {
        session = JSON.parse(raw);
        return session!;
      } catch {}
    }
  }
  if (!creating) {
    creating = request("/players", { method: "POST", body: JSON.stringify({ name }) })
      .then(async (p: Session & { name: string }) => {
        session = { id: p.id, token: p.token };
        await storage.secureSet(SESSION_KEY, JSON.stringify(session));
        return session;
      })
      .finally(() => {
        creating = null;
      });
  }
  return creating;
}

// Public endpoint, no session needed.
export function get<T>(path: string): Promise<T> {
  return request(path);
}

// Authenticated call; re-registers once if the server no longer knows this player.
export async function authed<T>(path: string, init: RequestInit = {}, name = "PLAYER"): Promise<T> {
  const s = await loadOrCreateSession(name);
  try {
    return await request(path, init, s.token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const fresh = await loadOrCreateSession(name, true);
      return request(path, init, fresh.token);
    }
    throw e;
  }
}
