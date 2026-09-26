// First-person weapon models, built from the side silhouettes of real weapons (receiver, curved
// magazines, stocks, rails, sights) extruded with bevelled edges, with metal, wood and polymer
// materials. Units are metres: barrel along -z, the pistol grip near the origin, and a gloved
// hand on the grip. The muzzle sits at z = MUZZLE[key] (used for the flash and projectiles).
// Colours: the weapon's real finish with the standard skin, else the equipped skin (skins.ts).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { box, cyl, merge, paint, sphere } from "./toon";
import { outfit as outfitOf, weaponSkin, type Outfit, type WeaponSkin } from "./skins";

type P = [number, number][]; // side profile: [forward distance, height]

export const MUZZLE: Record<string, number> = {
  pistol: -0.105,
  shotgun: -0.62,
  mp5: -0.365,
  m16: -0.74,
  m4: -0.545,
  ak47: -0.72,
  sniper: -1.03,
  launcher: -0.5,
  minigun: -0.7,
  rpg: -0.66,
};

// How each weapon is held in view (scale and offset of the model).
export const VIEW: Record<string, { scale: number; x: number; y: number; z: number }> = {
  pistol: { scale: 1.45, x: -0.02, y: 0.02, z: -0.2 },
  shotgun: { scale: 0.8, x: 0.03, y: -0.02, z: -0.14 },
  mp5: { scale: 1.0, x: 0.02, y: -0.01, z: -0.16 },
  m16: { scale: 0.78, x: 0.03, y: -0.02, z: -0.12 },
  m4: { scale: 0.85, x: 0.03, y: -0.02, z: -0.14 },
  ak47: { scale: 0.8, x: 0.03, y: -0.02, z: -0.13 },
  sniper: { scale: 0.66, x: 0.04, y: -0.03, z: -0.1 },
  launcher: { scale: 0.85, x: 0.03, y: 0.0, z: -0.14 },
  minigun: { scale: 0.8, x: 0.04, y: 0.02, z: -0.12 },
  rpg: { scale: 0.8, x: 0.05, y: 0.02, z: -0.12 },
};

// Real finishes (standard skin): receiver, small metal parts, furniture (wood / polymer), tube.
const REAL: Record<string, { body: number; metal: number; furniture: number; tube: number }> = {
  pistol: { body: 0x2a2c30, metal: 0x1b1c1f, furniture: 0x222326, tube: 0x2a2c30 },
  shotgun: { body: 0x26282c, metal: 0x1c1d20, furniture: 0x8b5a2b, tube: 0x26282c },
  mp5: { body: 0x25272a, metal: 0x1a1b1e, furniture: 0x1f2023, tube: 0x25272a },
  m16: { body: 0x2b2d31, metal: 0x1c1d20, furniture: 0x1f2023, tube: 0x2b2d31 },
  m4: { body: 0x2b2d31, metal: 0x1c1d20, furniture: 0x232427, tube: 0x2b2d31 },
  ak47: { body: 0x303236, metal: 0x1f2124, furniture: 0x7a3b1a, tube: 0x303236 },
  sniper: { body: 0x3a3d33, metal: 0x1d1f21, furniture: 0x25272a, tube: 0x3a3d33 },
  launcher: { body: 0x2b2d31, metal: 0x1c1d20, furniture: 0x232427, tube: 0x33362e },
  minigun: { body: 0x34373c, metal: 0x1d1f22, furniture: 0x4b5320, tube: 0x34373c },
  rpg: { body: 0x3c3f36, metal: 0x1f2124, furniture: 0x8a4b22, tube: 0x3c3f36 },
};

// ---------------------------------------------------------------- geometry helpers
const Z = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2); // cylinders along z

function shapeOf(pts: P) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

