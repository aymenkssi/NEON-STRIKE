// First-person weapon models in a cartoon style, each with its rarity colour (green, blue,
// purple, gold) and a gloved hand on the grip. Units are metres: barrel along -z, grip near the
// origin. The muzzle sits at z = MUZZLE[key] (used for the flash and the grenade launch point).
import * as THREE from "three";
import { box, cyl, merge, paint, sphere, toonMaterial } from "./toon";

export const MUZZLE: Record<string, number> = {
  shotgun: -0.62,
  smg: -0.5,
  rifle: -0.78,
  railgun: -0.84,
  minigun: -0.74,
  launcher: -0.66,
};

const GREY = 0x4a4f5a;
const DARK = 0x2a2d35;
const WOOD = 0xc9783a;
const GLOVE = 0x2e3440;
const SLEEVE = 0x3f6fbf;
const RARITY = { common: 0xb8bfc9, uncommon: 0x5fd35f, rare: 0x3a9bff, epic: 0xb45cff, legendary: 0xffb13b };

type G = THREE.BufferGeometry[];
const Z = (geo: THREE.BufferGeometry) => geo.rotateX(Math.PI / 2); // cylinders along z

function hand(parts: G, gripZ: number) {
  parts.push(paint(sphere(0.06, 8, 6), GLOVE, { x: 0, y: -0.11, z: gripZ, sx: 1.1, sy: 1.3 }));
  parts.push(paint(cyl(0.055, 0.07, 0.34, 8), SLEEVE, { x: 0.05, y: -0.2, z: gripZ + 0.14, rx: -1.05 }));
}

function shotgun(parts: G) {
  const c = RARITY.uncommon;
  parts.push(
    paint(box(0.09, 0.1, 0.34), GREY, { y: 0, z: -0.08 }), // receiver
    paint(Z(cyl(0.028, 0.028, 0.46, 10)), DARK, { y: 0.03, z: -0.38 }), // barrel
    paint(Z(cyl(0.032, 0.032, 0.3, 10)), DARK, { y: -0.02, z: -0.36 }), // magazine tube
    paint(box(0.08, 0.07, 0.18), WOOD, { y: -0.03, z: -0.36 }), // pump
    paint(box(0.075, 0.13, 0.26), WOOD, { y: -0.04, z: 0.2, rx: -0.2 }), // stock
    paint(box(0.06, 0.12, 0.06), WOOD, { y: -0.09, z: 0.06, rx: 0.25 }), // grip
    paint(box(0.095, 0.03, 0.2), c, { y: 0.06, z: -0.1 }), // rarity stripe
    paint(Z(cyl(0.034, 0.034, 0.04, 10)), c, { y: 0.03, z: -0.6 })
  );
  hand(parts, 0.06);
}

function smg(parts: G) {
  const c = RARITY.rare;
  parts.push(
    paint(box(0.09, 0.12, 0.36), GREY, { z: -0.12 }),
    paint(box(0.095, 0.04, 0.3), c, { y: 0.07, z: -0.12 }),
    paint(Z(cyl(0.022, 0.022, 0.16, 10)), DARK, { y: 0.01, z: -0.38 }),
    paint(box(0.05, 0.2, 0.07), DARK, { y: -0.14, z: -0.14 }), // magazine
    paint(box(0.055, 0.12, 0.06), GREY, { y: -0.1, z: 0.04, rx: 0.2 }), // grip
    paint(box(0.04, 0.05, 0.16), DARK, { y: -0.02, z: 0.12 }), // stock
    paint(box(0.02, 0.04, 0.03), c, { y: 0.1, z: -0.26 }) // sight
  );
  hand(parts, 0.04);
}

function rifle(parts: G) {
  const c = RARITY.epic;
  parts.push(
    paint(box(0.08, 0.11, 0.5), GREY, { z: -0.16 }),
    paint(box(0.085, 0.035, 0.36), c, { y: 0.065, z: -0.2 }),
    paint(Z(cyl(0.02, 0.02, 0.28, 10)), DARK, { y: 0.01, z: -0.6 }),
    paint(Z(cyl(0.035, 0.035, 0.06, 10)), c, { y: 0.01, z: -0.76 }), // muzzle brake
    paint(box(0.05, 0.18, 0.08), DARK, { y: -0.13, z: -0.16, rx: -0.25 }), // curved mag
    paint(box(0.055, 0.12, 0.06), GREY, { y: -0.1, z: 0.04, rx: 0.2 }),
    paint(box(0.07, 0.1, 0.22), DARK, { y: -0.02, z: 0.2 }), // stock
    paint(Z(cyl(0.03, 0.03, 0.2, 10)), DARK, { y: 0.11, z: -0.14 }), // scope
    paint(Z(cyl(0.032, 0.032, 0.02, 10)), 0x7fd8ff, { y: 0.11, z: -0.245 })
  );
  hand(parts, 0.04);
}

