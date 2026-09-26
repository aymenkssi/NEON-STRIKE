// First-person weapon models in a cartoon style, each with its rarity colour (green, blue,
// purple, gold) and a gloved hand on the grip. Units are metres: barrel along -z, grip near the
// origin. The muzzle sits at z = MUZZLE[key] (used for the flash and the grenade launch point).
// Colours come from the equipped weapon skin and outfit (see skins.ts).
import * as THREE from "three";
import { box, cyl, merge, paint, sphere, toonMaterial } from "./toon";
import { outfit as outfitOf, weaponSkin, type Outfit, type WeaponSkin } from "./skins";

export const MUZZLE: Record<string, number> = {
  shotgun: -0.62,
  smg: -0.5,
  rifle: -0.78,
  railgun: -0.84,
  minigun: -0.74,
  launcher: -0.66,
};

const RARITY = { common: 0xb8bfc9, uncommon: 0x5fd35f, rare: 0x3a9bff, epic: 0xb45cff, legendary: 0xffb13b };

type G = THREE.BufferGeometry[];
const Z = (geo: THREE.BufferGeometry) => geo.rotateX(Math.PI / 2); // cylinders along z

// Everything a builder needs: lit parts, glowing parts, the palette and the accent helper.
class Kit {
  parts: G = [];
  glow: G = [];
  constructor(
    public s: WeaponSkin,
    public o: Outfit
  ) {}
  add(geo: THREE.BufferGeometry, color: number, at?: Parameters<typeof paint>[2]) {
    this.parts.push(paint(geo, color, at));
  }
  // Stripes and rings: the skin's accent (or the weapon's rarity colour), glowing on some skins.
  accent(geo: THREE.BufferGeometry, rarity: number, at?: Parameters<typeof paint>[2]) {
    (this.s.glow ? this.glow : this.parts).push(paint(geo, this.s.accent ?? rarity, at));
  }
  hand(gripZ: number) {
    const o = this.o;
    this.add(sphere(0.06, 8, 6), o.glove, { x: 0, y: -0.11, z: gripZ, sx: 1.1, sy: 1.3 });
    this.add(cyl(0.055, 0.07, 0.34, 8), o.sleeve, { x: 0.05, y: -0.2, z: gripZ + 0.14, rx: -1.05 });
    // Cuff at the wrist, in the outfit's trim colour.
    (o.glow ? this.glow : this.parts).push(paint(cyl(0.064, 0.064, 0.05, 8), o.band, { x: 0.012, y: -0.135, z: gripZ + 0.03, rx: -1.05 }));
  }
}

function shotgun(k: Kit) {
  const { s } = k;
  const c = RARITY.uncommon;
  k.add(box(0.09, 0.1, 0.34), s.body, { y: 0, z: -0.08 }); // receiver
  k.add(Z(cyl(0.028, 0.028, 0.46, 10)), s.metal, { y: 0.03, z: -0.38 }); // barrel
  k.add(Z(cyl(0.032, 0.032, 0.3, 10)), s.metal, { y: -0.02, z: -0.36 }); // magazine tube
  k.add(box(0.08, 0.07, 0.18), s.furniture, { y: -0.03, z: -0.36 }); // pump
  k.add(box(0.075, 0.13, 0.26), s.furniture, { y: -0.04, z: 0.2, rx: -0.2 }); // stock
  k.add(box(0.06, 0.12, 0.06), s.furniture, { y: -0.09, z: 0.06, rx: 0.25 }); // grip
  k.accent(box(0.095, 0.03, 0.2), c, { y: 0.06, z: -0.1 }); // rarity stripe
  k.accent(Z(cyl(0.034, 0.034, 0.04, 10)), c, { y: 0.03, z: -0.6 });
  k.hand(0.06);
}

function smg(k: Kit) {
  const { s } = k;
  const c = RARITY.rare;
  k.add(box(0.09, 0.12, 0.36), s.body, { z: -0.12 });
  k.accent(box(0.095, 0.04, 0.3), c, { y: 0.07, z: -0.12 });
  k.add(Z(cyl(0.022, 0.022, 0.16, 10)), s.metal, { y: 0.01, z: -0.38 });
  k.add(box(0.05, 0.2, 0.07), s.metal, { y: -0.14, z: -0.14 }); // magazine
  k.add(box(0.055, 0.12, 0.06), s.body, { y: -0.1, z: 0.04, rx: 0.2 }); // grip
  k.add(box(0.04, 0.05, 0.16), s.metal, { y: -0.02, z: 0.12 }); // stock
  k.accent(box(0.02, 0.04, 0.03), c, { y: 0.1, z: -0.26 }); // sight
  k.hand(0.04);
}

function rifle(k: Kit) {
  const { s } = k;
  const c = RARITY.epic;
  k.add(box(0.08, 0.11, 0.5), s.body, { z: -0.16 });
  k.accent(box(0.085, 0.035, 0.36), c, { y: 0.065, z: -0.2 });
  k.add(Z(cyl(0.02, 0.02, 0.28, 10)), s.metal, { y: 0.01, z: -0.6 });
  k.accent(Z(cyl(0.035, 0.035, 0.06, 10)), c, { y: 0.01, z: -0.76 }); // muzzle brake
  k.add(box(0.05, 0.18, 0.08), s.metal, { y: -0.13, z: -0.16, rx: -0.25 }); // curved mag
  k.add(box(0.055, 0.12, 0.06), s.body, { y: -0.1, z: 0.04, rx: 0.2 });
  k.add(box(0.07, 0.1, 0.22), s.metal, { y: -0.02, z: 0.2 }); // stock
  k.add(Z(cyl(0.03, 0.03, 0.2, 10)), s.metal, { y: 0.11, z: -0.14 }); // scope
  k.add(Z(cyl(0.032, 0.032, 0.02, 10)), 0x7fd8ff, { y: 0.11, z: -0.245 });
  k.hand(0.04);
}