// Extrudes a side profile to `width` (centred on x = 0), bevelled for soft machined edges.
function prof(pts: P, width: number, bevel = 0.003, hole?: P) {
  const s = shapeOf(pts);
  if (hole) {
    const h = new THREE.Path();
    h.moveTo(hole[0][0], hole[0][1]);
    for (let i = 1; i < hole.length; i++) h.lineTo(hole[i][0], hole[i][1]);
    h.closePath();
    s.holes.push(h);
  }
  const depth = Math.max(0.001, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2); // profile forward axis → -z, extrusion → x
  return g;
}

// ---------------------------------------------------------------- builder kit
class Kit {
  metal: THREE.BufferGeometry[] = [];
  matte: THREE.BufferGeometry[] = [];
  glow: THREE.BufferGeometry[] = [];
  c: { body: number; metal: number; furniture: number; tube: number };
  constructor(
    key: string,
    public s: WeaponSkin,
    public o: Outfit,
    public withHand = true
  ) {
    const real = REAL[key] ?? REAL.m4;
    this.c = s.id === "w_default" ? real : { body: s.body, metal: s.metal, furniture: s.furniture, tube: s.tube };
  }
  // Metal parts (lit with some shine) and matte parts (wood, polymer, rubber, cloth).
  m(g: THREE.BufferGeometry, color: number, at?: Parameters<typeof paint>[2]) {
    this.metal.push(paint(g, color, at));
  }
  f(g: THREE.BufferGeometry, color: number, at?: Parameters<typeof paint>[2]) {
    this.matte.push(paint(g, color, at));
  }
  // Skin accents (stripes): none on the real finish; glowing on neon-style skins.
  accent(g: THREE.BufferGeometry, at?: Parameters<typeof paint>[2]) {
    if (this.s.accent === null) {
      g.dispose();
      return;
    }
    (this.s.glow ? this.glow : this.matte).push(paint(g, this.s.accent, at));
  }
  // Helpers in weapon coordinates: forward distance fa..fb, height ya..yb.
  bx(fa: number, fb: number, ya: number, yb: number, w: number, color: number, metal = true, x = 0) {
    (metal ? this.metal : this.matte).push(paint(box(w, yb - ya, fb - fa), color, { x, y: (ya + yb) / 2, z: -(fa + fb) / 2 }));
  }
  tube(fa: number, fb: number, r: number, y: number, color: number, metal = true, x = 0, seg = 12, r2 = r) {
    (metal ? this.metal : this.matte).push(paint(Z(cyl(r2, r, fb - fa, seg)), color, { x, y, z: -(fa + fb) / 2 }));
  }
  // Picatinny rail: base + teeth.
  rail(fa: number, fb: number, y: number, w: number) {
    this.bx(fa, fb, y, y + 0.006, w * 0.75, this.c.metal);
    for (let f = fa + 0.004; f < fb - 0.004; f += 0.01) this.bx(f, f + 0.005, y + 0.006, y + 0.011, w, this.c.metal);
  }
  triggerGuard(fa: number, fb: number, ya: number, yb: number, color = this.c.metal) {
    this.m(prof([[fa, ya], [fb, ya], [fb, yb + 0.008], [fb - 0.015, yb], [fa, yb]], 0.01, 0.001, [[fa + 0.005, ya - 0.004], [fb - 0.005, ya - 0.004], [fb - 0.005, yb + 0.009], [fb - 0.018, yb + 0.004], [fa + 0.005, yb + 0.004]]), color);
    this.bx(fa + 0.018, fa + 0.024, yb + 0.01, ya, 0.005, this.c.metal); // trigger
  }
  pistolGrip(f: number, y: number, color = this.c.furniture) {
    this.f(prof([[f - 0.02, y], [f + 0.022, y], [f + 0.008, y - 0.1], [f - 0.03, y - 0.107], [f - 0.037, y - 0.09]], 0.03, 0.004), color);
  }
  // Gloved hand on the grip, sleeve going back to the camera.
  hand(f: number, y: number) {
    if (!this.withHand) return;
    const o = this.o;
    this.f(new RoundedBoxGeometry(0.052, 0.085, 0.066, 1, 0.018), o.glove, { x: 0.004, y, z: -f, rx: 0.22 });
    this.f(sphere(0.017, 8, 6), o.glove, { x: -0.028, y: y + 0.03, z: -f - 0.012 }); // thumb
    this.f(cyl(0.05, 0.062, 0.34, 10), o.sleeve, { x: 0.05, y: y - 0.1, z: -f + 0.15, rx: -1.05 });
    (o.glow ? this.glow : this.matte).push(paint(cyl(0.056, 0.056, 0.04, 10), o.band, { x: 0.016, y: y - 0.035, z: -f + 0.03, rx: -1.05 }));
  }
}

