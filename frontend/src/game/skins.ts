// Cosmetic skins bought with credits: a finish for every weapon and an outfit for the player's
// arms (the gloves and sleeves seen in first person). Pure data, used by weapons.ts.
import type { Key } from "../i18n/fr";

export type WeaponSkin = {
  id: string;
  name: Key;
  price: number;
  body: number; // receiver / main parts
  metal: number; // barrels, magazines, grips
  furniture: number; // stock, pump, handguard
  light: number; // railgun shell
  tube: number; // launcher tube
  accent: number | null; // stripes and rings (null: the weapon's rarity colour)
  glow?: boolean; // accents are drawn unlit (they glow in the dark)
  exclusive?: boolean; // not for sale: season reward (top 5 of a monthly season)
};

export type Outfit = {
  id: string;
  name: Key;
  price: number;
  glove: number;
  sleeve: number;
  band: number; // cuff between glove and sleeve
  glow?: boolean;
};

export const WEAPON_SKINS: WeaponSkin[] = [
  { id: "w_default", name: "skin.w_default", price: 0, body: 0x4a4f5a, metal: 0x2a2d35, furniture: 0xc9783a, light: 0xe8e8ee, tube: 0x5a7a4a, accent: null },
  { id: "w_camo", name: "skin.w_camo", price: 400, body: 0x5b6b3a, metal: 0x3b4226, furniture: 0x8a6f3e, light: 0x7d8b52, tube: 0x4e5c30, accent: 0xb8c46a },
  { id: "w_arctic", name: "skin.w_arctic", price: 600, body: 0xe6eef5, metal: 0x8fa6bf, furniture: 0xcfe3f2, light: 0xffffff, tube: 0xb9d3ea, accent: 0x3ab0ff },
  { id: "w_candy", name: "skin.w_candy", price: 800, body: 0xff7ac8, metal: 0x6a5acd, furniture: 0x7fe3ff, light: 0xffc2e6, tube: 0xff9ad6, accent: 0xfff35c },
  { id: "w_neon", name: "skin.w_neon", price: 1000, body: 0x1a1a2e, metal: 0x0f0f1a, furniture: 0x2a1a3e, light: 0x2b2b44, tube: 0x1f1f33, accent: 0x39ff14, glow: true },
  { id: "w_lava", name: "skin.w_lava", price: 1200, body: 0x2a1a14, metal: 0x140c0a, furniture: 0x4a2414, light: 0x3a221a, tube: 0x33180f, accent: 0xff5a1f, glow: true },
  { id: "w_champion", name: "skin.w_champion", price: 0, exclusive: true, body: 0x1b1b24, metal: 0x0c0c12, furniture: 0x2b2238, light: 0x2a2a36, tube: 0x1f1a2a, accent: 0xffc233, glow: true },
  { id: "w_gold", name: "skin.w_gold", price: 1500, body: 0xd4a017, metal: 0x8f6206, furniture: 0xe8bf4a, light: 0xf0cf6a, tube: 0xc08a12, accent: 0xfff1a8 },
];

export const OUTFITS: Outfit[] = [
  { id: "o_soldier", name: "skin.o_soldier", price: 0, glove: 0x2e3440, sleeve: 0x3f6fbf, band: 0x2a3550 },
  { id: "o_commando", name: "skin.o_commando", price: 500, glove: 0x3b3a2a, sleeve: 0x5b6b3a, band: 0x8a6f3e },
  { id: "o_ninja", name: "skin.o_ninja", price: 800, glove: 0x111111, sleeve: 0x1c1c22, band: 0xd62828 },
  { id: "o_astronaut", name: "skin.o_astronaut", price: 1000, glove: 0xf2f2f2, sleeve: 0xe3e6ea, band: 0xff8c1a },
  { id: "o_cyber", name: "skin.o_cyber", price: 1400, glove: 0x141428, sleeve: 0x3a1f6b, band: 0x00ffff, glow: true },
  { id: "o_royal", name: "skin.o_royal", price: 2000, glove: 0xffd23a, sleeve: 0x8b1e3f, band: 0xffd23a },
];

export type SkinState = { owned: string[]; weapon: string; outfit: string };
export const DEFAULT_SKINS: SkinState = { owned: [], weapon: "w_default", outfit: "o_soldier" };

export const weaponSkin = (id?: string) => WEAPON_SKINS.find((s) => s.id === id) ?? WEAPON_SKINS[0];
export const outfit = (id?: string) => OUTFITS.find((s) => s.id === id) ?? OUTFITS[0];
export const isExclusive = (id: string) => !!WEAPON_SKINS.find((s) => s.id === id)?.exclusive;
// null: unknown or not for sale (exclusive rewards).
export const skinPrice = (id: string) => (isExclusive(id) ? null : ((WEAPON_SKINS.find((s) => s.id === id) ?? OUTFITS.find((s) => s.id === id))?.price ?? null));
export const ownsSkin = (s: SkinState, id: string) => s.owned.includes(id) || (!isExclusive(id) && skinPrice(id) === 0);
