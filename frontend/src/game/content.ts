// Game content tables: zombie kinds, sectors (visual themes), power-ups and combos.
// Pure data + helpers, no three.js, so it can be unit-tested and tuned in one place.

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
export type Sector = {
  index: number; // 1-based
  name: string;
  background: number;
  fogDensity: number;
  floor: number;
  gridMain: number;
  gridSub: number;
  box: number;
  neonA: number;
  neonB: number;
};

export const LEVELS_PER_SECTOR = 5;

export const SECTORS: Sector[] = [
  { index: 1, name: "NEON DISTRICT", background: 0x1a2740, fogDensity: 0.006, floor: 0x233350, gridMain: 0x2affff, gridSub: 0x2a6a9a, box: 0x46587a, neonA: 0x39ff14, neonB: 0x00ffff },
  { index: 2, name: "TOXIC DOCKS", background: 0x14301f, fogDensity: 0.008, floor: 0x1c3325, gridMain: 0x7dff3a, gridSub: 0x2a7a3a, box: 0x3d5a45, neonA: 0xb6ff00, neonB: 0x39ff14 },
  { index: 3, name: "MAGENTA HEIGHTS", background: 0x2a1638, fogDensity: 0.007, floor: 0x2a1c3a, gridMain: 0xff2bd6, gridSub: 0x7a2a9a, box: 0x5a3d6e, neonA: 0xff2bd6, neonB: 0x00ffff },
  { index: 4, name: "EMBER QUARTER", background: 0x3a1a12, fogDensity: 0.008, floor: 0x331c16, gridMain: 0xff7a1a, gridSub: 0x9a3a1a, box: 0x6e4a3d, neonA: 0xffb000, neonB: 0xff3b1a },
  { index: 5, name: "FROST GRID", background: 0x16283a, fogDensity: 0.009, floor: 0x1c2a3a, gridMain: 0xaaf0ff, gridSub: 0x3a7aa0, box: 0x5a7088, neonA: 0xaaf0ff, neonB: 0xffffff },
  { index: 6, name: "BLACKOUT CORE", background: 0x12121c, fogDensity: 0.009, floor: 0x181822, gridMain: 0xff003c, gridSub: 0x5a1a2a, box: 0x2a2a38, neonA: 0xff003c, neonB: 0x8a2be2 },
];

export function sectorOf(level: number): Sector {
  const i = Math.floor((Math.max(1, level) - 1) / LEVELS_PER_SECTOR);
  return SECTORS[Math.min(i, SECTORS.length - 1)];
}

// ---------------- Power-ups ----------------
export type PowerUpKind = "rage" | "haste" | "infinite";

export const POWERUPS: Record<PowerUpKind, { name: string; color: number; seconds: number }> = {
  rage: { name: "DÉGÂTS ×2", color: 0xff2a2a, seconds: 10 },
  haste: { name: "VITESSE", color: 0x00ffff, seconds: 10 },
  infinite: { name: "MUNITIONS ∞", color: 0xffb000, seconds: 8 },
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