// ---------------------------------------------------------------- weapons
function pistol(k: Kit) {
  const { c } = k;
  k.m(prof([[-0.09, 0.0], [0.1, 0.0], [0.1, 0.03], [-0.085, 0.03], [-0.09, 0.025]], 0.026, 0.002), c.body); // slide
  for (let i = 0; i < 5; i++) k.bx(-0.082 + i * 0.007, -0.079 + i * 0.007, 0.008, 0.026, 0.0275, c.metal); // serrations
  k.bx(0.0, 0.035, 0.024, 0.031, 0.02, c.metal); // ejection port
  k.tube(0.095, 0.106, 0.0065, 0.016, c.metal);
  k.f(prof([[-0.085, 0.0], [0.095, 0.0], [0.095, -0.012], [0.02, -0.016], [-0.085, -0.012]], 0.024, 0.002), c.furniture); // frame
  k.f(prof([[-0.085, -0.005], [-0.035, -0.005], [-0.045, -0.1], [-0.05, -0.115], [-0.095, -0.115], [-0.1, -0.03]], 0.028, 0.004), c.furniture); // grip
  k.triggerGuard(-0.035, 0.03, -0.012, -0.045, c.furniture);
  k.bx(0.085, 0.092, 0.03, 0.037, 0.004, c.metal); // front sight
  k.bx(-0.082, -0.07, 0.03, 0.038, 0.016, c.metal); // rear sight
  k.accent(box(0.0265, 0.006, 0.12), { y: 0.015, z: -0.01 });
  k.hand(-0.065, -0.06);
}

function shotgun(k: Kit) {
  const { c } = k;
  k.m(prof([[-0.09, -0.015], [0.1, -0.015], [0.1, 0.05], [-0.07, 0.055], [-0.09, 0.04]], 0.042), c.body); // receiver
  k.tube(0.1, 0.62, 0.011, 0.038, c.metal); // barrel
  k.bx(0.1, 0.61, 0.049, 0.053, 0.008, c.metal); // vent rib
  k.tube(0.1, 0.5, 0.012, 0.008, c.metal); // magazine tube
  k.tube(0.5, 0.515, 0.013, 0.008, c.metal);
  k.f(prof([[0.2, -0.012], [0.37, -0.012], [0.37, 0.028], [0.2, 0.028]], 0.05, 0.007), c.furniture); // pump
  const groove = new THREE.Color(c.furniture).multiplyScalar(0.6).getHex();
  for (let i = 0; i < 7; i++) k.bx(0.22 + i * 0.02, 0.224 + i * 0.02, -0.014, 0.03, 0.052, groove, false);
  k.f(prof([[-0.085, 0.045], [-0.09, -0.015], [-0.13, -0.045], [-0.4, -0.085], [-0.41, -0.08], [-0.41, 0.035], [-0.4, 0.04], [-0.16, 0.05]], 0.042, 0.005), c.furniture); // stock
  k.f(prof([[-0.41, -0.08], [-0.425, -0.082], [-0.425, 0.037], [-0.41, 0.035]], 0.044, 0.003), 0x151515); // butt pad
  k.triggerGuard(-0.03, 0.05, -0.015, -0.05);
  k.m(sphere(0.003, 6, 4), 0xd8b25a, { y: 0.056, z: -0.61 }); // bead
  k.accent(box(0.0425, 0.01, 0.13), { y: 0.025, z: -0.015 });
  k.hand(-0.11, -0.045);
}

