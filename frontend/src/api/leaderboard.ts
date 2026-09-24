import { authed, get } from "./client";

export type LeaderboardRow = {
  id: string;
  rank: number;
  name: string;
  score: number;
  level: number;
  kills: number;
  created_at: string;
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
