// Long-term goals: player stats, daily missions and achievements. Pure functions only;
// persistence lives in src/hooks/use-progress.ts.
import type { ZombieKind } from "./content";
import type { UpgradeLevels } from "./progression";
import type { Key } from "../i18n/fr";

// ---------------- Stats ----------------
export type PlayerStats = {
  kills: number;
  headshots: number;
  bosses: number;
  levels: number; // levels completed (replays included)
  threeStars: number; // level completions with 3 stars
  deaths: number;
  powerups: number;
  explosionKills: number;
  bestCombo: number;
  byKind: Record<ZombieKind, number>;
};

export const EMPTY_STATS: PlayerStats = {
  kills: 0, headshots: 0, bosses: 0, levels: 0, threeStars: 0, deaths: 0, powerups: 0,
  explosionKills: 0, bestCombo: 0, byKind: { walker: 0, runner: 0, tank: 0, exploder: 0 },
};

// Everything the game reports; "level" is added by the game screen when a level is won.
export type MetaEvent =
  | { type: "kill"; kind: ZombieKind | "boss"; headshot: boolean; combo: number; byExplosion: boolean }
  | { type: "powerup"; kind: string }
  | { type: "death" }
  | { type: "level"; stars: number };

export function emptyStats(): PlayerStats {
  return { ...EMPTY_STATS, byKind: { ...EMPTY_STATS.byKind } };
}

export function applyEvent(s: PlayerStats, e: MetaEvent): PlayerStats {
  const n = { ...s, byKind: { ...s.byKind } };
  switch (e.type) {
    case "kill":
      n.kills++;
      if (e.headshot) n.headshots++;
      if (e.byExplosion) n.explosionKills++;
      if (e.kind === "boss") n.bosses++;
      else n.byKind[e.kind]++;
      n.bestCombo = Math.max(n.bestCombo, e.combo);
      break;
    case "powerup":
      n.powerups++;
      break;
    case "death":
      n.deaths++;
      break;
    case "level":
      n.levels++;
      if (e.stars >= 3) n.threeStars++;
      break;
  }
  return n;
}

// Adds a play session (a delta built with applyEvent from emptyStats) to the lifetime stats.
export function mergeStats(total: PlayerStats, d: PlayerStats): PlayerStats {
  const byKind = { ...total.byKind };
  (Object.keys(byKind) as ZombieKind[]).forEach((k) => (byKind[k] += d.byKind[k]));
  return {
    kills: total.kills + d.kills,
    headshots: total.headshots + d.headshots,
    bosses: total.bosses + d.bosses,
    levels: total.levels + d.levels,
    threeStars: total.threeStars + d.threeStars,
    deaths: total.deaths + d.deaths,
    powerups: total.powerups + d.powerups,
    explosionKills: total.explosionKills + d.explosionKills,
    bestCombo: Math.max(total.bestCombo, d.bestCombo),
    byKind,
  };
}

// ---------------- Daily missions ----------------
type Metric = "kills" | "headshots" | "levels" | "bosses" | "bestCombo" | "powerups" | "threeStars" | "explosionKills" | ZombieKind;

export type MissionDef = { id: string; text: Key; metric: Metric; target: number; reward: number; minLevel: number };

export const MISSION_POOL: MissionDef[] = [
  { id: "kills", text: "mission.kills", metric: "kills", target: 40, reward: 60, minLevel: 1 },
  { id: "headshots", text: "mission.headshots", metric: "headshots", target: 15, reward: 60, minLevel: 1 },
  { id: "levels", text: "mission.levels", metric: "levels", target: 2, reward: 80, minLevel: 1 },
  { id: "boss", text: "mission.boss", metric: "bosses", target: 1, reward: 70, minLevel: 1 },
  { id: "combo", text: "mission.combo", metric: "bestCombo", target: 3, reward: 70, minLevel: 1 },
  { id: "powerups", text: "mission.powerups", metric: "powerups", target: 3, reward: 60, minLevel: 1 },
  { id: "stars", text: "mission.stars", metric: "threeStars", target: 1, reward: 90, minLevel: 1 },
  { id: "runners", text: "mission.runners", metric: "runner", target: 10, reward: 70, minLevel: 3 },
  { id: "tanks", text: "mission.tanks", metric: "tank", target: 4, reward: 80, minLevel: 5 },
  { id: "blast", text: "mission.blast", metric: "explosionKills", target: 5, reward: 90, minLevel: 7 },
];

export const MISSIONS_PER_DAY = 3;