function mp5(k: Kit) {
  const { c } = k;
  k.m(prof([[-0.1, -0.005], [0.19, -0.005], [0.19, 0.045], [0.17, 0.055], [-0.08, 0.055], [-0.1, 0.045]], 0.04, 0.004), c.body);
  k.m(Z(cyl(0.014, 0.014, 0.03, 10)).rotateY(Math.PI / 2), c.metal, { y: 0.068, z: 0.07 }); // drum rear sight
  k.bx(-0.08, -0.06, 0.055, 0.062, 0.02, c.metal);
  k.tube(0.29, 0.305, 0.014, 0.07, c.metal); // front sight hood
  k.bx(0.285, 0.31, 0.05, 0.062, 0.02, c.metal);
  k.f(prof([[0.19, -0.01], [0.33, -0.005], [0.335, 0.035], [0.19, 0.045]], 0.046, 0.009), c.furniture); // handguard
  k.tube(0.33, 0.365, 0.009, 0.02, c.metal); // barrel
  k.tube(0.34, 0.36, 0.011, 0.02, c.metal, true, 0, 6); // lugs
  k.m(prof([[0.06, -0.005], [0.095, -0.005], [0.105, -0.06], [0.125, -0.15], [0.095, -0.16], [0.075, -0.07]], 0.024, 0.002), c.metal); // curved magazine
  k.bx(0.055, 0.1, -0.02, -0.005, 0.03, c.body);
  k.f(prof([[-0.06, -0.005], [0.05, -0.005], [0.05, -0.025], [-0.06, -0.025]], 0.034), c.furniture); // trigger group
  k.pistolGrip(-0.04, -0.02);
  k.triggerGuard(-0.015, 0.045, -0.025, -0.055, c.furniture);
  k.tube(-0.3, -0.1, 0.006, 0.04, c.metal, true, 0.014, 8); // retractable stock rods
  k.tube(-0.3, -0.1, 0.006, 0.04, c.metal, true, -0.014, 8);
  k.f(prof([[-0.315, -0.05], [-0.295, -0.05], [-0.295, 0.055], [-0.315, 0.055]], 0.04), c.furniture);
  k.accent(box(0.0405, 0.008, 0.2), { y: 0.024, z: -0.045 });
  k.hand(-0.05, -0.06);
}