function railgun(k: Kit) {
  const { s } = k;
  const c = RARITY.legendary;
  k.add(box(0.1, 0.12, 0.46), s.light, { z: -0.14 });
  k.accent(box(0.105, 0.04, 0.4), c, { y: 0.07, z: -0.16 });
  k.add(box(0.03, 0.03, 0.46), s.metal, { x: 0.035, y: 0.02, z: -0.6 }); // twin rails
  k.add(box(0.03, 0.03, 0.46), s.metal, { x: -0.035, y: 0.02, z: -0.6 });
  k.add(box(0.055, 0.13, 0.06), s.body, { y: -0.1, z: 0.04, rx: 0.2 });
  k.add(box(0.08, 0.1, 0.18), s.light, { y: -0.01, z: 0.18 });
  // Glowing coils around the rails.
  for (let i = 0; i < 4; i++) k.glow.push(paint(new THREE.TorusGeometry(0.045, 0.012, 6, 12), s.glow ? (s.accent ?? 0x6df6ff) : 0x6df6ff, { y: 0.02, z: -0.42 - i * 0.1 }));
  k.hand(0.04);
}

function minigun(k: Kit) {
  const { s } = k;
  const c = RARITY.epic;
  k.add(box(0.16, 0.16, 0.3), s.body, { z: -0.06 });
  k.accent(box(0.165, 0.05, 0.24), c, { y: 0.09, z: -0.06 });
  k.accent(box(0.12, 0.14, 0.14), c, { x: 0.12, y: -0.04, z: -0.02 }); // ammo box
  k.add(Z(cyl(0.09, 0.09, 0.05, 12)), s.metal, { z: -0.24 });
  k.add(box(0.05, 0.12, 0.06), s.metal, { y: -0.12, z: 0.06, rx: 0.2 });
  k.hand(0.06);
}

function minigunBarrels(k: Kit) {
  const { s } = k;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.add(Z(cyl(0.017, 0.017, 0.46, 8)), s.metal, { x: Math.cos(a) * 0.055, y: Math.sin(a) * 0.055, z: -0.24 });
  }
  k.add(Z(cyl(0.08, 0.08, 0.03, 12)), s.body, { z: -0.4 });
  k.accent(Z(cyl(0.08, 0.08, 0.03, 12)), RARITY.epic, { z: -0.47 });
}

function launcher(k: Kit) {
  const { s } = k;
  const c = RARITY.rare;
  k.add(Z(cyl(0.075, 0.075, 0.72, 14)), s.tube, { y: 0.02, z: -0.3 });
  k.accent(Z(cyl(0.085, 0.085, 0.08, 14)), c, { y: 0.02, z: -0.64 });
  k.accent(Z(cyl(0.085, 0.085, 0.06, 14)), c, { y: 0.02, z: 0.02 });
  k.add(box(0.05, 0.14, 0.06), s.metal, { y: -0.1, z: 0.04, rx: 0.2 });
  k.add(box(0.04, 0.12, 0.05), s.metal, { y: -0.08, z: -0.34 }); // front grip
  k.add(box(0.03, 0.05, 0.08), 0xffd23a, { y: 0.11, z: -0.2 }); // sight
  k.hand(0.04);
}

const BUILDERS: Record<string, (k: Kit) => void> = { shotgun, smg, rifle, railgun, minigun, launcher };
type Built = { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry | null; barrels?: { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } };
const cache = new Map<string, Built>();
let material: THREE.Material | null = null;
let glowMaterial: THREE.Material | null = null;

const finish = (k: Kit) => ({ solid: merge(k.parts), glow: k.glow.length ? merge(k.glow) : null });

export function buildWeaponModel(key: string, skinId?: string, outfitId?: string): THREE.Group {
  material ??= toonMaterial();
  glowMaterial ??= new THREE.MeshBasicMaterial({ vertexColors: true });
  const skin = weaponSkin(skinId);
  const out = outfitOf(outfitId);
  const id = `${key}|${skin.id}|${out.id}`;
  let built = cache.get(id);
  if (!built) {
    const k = new Kit(skin, out);
    (BUILDERS[key] ?? shotgun)(k);
    built = finish(k);
    if (key === "minigun") {
      const b = new Kit(skin, out);
      minigunBarrels(b);
      built.barrels = finish(b);
    }
    cache.set(id, built);
  }
  const model = new THREE.Group();
  model.add(new THREE.Mesh(built.solid, material));
  if (built.glow) model.add(new THREE.Mesh(built.glow, glowMaterial));
  if (built.barrels) {
    const barrels = new THREE.Group();
    barrels.name = "barrels";
    barrels.add(new THREE.Mesh(built.barrels.solid, material));
    if (built.barrels.glow) barrels.add(new THREE.Mesh(built.barrels.glow, glowMaterial));
    model.add(barrels);
  }
  return model;
}
