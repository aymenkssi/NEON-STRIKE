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

// Characters ("heroes"): each has its own look (headgear, hair, build) and 3 colour skins.
// A skin of a character is an Outfit: its colours dress the full body in third person and the
// arms and gloves in first person. The first skin comes with the character; the others are
// bought separately once the character is owned.
export type HeroKind = "soldier" | "commando" | "ninja" | "astronaut" | "cyber" | "royal";

export type Outfit = {
  id: string;
  name: Key; // role, e.g. "Ninja"
  hero: HeroKind;
  heroName: Key; // e.g. "Kira"
  base: string; // id of the character (its first skin)
  variant: number; // 0 = the character's standard skin
  price: number;
  glove: number;
  sleeve: number; // main suit colour
  suit2: number; // pants, vest, headgear
  band: number; // accent: cuff, stripes, visor, crown
  skinTone: number;
  hair: number;
  female?: boolean;
  glow?: boolean;
};

export const VARIANT_PRICE = 300;

type HeroDef = {
  id: string;
  kind: HeroKind;
  price: number;
  skinTone: number;
  hair: number;
  female?: boolean;
  // [suit, suit2, accent, glove, glow]
  variants: [number, number, number, number, boolean?][];
};

const HEROES: HeroDef[] = [
  { id: "o_soldier", kind: "soldier", price: 0, skinTone: 0xe0ac69, hair: 0x3b2a1a,
    variants: [[0x3f6fbf, 0x2a3550, 0x2a3550, 0x2e3440], [0xc2a36b, 0x8a6f3e, 0x6b5530, 0x4a3b28], [0x6b7280, 0x374151, 0xef4444, 0x1f2937]] },
  { id: "o_commando", kind: "commando", price: 500, skinTone: 0x8d5524, hair: 0x1a1a1a,
    variants: [[0x5b6b3a, 0x3b4226, 0x8a6f3e, 0x3b3a2a], [0x2f5d3a, 0x1f3d26, 0xd4a017, 0x1f2a1a], [0xe5e7eb, 0x9ca3af, 0x374151, 0x6b7280]] },
  { id: "o_ninja", kind: "ninja", price: 800, skinTone: 0xf1c27d, hair: 0x111111, female: true,
    variants: [[0x1c1c22, 0x111111, 0xd62828, 0x111111], [0x1e3a8a, 0x0f172a, 0x38bdf8, 0x0f172a], [0xf5f5f4, 0xd6d3d1, 0xdc2626, 0xe7e5e4]] },
  { id: "o_astronaut", kind: "astronaut", price: 1000, skinTone: 0xc68642, hair: 0x6b3e26, female: true,
    variants: [[0xe3e6ea, 0xf2f2f2, 0xff8c1a, 0xf2f2f2], [0x1f2937, 0x374151, 0x22d3ee, 0x111827], [0xfde68a, 0xfef3c7, 0x2563eb, 0xfef3c7]] },
  { id: "o_cyber", kind: "cyber", price: 1400, skinTone: 0xa1665e, hair: 0xf0f0f0,
    variants: [[0x3a1f6b, 0x141428, 0x00ffff, 0x141428, true], [0x7f1d1d, 0x1c0a0a, 0xff3b3b, 0x1c0a0a, true], [0x064e3b, 0x022c22, 0x39ff14, 0x022c22, true]] },
  { id: "o_royal", kind: "royal", price: 2000, skinTone: 0xffdbac, hair: 0xd4a017,
    variants: [[0x8b1e3f, 0x5a1128, 0xffd23a, 0xffd23a], [0x1e3a8a, 0x172554, 0xffd23a, 0xffd23a], [0x14532d, 0x052e16, 0xe5e7eb, 0xe5e7eb]] },
];

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

// Every skin of every character (the first one of each keeps the old outfit id).
export const OUTFITS: Outfit[] = HEROES.flatMap((h) =>
  h.variants.map(([suit, suit2, accent, glove, glow], i) => ({
    id: i === 0 ? h.id : `${h.id}_${i + 1}`,
    name: `skin.${h.id}` as Key,
    hero: h.kind,
    heroName: `hero.${h.kind}` as Key,
    base: h.id,
    variant: i,
    price: i === 0 ? h.price : VARIANT_PRICE,
    glove,
    sleeve: suit,
    suit2,
    band: accent,
    skinTone: h.skinTone,
    hair: h.hair,
    female: h.female,
    glow,
  }))
);
export const CHARACTERS = OUTFITS.filter((o) => o.variant === 0);
export const skinsOf = (base: string) => OUTFITS.filter((o) => o.base === base);

export type SkinState = { owned: string[]; weapon: string; outfit: string };
export const DEFAULT_SKINS: SkinState = { owned: [], weapon: "w_default", outfit: "o_soldier" };

export const weaponSkin = (id?: string) => WEAPON_SKINS.find((s) => s.id === id) ?? WEAPON_SKINS[0];
export const outfit = (id?: string) => OUTFITS.find((s) => s.id === id) ?? OUTFITS[0];
export const isExclusive = (id: string) => !!WEAPON_SKINS.find((s) => s.id === id)?.exclusive;
// null: unknown or not for sale (exclusive rewards).
export const skinPrice = (id: string) => (isExclusive(id) ? null : ((WEAPON_SKINS.find((s) => s.id === id) ?? OUTFITS.find((s) => s.id === id))?.price ?? null));
export const ownsSkin = (s: SkinState, id: string) =>
  s.owned.includes(id) || (!isExclusive(id) && skinPrice(id) === 0 && !OUTFITS.some((o) => o.id === id && o.variant > 0));
// A character's extra skins can only be bought once the character itself is owned.
export const canBuySkin = (s: SkinState, id: string) => {
  const o = OUTFITS.find((x) => x.id === id);
  return !o || o.variant === 0 || ownsSkin(s, o.base);
};