function ar15(k: Kit, long: boolean) {
  const { c } = k;
  const end = long ? 0.72 : 0.52;
  k.m(prof([[-0.09, 0.0], [0.13, 0.0], [0.13, 0.055], [-0.09, 0.055]], 0.04), c.body); // upper receiver
  k.bx(0.0, 0.07, 0.02, 0.04, 0.0405, c.metal); // ejection port cover
  k.m(prof([[-0.09, 0.0], [0.12, 0.0], [0.12, -0.03], [0.05, -0.038], [-0.05, -0.038], [-0.09, -0.02]], 0.038), c.body); // lower receiver
  k.bx(0.045, 0.115, -0.05, -0.03, 0.036, c.body); // magwell
  k.m(prof([[0.05, -0.035], [0.11, -0.035], [0.115, -0.1], [0.13, -0.175], [0.075, -0.185], [0.06, -0.11]], 0.026, 0.002), c.metal); // magazine
  k.pistolGrip(-0.045, -0.03);
  k.triggerGuard(-0.02, 0.045, -0.035, -0.06);
  if (long) {
    // M16: carry handle, long round handguard with cooling ribs, fixed full stock.
    k.m(prof([[-0.08, 0.055], [0.1, 0.055], [0.1, 0.068], [0.08, 0.1], [-0.06, 0.1], [-0.08, 0.085]], 0.02, 0.002, [[-0.05, 0.063], [0.07, 0.063], [0.06, 0.088], [-0.04, 0.088]]), c.body);
    k.tube(0.13, 0.46, 0.03, 0.028, c.furniture, false, 0, 14);
    for (let f = 0.15; f < 0.45; f += 0.03) k.tube(f, f + 0.006, 0.031, 0.028, new THREE.Color(c.furniture).multiplyScalar(0.7).getHex(), false, 0, 14);
    k.f(prof([[-0.09, 0.052], [-0.09, -0.02], [-0.14, -0.03], [-0.42, -0.075], [-0.42, 0.05]], 0.04, 0.005), c.furniture);
    k.f(prof([[-0.42, -0.075], [-0.432, -0.076], [-0.432, 0.051], [-0.42, 0.05]], 0.042, 0.002), 0x151515);
  } else {
    // M4: flat-top rail, octagonal rail handguard, flip-up rear sight, collapsible stock.
    k.rail(-0.08, 0.36, 0.055, 0.022);
    k.tube(0.13, 0.36, 0.03, 0.028, c.furniture, false, 0, 8);
    k.rail(0.14, 0.35, 0.058, 0.02);
    k.bx(-0.08, -0.055, 0.066, 0.09, 0.02, c.metal); // rear sight
    k.tube(-0.28, -0.09, 0.015, 0.03, c.metal); // buffer tube
    k.f(prof([[-0.19, 0.052], [-0.33, 0.05], [-0.335, -0.075], [-0.29, -0.075], [-0.21, -0.005], [-0.19, 0.0]], 0.042, 0.005), c.furniture);
  }
  const fs = long ? 0.47 : 0.37;
  k.m(prof([[fs, 0.05], [fs + 0.04, 0.05], [fs + 0.03, 0.12], [fs + 0.015, 0.12]], 0.018, 0.002), c.metal); // front sight
  k.tube(long ? 0.46 : 0.36, end, 0.0085, 0.028, c.metal); // barrel
  k.tube(end - 0.02, end + 0.025, 0.011, 0.028, c.metal, true, 0, 6); // flash hider
  k.bx(-0.105, -0.085, 0.045, 0.055, 0.03, c.metal); // charging handle
  k.accent(box(0.0405, 0.008, 0.2), { y: 0.016, z: -0.02 });
  k.hand(-0.05, -0.075);
}

function ak47(k: Kit) {
  const { c } = k;
  k.m(prof([[-0.12, 0.0], [0.2, 0.0], [0.2, 0.05], [0.16, 0.062], [-0.1, 0.062], [-0.12, 0.05]], 0.045), c.body); // receiver + dust cover
  k.bx(0.08, 0.14, 0.032, 0.05, 0.047, c.metal); // ejection port
  k.bx(0.1, 0.16, 0.04, 0.05, 0.012, c.metal, true, 0.03); // charging handle
  k.m(prof([[0.14, 0.062], [0.2, 0.062], [0.2, 0.075], [0.15, 0.072]], 0.02, 0.002), c.metal); // rear sight
  k.f(prof([[0.2, -0.005], [0.43, 0.0], [0.43, 0.042], [0.2, 0.048]], 0.05, 0.007), c.furniture); // lower handguard
  k.f(prof([[0.2, 0.048], [0.4, 0.05], [0.4, 0.072], [0.21, 0.075]], 0.036, 0.006), c.furniture); // upper handguard
  k.tube(0.4, 0.46, 0.008, 0.062, c.metal); // gas tube end
  k.m(prof([[0.43, 0.02], [0.47, 0.02], [0.47, 0.075], [0.45, 0.075]], 0.02, 0.002), c.metal); // gas block
  k.tube(0.43, 0.7, 0.011, 0.03, c.metal); // barrel
  k.m(prof([[0.62, 0.02], [0.65, 0.02], [0.645, 0.085], [0.63, 0.085]], 0.016, 0.002), c.metal); // front sight
  k.tube(0.66, 0.72, 0.014, 0.03, c.metal, true, 0, 8); // slant brake
  k.m(prof([[0.1, 0.0], [0.16, 0.0], [0.17, -0.06], [0.2, -0.13], [0.235, -0.19], [0.18, -0.21], [0.145, -0.15], [0.12, -0.08], [0.105, -0.03]], 0.03, 0.003), c.metal); // banana magazine
  k.pistolGrip(-0.005, 0.0);
  k.triggerGuard(0.03, 0.1, 0.0, -0.03);
  k.f(prof([[-0.12, 0.05], [-0.12, 0.0], [-0.16, -0.02], [-0.4, -0.07], [-0.4, 0.03], [-0.14, 0.06]], 0.04, 0.005), c.furniture); // stock
  k.m(prof([[-0.4, -0.07], [-0.41, -0.071], [-0.41, 0.031], [-0.4, 0.03]], 0.042, 0.002), c.metal); // butt plate
  k.accent(box(0.0455, 0.008, 0.22), { y: 0.02, z: -0.04 });
  k.hand(-0.01, -0.05);
}

