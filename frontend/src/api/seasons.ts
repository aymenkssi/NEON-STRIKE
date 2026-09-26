// Monthly seasons (backend/seasons.py): season leaderboard, the player's rank and rewards.
import { authed, backendConfigured, get, post } from "./client";

export type SeasonRow = { rank: number; name: string; score: number; level: number; kills: number; badge: number | null };
export type RewardTier = { first: number; last: number; credits: number; champion: boolean };
export type SeasonInfo = { season: string; starts_at: string; ends_at: string; top: SeasonRow[]; rewards: RewardTier[] };
export type SeasonReward = { id: string; season: string; rank: number; credits: number; skin: string | null; badge: boolean };
export type MySeason = { season: string; rank: number | null; score: number | null; excluded: boolean; rewards: SeasonReward[] };

export function fetchSeason(limit = 50): Promise<SeasonInfo> {
  return get(`/seasons/current?limit=${limit}`);
}

export function fetchMySeason(name: string): Promise<MySeason> {
  return authed("/seasons/me", {}, name);
}

// Marks the reward as collected on the server; the app then adds it to the save.
export async function claimSeasonReward(id: string): Promise<SeasonReward | null> {
  if (!backendConfigured) return null;
  try {
    return await post<SeasonReward>(`/seasons/rewards/${id}/claim`, {});
  } catch {
    return null;
  }
}

// Season of a date (UTC month) and its end, computed locally so the countdown works offline.
export function currentSeason(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const end = new Date(Date.UTC(y, m, 1));
  return { season: `${y}-${String(m).padStart(2, "0")}`, month: m, year: y, end };
}

export function daysLeft(end: Date, now = new Date()) {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}
