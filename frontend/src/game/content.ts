// Game content tables: zombie kinds, sectors (visual themes), power-ups and combos.
// Pure data + helpers, no three.js, so it can be unit-tested and tuned in one place.
import { CITY_ORDER, type CityId } from "./cities";

// ---------------- Zombies ----------------
export type ZombieKind = "walker" | "runner" | "tank" | "exploder" | "spitter" | "shield";

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
  // Keeps its distance and spits acid balls that can be dodged.
  spitter: {
    kind: "spitter", name: "Cracheur", hpMult: 0.9, speedMult: 1.1, biteMult: 0.8, scale: 1,
    skin: 0x9acd32, shirt: 0x4b3a6b, eyes: 0xd4ff3a, glow: 0x9dff2e, score: 180, credits: 9, fromLevel: 9,
  },
  // Riot shield in front: bullets stop on it. Aim for the head, go round it or use explosives.
  shield: {
    kind: "shield", name: "Bouclier", hpMult: 1.6, speedMult: 0.8, biteMult: 1.2, scale: 1.1,
    skin: 0x7fa0b0, shirt: 0x243447, eyes: 0x6dfaff, score: 220, credits: 11, fromLevel: 12,
  },
};

export const SPIT = {
  keepAway: 14, // metres: stops here when it can see the player
  range: 22,
  cooldownMs: 2600,
  speed: 16, // m/s: fast, but a sidestep dodges it
  radius: 1.1, // hit radius around the player
  damage: (level: number) => 8 + Math.floor(level / 3),
};

// Share of each special kind in a wave; walkers fill the rest.
export const SPECIAL_KINDS: ZombieKind[] = ["runner", "tank", "exploder", "spitter", "shield"];

export function zombieWeights(level: number): Record<ZombieKind, number> {
  const share = (kind: ZombieKind, perLevel: number, max: number) =>
    level >= ZOMBIES[kind].fromLevel ? Math.min(max, (level - ZOMBIES[kind].fromLevel + 1) * perLevel) : 0;
  const runner = share("runner", 0.07, 0.3);
  const tank = share("tank", 0.04, 0.15);
  const exploder = share("exploder", 0.04, 0.15);
  const spitter = share("spitter", 0.04, 0.12);
  const shield = share("shield", 0.04, 0.12);
  return { walker: 1 - runner - tank - exploder - spitter - shield, runner, tank, exploder, spitter, shield };
}

export function pickZombieKind(level: number, rnd: number = Math.random()): ZombieKind {
  const w = zombieWeights(level);
  let acc = 0;
  for (const kind of SPECIAL_KINDS) {
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