function sniper(k: Kit) {
  const { c } = k;
  k.m(prof([[-0.16, -0.01], [0.3, -0.01], [0.3, 0.07], [-0.14, 0.07], [-0.16, 0.05]], 0.052), c.body);
  k.rail(-0.12, 0.28, 0.07, 0.024);
  k.tube(0.3, 0.52, 0.021, 0.035, c.body, true, 0, 8); // barrel shroud
  k.tube(0.3, 0.95, 0.013, 0.035, c.metal); // barrel
  k.bx(0.95, 1.03, 0.012, 0.058, 0.05, c.metal); // muzzle brake
  for (const f of [0.965, 0.99, 1.012]) k.bx(f, f + 0.01, 0.016, 0.054, 0.052, 0x0c0c0c);
  // Scope with rings, turrets and a blue lens.
  k.tube(-0.06, 0.2, 0.02, 0.115, c.metal);
  k.tube(0.2, 0.27, 0.03, 0.115, c.metal, true, 0, 14, 0.021);
  k.tube(-0.11, -0.05, 0.02, 0.115, c.metal, true, 0, 14, 0.026); // eyepiece
  k.m(cyl(0.012, 0.012, 0.03, 10), c.metal, { y: 0.14, z: -0.09 });
  k.m(cyl(0.012, 0.012, 0.03, 10), c.metal, { x: 0.025, y: 0.115, z: -0.09, rz: Math.PI / 2 });
  k.bx(0.0, 0.02, 0.075, 0.1, 0.03, c.metal);
  k.bx(0.15, 0.17, 0.075, 0.1, 0.03, c.metal);
  k.f(Z(cyl(0.027, 0.027, 0.003, 16)), 0x2f5f9e, { y: 0.115, z: -0.271 });
  k.bx(0.05, 0.14, -0.1, -0.01, 0.04, c.metal); // magazine
  k.pistolGrip(-0.05, -0.01);
  k.triggerGuard(-0.025, 0.04, -0.01, -0.04);
  k.m(prof([[-0.16, 0.06], [-0.16, -0.02], [-0.2, -0.04], [-0.44, -0.07], [-0.46, -0.07], [-0.46, 0.06]], 0.05, 0.005), c.body); // stock
  k.bx(-0.4, -0.22, 0.06, 0.085, 0.04, c.furniture, false); // cheek rest
  k.f(prof([[-0.46, -0.07], [-0.475, -0.07], [-0.475, 0.06], [-0.46, 0.06]], 0.052, 0.002), 0x151515);
  k.tube(0.4, 0.75, 0.006, -0.005, c.metal, true, 0.02, 8); // folded bipod
  k.tube(0.4, 0.75, 0.006, -0.005, c.metal, true, -0.02, 8);
  k.accent(box(0.0525, 0.01, 0.38), { y: 0.02, z: -0.07 });
  k.hand(-0.055, -0.065);
}

