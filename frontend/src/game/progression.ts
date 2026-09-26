// Campaign progression rules: level difficulty, stars, credit rewards, upgrades, daily reward.
// Pure functions only — persistence lives in src/hooks/use-progress.ts.
import type { Key } from "../i18n/fr";

export const MAX_LEVEL = 30;

export type LevelConfig = {
  level: number;
  difficulty: Difficulty;
  speedMult: number;
  damageMult: number;
  creditMult: number;
  waves: number;
  zombiesPerWave: (waveInLevel: number) => number;
  zombieHealth: number;
  zombieSpeedBonus: number;
  biteDamage: number;
  bossHealth: number;
  completionBonus: number;
};

// ---------------- Difficulty ----------------
// Chosen before each level. Nightmare pays double credits and earns a red skull on the level.
export type Difficulty = "easy" | "normal" | "nightmare";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "nightmare"];

export type DifficultyDef = {
  hp: number; // zombie and boss health
  speed: number; // zombie speed
  damage: number; // bites, explosions, acid
  count: number; // zombies per wave
  credits: number; // every credit earned during and after the level
  icon: string;
  color: string;
};

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: { hp: 0.7, speed: 0.85, damage: 0.6, count: 0.8, credits: 0.75, icon: "emoticon-happy-outline", color: "#39FF14" },
  normal: { hp: 1, speed: 1, damage: 1, count: 1, credits: 1, icon: "sword-cross", color: "#00FFFF" },
  nightmare: { hp: 1.5, speed: 1.2, damage: 1.5, count: 1.25, credits: 2, icon: "skull", color: "#FF003C" },
};

export function getLevelConfig(level: number, difficulty: Difficulty = "normal"): LevelConfig {
  const l = Math.max(1, Math.min(level, MAX_LEVEL));
  const d = DIFFICULTY[difficulty];
  return {
    level: l,
    difficulty,
    waves: l <= 2 ? 2 : 3,
    zombiesPerWave: (w) => Math.max(2, Math.round(Math.min(3 + l + w * 2, 20) * d.count)),
    zombieHealth: Math.max(1, Math.round((3 + Math.floor(l / 2)) * d.hp)),
    zombieSpeedBonus: l * 0.15,
    speedMult: d.speed,
    damageMult: d.damage,
    creditMult: d.credits,
    biteDamage: Math.max(1, Math.round((8 + Math.floor(l / 3)) * d.damage)),
    bossHealth: Math.round((20 + l * 8) * d.hp),
    completionBonus: 50 + l * 25,
  };
}

// ---------------- Stars & rewards ----------------
export const CREDITS_PER_KILL = 5;
export const CREDITS_PER_HEADSHOT = 5;
export const CREDITS_PER_BOSS = 50;
export const STAR_BONUS = [0, 0, 30, 80]; // extra credits for reaching 1 / 2 / 3 stars

export type LevelResult = {
  level: number;
  score: number;
  kills: number;
  headshots: number;
  health: number;
  maxHealth: number;
  credits: number; // credits picked up during the level (kills, boss), difficulty included
  difficulty?: Difficulty;
};

export function computeStars(r: Pick<LevelResult, "health" | "maxHealth" | "kills" | "headshots">): number {
  let stars = 1;
  if (r.health >= r.maxHealth * 0.5) stars++;
  if (r.kills > 0 && r.headshots / r.kills >= 0.3) stars++;
  return stars;
}

export function levelReward(r: LevelResult) {
  const stars = computeStars(r);
  const mult = DIFFICULTY[r.difficulty ?? "normal"].credits;
  const bonus = Math.round(getLevelConfig(r.level).completionBonus * mult);
  const starBonus = Math.round(STAR_BONUS[stars] * mult);
  return { stars, combat: r.credits, bonus, starBonus, total: r.credits + bonus + starBonus, mult };
}

// ---------------- Upgrades (Arsenal) ----------------
export type UpgradeKey = "damage" | "health" | "ammo" | "reload";

// name / desc: translation keys; desc receives {v} = value(level).
export type UpgradeDef = {
  key: UpgradeKey;
  name: Key;
  desc: Key;
  value: (lvl: number) => number;
  icon: string;
};

export const UPGRADE_MAX = 5;
export const UPGRADE_COSTS = [100, 200, 350, 550, 800];

export const UPGRADES: UpgradeDef[] = [
  { key: "damage", name: "upgrade.damage", desc: "upgrade.damage.desc", icon: "sword", value: (l) => l * 20 },
  { key: "health", name: "upgrade.health", desc: "upgrade.health.desc", icon: "shield-plus", value: (l) => l * 20 },
  { key: "ammo", name: "upgrade.ammo", desc: "upgrade.ammo.desc", icon: "ammunition", value: (l) => l * 20 },
  { key: "reload", name: "upgrade.reload", desc: "upgrade.reload.desc", icon: "reload", value: (l) => l * 10 },
];

export type UpgradeLevels = Record<UpgradeKey, number>;
export const NO_UPGRADES: UpgradeLevels = { damage: 0, health: 0, ammo: 0, reload: 0 };

export function upgradeCost(currentLevel: number): number | null {
  return currentLevel >= UPGRADE_MAX ? null : UPGRADE_COSTS[currentLevel];
}

export type PlayerModifiers = {
  damageMult: number;
  maxHealth: number;
  ammoMult: number;
  reloadMult: number;
};

export function modifiersFrom(u: UpgradeLevels): PlayerModifiers {
  return {
    damageMult: 1 + u.damage * 0.2,
    maxHealth: 100 + u.health * 20,
    ammoMult: 1 + u.ammo * 0.2,
    reloadMult: 1 - u.reload * 0.1,
  };
}

// ---------------- Daily reward ----------------
export const DAILY_REWARDS = [50, 75, 100, 150, 200, 250, 500];

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// streak = number of consecutive days already claimed (0..7), lastClaim = dayKey or "".
export function dailyStatus(lastClaim: string, streak: number, today: string = dayKey()) {
  if (!lastClaim) return { canClaim: true, dayIndex: 0 };
  const gap = daysBetween(lastClaim, today);
  if (gap <= 0) return { canClaim: false, dayIndex: Math.max(0, (streak - 1) % DAILY_REWARDS.length) };
  if (gap === 1) return { canClaim: true, dayIndex: streak % DAILY_REWARDS.length };
  return { canClaim: true, dayIndex: 0 }; // missed a day: streak restarts
}