export type MissionState = { day: string; ids: string[]; progress: Record<string, number>; claimed: string[] };

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Same 3 missions for everyone on a given day (among those unlocked by the player's level).
export function pickDailyMissions(day: string, unlockedLevel: number): string[] {
  const pool = MISSION_POOL.filter((m) => m.minLevel <= unlockedLevel).map((m) => m.id);
  const out: string[] = [];
  let seed = hash(day);
  while (out.length < Math.min(MISSIONS_PER_DAY, pool.length)) {
    seed = hash(`${seed}`);
    const id = pool[seed % pool.length];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function missionsForDay(state: MissionState | null, day: string, unlockedLevel: number): MissionState {
  if (state && state.day === day) return state;
  return { day, ids: pickDailyMissions(day, unlockedLevel), progress: {}, claimed: [] };
}

function metricValue(d: PlayerStats, m: Metric): number {
  if (m in d.byKind) return d.byKind[m as ZombieKind];
  return d[m as Exclude<Metric, ZombieKind>];
}

export function advanceMissions(state: MissionState, session: PlayerStats): MissionState {
  const progress = { ...state.progress };
  for (const id of state.ids) {
    const def = MISSION_POOL.find((m) => m.id === id);
    if (!def) continue;
    const v = metricValue(session, def.metric);
    // Combos are a best-of, everything else accumulates over the day.
    progress[id] = def.metric === "bestCombo" ? Math.max(progress[id] ?? 0, v) : (progress[id] ?? 0) + v;
  }
  return { ...state, progress };
}

export function missionView(state: MissionState) {
  return state.ids
    .map((id) => MISSION_POOL.find((m) => m.id === id))
    .filter((m): m is MissionDef => !!m)
    .map((m) => {
      const value = Math.min(m.target, state.progress[m.id] ?? 0);
      const claimed = state.claimed.includes(m.id);
      return { ...m, value, done: value >= m.target, claimed };
    });
}

// ---------------- Achievements ----------------
export type ProgressSnapshot = { stats: PlayerStats; unlockedLevel: number; stars: Record<string, number>; upgrades: UpgradeLevels };

type AchievementDef = {
  id: string;
  title: Key; // translation keys
  text: Key;
  icon: string;
  reward: number;
  target: number;
  value: (p: ProgressSnapshot) => number;
};

const totalStars = (p: ProgressSnapshot) => Object.values(p.stars).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_blood", title: "ach.first_blood", text: "ach.first_blood.text", icon: "water", reward: 20, target: 1, value: (p) => p.stats.kills },
  { id: "kills_100", title: "ach.kills_100", text: "ach.kills_100.text", icon: "skull", reward: 100, target: 100, value: (p) => p.stats.kills },
  { id: "kills_1000", title: "ach.kills_1000", text: "ach.kills_1000.text", icon: "skull-crossbones", reward: 500, target: 1000, value: (p) => p.stats.kills },
  { id: "heads_50", title: "ach.heads_50", text: "ach.heads_50.text", icon: "target", reward: 100, target: 50, value: (p) => p.stats.headshots },
  { id: "heads_500", title: "ach.heads_500", text: "ach.heads_500.text", icon: "crosshairs-gps", reward: 400, target: 500, value: (p) => p.stats.headshots },
  { id: "boss_1", title: "ach.boss_1", text: "ach.boss_1.text", icon: "sword-cross", reward: 100, target: 1, value: (p) => p.stats.bosses },
  { id: "boss_10", title: "ach.boss_10", text: "ach.boss_10.text", icon: "crown", reward: 300, target: 10, value: (p) => p.stats.bosses },
  { id: "combo_5", title: "ach.combo_5", text: "ach.combo_5.text", icon: "lightning-bolt", reward: 150, target: 5, value: (p) => p.stats.bestCombo },
  { id: "combo_10", title: "ach.combo_10", text: "ach.combo_10.text", icon: "flash", reward: 400, target: 10, value: (p) => p.stats.bestCombo },
  { id: "blast_25", title: "ach.blast_25", text: "ach.blast_25.text", icon: "bomb", reward: 200, target: 25, value: (p) => p.stats.explosionKills },
  { id: "sector_2", title: "ach.sector_2", text: "ach.sector_2.text", icon: "map-marker", reward: 150, target: 6, value: (p) => p.unlockedLevel },
  { id: "sector_4", title: "ach.sector_4", text: "ach.sector_4.text", icon: "map-marker-star", reward: 300, target: 16, value: (p) => p.unlockedLevel },
  { id: "sector_6", title: "ach.sector_6", text: "ach.sector_6.text", icon: "shield-star", reward: 500, target: 26, value: (p) => p.unlockedLevel },
  { id: "campaign", title: "ach.campaign", text: "ach.campaign.text", icon: "trophy", reward: 1000, target: 1, value: (p) => ((p.stars["30"] ?? 0) > 0 ? 1 : 0) },
  { id: "stars_30", title: "ach.stars_30", text: "ach.stars_30.text", icon: "star-shooting", reward: 200, target: 30, value: totalStars },
  { id: "stars_90", title: "ach.stars_90", text: "ach.stars_90.text", icon: "star-circle", reward: 1000, target: 90, value: totalStars },
  { id: "arsenal_max", title: "ach.arsenal_max", text: "ach.arsenal_max.text", icon: "wrench", reward: 200, target: 5, value: (p) => Math.max(...Object.values(p.upgrades)) },
];

export function achievementView(p: ProgressSnapshot, claimed: string[]) {
  return ACHIEVEMENTS.map((a) => {
    const value = Math.min(a.target, a.value(p));
    return { id: a.id, title: a.title, text: a.text, icon: a.icon, reward: a.reward, target: a.target, value, done: value >= a.target, claimed: claimed.includes(a.id) };
  });
}