function launcher(k: Kit) {
  const { c } = k;
  k.m(Z(cyl(0.065, 0.065, 0.13, 12)), c.tube, { y: 0.0, z: -0.105 }); // revolving drum
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.f(Z(cyl(0.017, 0.017, 0.004, 10)), 0x0d0d0d, { x: Math.cos(a) * 0.04, y: Math.sin(a) * 0.04, z: -0.171 });
  }
  k.rail(-0.06, 0.42, 0.075, 0.02);
  k.bx(0.02, 0.18, 0.064, 0.075, 0.03, c.body);
  k.tube(0.17, 0.49, 0.032, 0.0, c.tube); // barrel
  k.tube(0.47, 0.5, 0.036, 0.0, c.metal);
  k.f(prof([[0.28, -0.03], [0.31, -0.03], [0.3, -0.12], [0.275, -0.12]], 0.028, 0.004), c.furniture); // foregrip
  k.bx(-0.07, 0.04, -0.045, -0.02, 0.03, c.body);
  k.pistolGrip(-0.045, -0.03);
  k.triggerGuard(-0.02, 0.035, -0.035, -0.06);
  k.tube(-0.3, -0.06, 0.012, 0.02, c.metal); // stock tube
  k.f(prof([[-0.33, -0.07], [-0.3, -0.07], [-0.3, 0.06], [-0.33, 0.06]], 0.04, 0.004), c.furniture);
  k.bx(0.05, 0.1, 0.085, 0.11, 0.02, c.metal); // sight
  k.accent(Z(cyl(0.0655, 0.0655, 0.02, 12)), { y: 0.0, z: -0.105 });
  k.hand(-0.05, -0.08);
}

function minigun(k: Kit) {
  const { c } = k;
  k.m(prof([[-0.12, -0.07], [0.12, -0.07], [0.14, -0.04], [0.14, 0.07], [-0.12, 0.07]], 0.12, 0.006), c.body); // housing
  k.m(Z(cyl(0.035, 0.035, 0.14, 12)), c.metal, { x: 0.08, y: 0.04, z: 0.0 }); // motor
  k.bx(-0.06, 0.1, 0.1, 0.113, 0.02, c.metal); // carry handle
  k.bx(-0.06, -0.045, 0.07, 0.1, 0.02, c.metal);
  k.bx(0.085, 0.1, 0.07, 0.1, 0.02, c.metal);
  k.bx(-0.08, 0.1, -0.22, -0.09, 0.11, c.furniture, false, -0.02); // ammo box
  k.bx(0.0, 0.06, -0.09, -0.05, 0.03, c.metal, true, -0.04); // feed chute
  k.pistolGrip(-0.09, -0.07);
  k.accent(box(0.122, 0.012, 0.2), { y: 0.02, z: 0.0 });
  k.hand(-0.095, -0.11);
}

function minigunBarrels(k: Kit) {
  const { c } = k;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.tube(0.14, 0.7, 0.009, Math.sin(a) * 0.035, c.metal, true, Math.cos(a) * 0.035, 8);
  }
  for (const f of [0.35, 0.6, 0.675]) k.tube(f, f + 0.018, 0.05, 0, c.body, true, 0, 14);
}

