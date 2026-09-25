// Game content tables: zombie kinds, sectors (visual themes), power-ups and combos.
// Pure data + helpers, no three.js, so it can be unit-tested and tuned in one place.
import { CITY_ORDER, type CityId } from "./cities";

// ---------------- Zombies ----------------
export type ZombieKind = "walker" | "runner" | "tank" | "exploder";

export type ZombieDef = {
  kind: ZombieKind;
  name: string;
  hpMult: number;
  speedMult: number;
  biteMult: number;
  scale: number;
  skin: number;
  shirt: number;
  eyes: number;
  glow?: number; // emissive body colour (exploder)
  score: number;
  credits: number;
  fromLevel: number;
};

export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  walker: {
    kind: "walker", name: "Rôdeur", hpMult: 1, speedMult: 1, biteMult: 1, scale: 1,
    skin: 0x4a7a2c, shirt: 0x223a66, eyes: 0xff2a2a, score: 100, credits: 5, fromLevel: 1,
  },
  runner: {
    kind: "runner", name: "Coureur", hpMult: 0.6, speedMult: 1.8, biteMult: 0.7, scale: 0.85,
    skin: 0x8a7a3c, shirt: 0x6a2222, eyes: 0xffb000, score: 120, credits: 6, fromLevel: 3,
  },
  tank: {
    kind: "tank", name: "Blindé", hpMult: 3, speedMult: 0.6, biteMult: 1.6, scale: 1.35,
    skin: 0x5a5a66, shirt: 0x2a2f38, eyes: 0x00ffff, score: 250, credits: 12, fromLevel: 5,
  },
  exploder: {
    kind: "exploder", name: "Explosif", hpMult: 0.8, speedMult: 1.2, biteMult: 0, scale: 1.05,
    skin: 0x2c7a3a, shirt: 0x1f5a2a, eyes: 0xb6ff00, glow: 0x39ff14, score: 150, credits: 8, fromLevel: 7,
  },
};

// Share of each special kind in a wave; walkers fill the rest.
export function zombieWeights(level: number): Record<ZombieKind, number> {
  const runner = level >= ZOMBIES.runner.fromLevel ? Math.min(0.35, (level - 2) * 0.07) : 0;
  const tank = level >= ZOMBIES.tank.fromLevel ? Math.min(0.2, (level - 4) * 0.04) : 0;
  const exploder = level >= ZOMBIES.exploder.fromLevel ? Math.min(0.2, (level - 6) * 0.04) : 0;
  return { walker: 1 - runner - tank - exploder, runner, tank, exploder };
}

export function pickZombieKind(level: number, rnd: number = Math.random()): ZombieKind {
  const w = zombieWeights(level);
  let acc = 0;
  for (const kind of ["runner", "tank", "exploder"] as ZombieKind[]) {
    acc += w[kind];
    if (rnd < acc) return kind;
  }
  return "walker";
}

export const EXPLOSION = {
  radius: 4.5, // metres
  playerDamage: (level: number) => 18 + level, // exploder reaching the player
  zombieDamage: 8, // to every zombie inside the radius (chain reactions)
};

// ---------------- Sectors ----------------
// One world city per sector of 5 levels (see cities.ts for the look of each city).
export type Sector = { index: number; city: CityId };

export const LEVELS_PER_SECTOR = 5;

export function sectorOf(level: number): Sector {
  const i = Math.min(CITY_ORDER.length - 1, Math.floor((Math.max(1, level) - 1) / LEVELS_PER_SECTOR));
  return { index: i + 1, city: CITY_ORDER[i] };
}

// ---------------- Power-ups ----------------
export type PowerUpKind = "rage" | "haste" | "infinite";

// Names: translation keys power.<kind>.
export const POWERUPS: Record<PowerUpKind, { color: number; seconds: number }> = {
  rage: { color: 0xff2a2a, seconds: 10 },
  haste: { color: 0x00ffff, seconds: 10 },
  infinite: { color: 0xffb000, seconds: 8 },
};

export const POWERUP_DROP_CHANCE = 0.07;
export const RAGE_MULT = 2;
export const HASTE_MULT = 1.5;

// ---------------- Combos ----------------
export const COMBO_WINDOW_MS = 2500;

export function comboLabel(combo: number): string | null {
  if (combo < 2) return null;
  if (combo === 2) return "DOUBLE KILL";
  if (combo === 3) return "TRIPLE KILL";
  if (combo === 4) return "MULTI KILL";
  return `MASSACRE ×${combo}`;
}

export function comboBonus(combo: number) {
  return combo < 2 ? { score: 0, credits: 0 } : { score: 50 * (combo - 1), credits: combo - 1 };
}
