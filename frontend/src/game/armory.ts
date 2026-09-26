// Weapons of the game: stats (used by the engine), default prices and the Armory rules.
// Prices come from the backend (admin page → "Armurerie") and fall back to DEFAULT_PRICE.
// Pure data, no three.js.
export type FireMode = "single" | "burst" | "auto";

export type WeaponConfig = {
  key: string;
  short: string; // weapon bar label
  pellets: number;
  spread: number;
  maxAmmo: number;
  reloadMs: number;
  bodyDmg: number;
  headDmg: number;
  recoil: number;
  fireRate: number; // ms between shots (auto) or between taps / bursts
  modes: FireMode[]; // the first one is the default
  burstGap?: number; // ms between the rounds of a burst
  sound: string;
  pierce?: number; // sniper: zombies one bullet goes through (stopped by walls)
  projectile?: "grenade" | "rocket";
};

export const WEAPONS: WeaponConfig[] = [
  {
    key: "pistol", short: "PST", sound: "pistol",
    pellets: 1, spread: 0.006, maxAmmo: 12, reloadMs: 1000,
    bodyDmg: 2, headDmg: 4, recoil: 0.12, fireRate: 200, modes: ["single"],
  },
  {
    key: "shotgun", short: "SG", sound: "shotgun",
    pellets: 8, spread: 0.06, maxAmmo: 5, reloadMs: 1500,
    bodyDmg: 1, headDmg: 2, recoil: 0.18, fireRate: 400, modes: ["single"],
  },
  {
    key: "mp5", short: "MP5", sound: "smg",
    pellets: 1, spread: 0.02, maxAmmo: 30, reloadMs: 1200,
    bodyDmg: 1, headDmg: 2, recoil: 0.08, fireRate: 85, modes: ["auto", "burst", "single"], burstGap: 65,
  },
  {
    key: "m16", short: "M16", sound: "rifle",
    pellets: 1, spread: 0.004, maxAmmo: 30, reloadMs: 1500,
    bodyDmg: 3, headDmg: 5, recoil: 0.2, fireRate: 330, modes: ["burst", "single"], burstGap: 75,
  },
  {
    key: "m4", short: "M4", sound: "rifle",
    pellets: 1, spread: 0.01, maxAmmo: 30, reloadMs: 1400,
    bodyDmg: 2, headDmg: 4, recoil: 0.1, fireRate: 105, modes: ["auto", "burst", "single"], burstGap: 70,
  },
  {
    key: "ak47", short: "AK", sound: "ak47",
    pellets: 1, spread: 0.014, maxAmmo: 30, reloadMs: 1600,
    bodyDmg: 3, headDmg: 5, recoil: 0.16, fireRate: 125, modes: ["auto", "single"],
  },
  {
    key: "sniper", short: "SNP", sound: "sniper",
    pellets: 1, spread: 0, maxAmmo: 5, reloadMs: 2200,
    bodyDmg: 8, headDmg: 14, recoil: 0.34, fireRate: 1000, modes: ["single"], pierce: 3,
  },
  {
    key: "launcher", short: "GL", sound: "launcher",
    pellets: 1, spread: 0, maxAmmo: 6, reloadMs: 2600,
    bodyDmg: 0, headDmg: 0, recoil: 0.3, fireRate: 650, modes: ["single"], projectile: "grenade",
  },
  {
    key: "minigun", short: "MG", sound: "smg",
    pellets: 1, spread: 0.035, maxAmmo: 150, reloadMs: 3000,
    bodyDmg: 1, headDmg: 2, recoil: 0.05, fireRate: 50, modes: ["auto"],
  },
  {
    key: "rpg", short: "RPG", sound: "rpg",
    pellets: 1, spread: 0, maxAmmo: 1, reloadMs: 2600,
    bodyDmg: 0, headDmg: 0, recoil: 0.45, fireRate: 900, modes: ["single"], projectile: "rocket",
  },
];

export const weaponOf = (key: string) => WEAPONS.find((w) => w.key === key);

// ---------------- Armory ----------------
export const LOADOUT_SIZE = 4;
export const STARTER_WEAPONS = ["pistol", "shotgun"];

export const DEFAULT_PRICE: Record<string, number> = {
  pistol: 0, shotgun: 0, mp5: 800, m16: 1500, m4: 2200, ak47: 2800, sniper: 4000, launcher: 5000, minigun: 6000, rpg: 8000,
};

export type ArmoryState = { owned: string[]; loadout: string[] };

// Saves made before the Armory: weapons were unlocked by level. Players keep them.
const LEGACY: [string, string, number][] = [
  ["smg", "mp5", 2], ["rifle", "m4", 4], ["railgun", "sniper", 10], ["minigun", "minigun", 15], ["launcher", "launcher", 20],
];

export function initialArmory(unlockedLevel: number): ArmoryState {
  const owned = [...STARTER_WEAPONS, ...LEGACY.filter(([, , lvl]) => unlockedLevel >= lvl).map(([, key]) => key)];
  // Loadout: the shotgun and the most powerful weapons already earned.
  const best = owned.filter((k) => k !== "pistol" && k !== "shotgun").reverse();
  const loadout = ["shotgun", ...best, "pistol"].slice(0, LOADOUT_SIZE);
  return { owned, loadout };
}

export function cleanArmory(a: Partial<ArmoryState> | undefined, unlockedLevel: number): ArmoryState {
  if (!a || !Array.isArray(a.owned)) return initialArmory(unlockedLevel);
  const known = (k: unknown): k is string => typeof k === "string" && !!weaponOf(k);
  const owned = Array.from(new Set([...STARTER_WEAPONS, ...a.owned.filter(known)]));
  let loadout = (Array.isArray(a.loadout) ? a.loadout : []).filter((k) => known(k) && owned.includes(k));
  loadout = Array.from(new Set(loadout)).slice(0, LOADOUT_SIZE);
  if (!loadout.length) loadout = ["shotgun"];
  return { owned, loadout };
}

// ---------------- Prices from the admin page ----------------
export type RemoteWeapon = { key: string; price: number; on_sale: boolean };
let remote: Record<string, RemoteWeapon> = {};
const listeners = new Set<() => void>();

export function setRemoteWeapons(list: RemoteWeapon[] | undefined) {
  if (!Array.isArray(list) || !list.length) return;
  remote = Object.fromEntries(list.filter((w) => weaponOf(w.key)).map((w) => [w.key, w]));
  listeners.forEach((fn) => fn());
}

export function onWeaponPricesChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const priceOf = (key: string) => remote[key]?.price ?? DEFAULT_PRICE[key] ?? 0;
export const onSale = (key: string) => remote[key]?.on_sale ?? true;

// Stats shown in the Armory (0..1 bars).
export function weaponBars(w: WeaponConfig) {
  return {
    damage: w.projectile ? 1 : Math.min(1, (w.bodyDmg * w.pellets) / 8),
    rate: Math.min(1, 1000 / w.fireRate / 20),
    accuracy: w.projectile ? 0.7 : Math.max(0.1, 1 - w.spread * 12),
    ammo: Math.min(1, w.maxAmmo / 60),
  };
}