function rpg(k: Kit) {
  const { c } = k;
  k.tube(-0.42, 0.34, 0.024, 0.02, c.tube); // launch tube
  k.tube(-0.06, 0.16, 0.033, 0.02, c.furniture, false, 0, 14); // wooden heat shields
  k.tube(-0.56, -0.42, 0.028, 0.02, c.tube, true, 0, 14, 0.056); // flared exhaust
  k.tube(0.32, 0.345, 0.029, 0.02, c.metal);
  k.f(prof([[-0.01, -0.004], [0.03, -0.004], [0.015, -0.1], [-0.025, -0.105], [-0.03, -0.09]], 0.03, 0.004), c.furniture); // grip
  k.triggerGuard(0.03, 0.08, -0.004, -0.03);
  k.bx(-0.04, 0.08, 0.05, 0.09, 0.03, c.metal, true, -0.04); // optical sight
  k.tube(-0.08, -0.04, 0.012, 0.075, c.metal, true, -0.04);
  k.bx(0.25, 0.26, 0.044, 0.07, 0.006, c.metal); // front sight post
  k.accent(Z(cyl(0.0245, 0.0245, 0.3, 12)), { y: 0.02, z: 0.2 });
  k.hand(0.005, -0.06);
}

// The rocket, shown loaded in the tube and hidden after firing (engine: "warhead").
function warhead(k: Kit) {
  k.tube(0.34, 0.46, 0.022, 0.02, 0x4f5d2f, false);
  k.tube(0.46, 0.56, 0.042, 0.02, 0x4f5d2f, false, 0, 16);
  k.tube(0.56, 0.66, 0.004, 0.02, 0x2d2d2d, false, 0, 16, 0.042);
}

const BUILDERS: Record<string, (k: Kit) => void> = {
  pistol,
  shotgun,
  mp5,
  m16: (k) => ar15(k, true),
  m4: (k) => ar15(k, false),
  ak47,
  sniper,
  launcher,
  minigun,
  rpg,
};

type Part = { metal: THREE.BufferGeometry | null; matte: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null };
type Built = { main: Part; barrels?: Part; warhead?: Part };
const cache = new Map<string, Built>();
let metalMat: THREE.Material | null = null;
let matteMat: THREE.Material | null = null;
let glowMat: THREE.Material | null = null;

const finish = (k: Kit): Part => ({
  metal: k.metal.length ? merge(k.metal) : null,
  matte: k.matte.length ? merge(k.matte) : null,
  glow: k.glow.length ? merge(k.glow) : null,
});

function group(p: Part) {
  const g = new THREE.Group();
  if (p.metal) g.add(new THREE.Mesh(p.metal, metalMat!));
  if (p.matte) g.add(new THREE.Mesh(p.matte, matteMat!));
  if (p.glow) g.add(new THREE.Mesh(p.glow, glowMat!));
  return g;
}

// withHand: false in the Armory preview (the weapon alone).
export function buildWeaponModel(key: string, skinId?: string, outfitId?: string, withHand = true): THREE.Group {
  metalMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.38 });
  matteMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.0, roughness: 0.8 });
  glowMat ??= new THREE.MeshBasicMaterial({ vertexColors: true });
  const skin = weaponSkin(skinId);
  const out = outfitOf(outfitId);
  const k0 = BUILDERS[key] ? key : "m4";
  const id = `${k0}|${skin.id}|${out.id}|${withHand ? 1 : 0}`;
  let built = cache.get(id);
  if (!built) {
    const k = new Kit(k0, skin, out, withHand);
    BUILDERS[k0](k);
    built = { main: finish(k) };
    if (k0 === "minigun") {
      const b = new Kit(k0, skin, out);
      minigunBarrels(b);
      built.barrels = finish(b);
    }
    if (k0 === "rpg") {
      const w = new Kit(k0, skin, out);
      warhead(w);
      built.warhead = finish(w);
    }
    cache.set(id, built);
  }
  const model = group(built.main);
  if (built.barrels) {
    const barrels = group(built.barrels);
    barrels.name = "barrels";
    model.add(barrels);
  }
  if (built.warhead) {
    const w = group(built.warhead);
    w.name = "warhead";
    model.add(w);
  }
  return model;
}
