import { ApiError, authed, get } from "./client";
import { storage } from "@/src/utils/storage";

export type LeaderboardRow = {
  id: string;
  rank: number;
  name: string;
  score: number;
  level: number;
  kills: number;
  created_at: string;
  badge?: number | null; // best monthly season rank (1-5)
};

export type SubmitResult = { rank: number; best: number; is_high_score: boolean };

export function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  return get(`/leaderboard?limit=${limit}`);
}

// The player's own row (rank among everyone), or null before their first score.
export function fetchMyRank(name: string): Promise<LeaderboardRow | null> {
  return authed("/leaderboard/me", {}, name);
}

export function submitScore(payload: { name: string; score: number; level: number; kills: number }): Promise<SubmitResult> {
  return authed("/scores", { method: "POST", body: JSON.stringify(payload) }, payload.name);
}

// ---------------- Reliable submission ----------------
// A run's score is sent when a level is completed and at game over. When the network (or the
// server's anti-spam delay) makes it fail, the best pending score is kept on the phone and sent
// again later (next submission or next launch), so a finished run is never lost.
type Pending = { name: string; score: number; level: number; kills: number };
const PENDING_KEY = "np_pending_score";

async function readPending(): Promise<Pending | null> {
  const raw = await storage.getItem(PENDING_KEY, null as string | null);
  try {
    return typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function submitRunScore(payload: Pending): Promise<SubmitResult | null> {
  const pending = await readPending();
  const best = pending && pending.name === payload.name && pending.score > payload.score ? pending : payload;
  try {
    const res = await submitScore(best);
    await storage.setItem(PENDING_KEY, "");
    return res;
  } catch (e) {
    // Rejected for good (guest, invalid): nothing to retry. Otherwise keep it for later.
    if (e instanceof ApiError && (e.status === 403 || e.status === 422 || e.status === 401)) {
      await storage.setItem(PENDING_KEY, "");
      throw e;
    }
    await storage.setItem(PENDING_KEY, JSON.stringify(best));
    throw e;
  }
}

// At launch (accounts only): sends a score that could not be sent last time.
export async function flushPendingScore(name: string) {
  const pending = await readPending();
  if (!pending || pending.name !== name) return;
  try {
    await submitRunScore(pending);
  } catch {}
}
