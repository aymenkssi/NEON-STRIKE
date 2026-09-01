const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const API = `${BASE}/api`;

export type LeaderboardRow = {
  id: string;
  rank: number;
  name: string;
  score: number;
  wave: number;
  kills: number;
  created_at: string;
};

export type SubmitResult = {
  entry: { id: string; name: string; score: number; wave: number; kills: number; created_at: string };
  rank: number;
  is_high_score: boolean;
};

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const res = await fetch(`${API}/leaderboard?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function submitScore(payload: {
  name: string;
  score: number;
  wave: number;
  kills: number;
}): Promise<SubmitResult> {
  const res = await fetch(`${API}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