function railgun(parts: G) {
  const c = RARITY.legendary;
  parts.push(
    paint(box(0.1, 0.12, 0.46), 0xe8e8ee, { z: -0.14 }),
    paint(box(0.105, 0.04, 0.4), c, { y: 0.07, z: -0.16 }),
    paint(box(0.03, 0.03, 0.46), DARK, { x: 0.035, y: 0.02, z: -0.6 }), // twin rails
    paint(box(0.03, 0.03, 0.46), DARK, { x: -0.035, y: 0.02, z: -0.6 }),
    paint(box(0.055, 0.13, 0.06), GREY, { y: -0.1, z: 0.04, rx: 0.2 }),
    paint(box(0.08, 0.1, 0.18), 0xe8e8ee, { y: -0.01, z: 0.18 })
  );
  hand(parts, 0.04);
}

function minigun(parts: G) {
  const c = RARITY.epic;
  parts.push(
    paint(box(0.16, 0.16, 0.3), GREY, { z: -0.06 }),
    paint(box(0.165, 0.05, 0.24), c, { y: 0.09, z: -0.06 }),
    paint(box(0.12, 0.14, 0.14), c, { x: 0.12, y: -0.04, z: -0.02 }), // ammo box
    paint(Z(cyl(0.09, 0.09, 0.05, 12)), DARK, { z: -0.24 }),
    paint(box(0.05, 0.12, 0.06), DARK, { y: -0.12, z: 0.06, rx: 0.2 })
  );
  hand(parts, 0.06);
}

function minigunBarrels() {
  const b: G = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.push(paint(Z(cyl(0.017, 0.017, 0.46, 8)), DARK, { x: Math.cos(a) * 0.055, y: Math.sin(a) * 0.055, z: -0.24 }));
  }
  b.push(paint(Z(cyl(0.08, 0.08, 0.03, 12)), GREY, { z: -0.4 }));
  b.push(paint(Z(cyl(0.08, 0.08, 0.03, 12)), RARITY.epic, { z: -0.47 }));
  return merge(b);
}

function launcher(parts: G) {
  const c = RARITY.rare;
  parts.push(
    paint(Z(cyl(0.075, 0.075, 0.72, 14)), 0x5a7a4a, { y: 0.02, z: -0.3 }),
    paint(Z(cyl(0.085, 0.085, 0.08, 14)), c, { y: 0.02, z: -0.64 }),
    paint(Z(cyl(0.085, 0.085, 0.06, 14)), c, { y: 0.02, z: 0.02 }),
    paint(box(0.05, 0.14, 0.06), DARK, { y: -0.1, z: 0.04, rx: 0.2 }),
    paint(box(0.04, 0.12, 0.05), DARK, { y: -0.08, z: -0.34 }), // front grip
    paint(box(0.03, 0.05, 0.08), 0xffd23a, { y: 0.11, z: -0.2 }) // sight
  );
  hand(parts, 0.04);
}

const BUILDERS: Record<string, (p: G) => void> = { shotgun, smg, rifle, railgun, minigun, launcher };
const cache = new Map<string, THREE.BufferGeometry>();
let barrelsGeo: THREE.BufferGeometry | null = null;
let material: THREE.Material | null = null;

// Glowing parts that stay bright: railgun coils, scope lens.
let coils: THREE.BufferGeometry | null = null;
function glowParts(key: string) {
  if (key !== "railgun") return null;
  if (!coils) {
    const g: G = [];
    for (let i = 0; i < 4; i++) g.push(paint(new THREE.TorusGeometry(0.045, 0.012, 6, 12), 0x6df6ff, { y: 0.02, z: -0.42 - i * 0.1 }));
    coils = merge(g);
  }
  return coils;
}

export function buildWeaponModel(key: string): THREE.Group {
  material ??= toonMaterial();
  let geo = cache.get(key);
  if (!geo) {
    const parts: G = [];
    (BUILDERS[key] ?? shotgun)(parts);
    geo = merge(parts);
    cache.set(key, geo);
  }
  const model = new THREE.Group();
  model.add(new THREE.Mesh(geo, material));
  const glow = glowParts(key);
  if (glow) model.add(new THREE.Mesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true })));
  if (key === "minigun") {
    barrelsGeo ??= minigunBarrels();
    const barrels = new THREE.Mesh(barrelsGeo, material);
    barrels.name = "barrels";
    model.add(barrels);
  }
  return model;
}
