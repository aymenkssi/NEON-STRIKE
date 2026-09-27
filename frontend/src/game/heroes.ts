// Playable characters seen in third person: cartoon bodies in the style of the city and the
// zombies (toon shading, merged vertex-coloured parts), each with its own headgear and build,
// dressed in the colours of the equipped skin (skins.ts). About 1.8 m tall, feet at y = 0,
// facing +z. The weapon (weapons.ts, without hands) is held on the "mount" group.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { box, capsule, cone, cyl, merge, paint, sphere, toonMaterial } from "./toon";
import { outfit as outfitOf, type Outfit } from "./skins";

const rbox = (w: number, h: number, d: number, r = 0.06) => new RoundedBoxGeometry(w, h, d, 1, r);
type V = [number, number, number];

// A cylinder between two points (limbs).
function limb(a: V, b: V, r1: number, r2 = r1) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = cyl(r2, r1, len, 8);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  const m = A.add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

type Built = {
  upper: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
  leg: THREE.BufferGeometry;
  glass: boolean;
};
const cache = new Map<string, Built>();

// Right hand (character's right = -x when facing +z) holds the grip; left hand the handguard.
// Shooting stance: the body turned a little to the right of the aim, the weapon still on it,
// so that it shows beside the shoulder in third person.
export const STANCE = 0.35;

export const GRIP: V = [-0.17, 1.36, 0.24];
const SUPPORT: V = [-0.1, 1.39, 0.5];

function build(o: Outfit): Built {
  const up: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, c: number, at?: Parameters<typeof paint>[2]) => up.push(paint(g, c, at));
  const lit = (g: THREE.BufferGeometry, c: number, at?: Parameters<typeof paint>[2]) => (o.glow ? glow : up).push(paint(g, c, at));
  const w = o.female ? 0.9 : 1; // build
  const dark = new THREE.Color(o.suit2).multiplyScalar(0.7).getHex();

  // Torso (y 0.95 … 1.5): suit, vest / armour, belt, accent stripe, backpack.
  add(rbox(0.46 * w, 0.56, 0.28, 0.08), o.sleeve, { y: 1.22 });
  add(rbox(0.48 * w, 0.34, 0.3, 0.06), o.suit2, { y: 1.28, z: 0.01 });
  lit(box(0.49 * w, 0.04, 0.31), o.band, { y: 1.16, z: 0.01 });
  add(rbox(0.47 * w, 0.09, 0.29, 0.03), 0x2a2320, { y: 0.97 });
  add(rbox(0.3, 0.34, 0.14, 0.05), dark, { y: 1.25, z: -0.2 }); // backpack
  if (o.hero === "royal") add(box(0.5, 0.95, 0.03), o.suit2, { y: 1.0, z: -0.19, rx: 0.1 }); // cape
  // Neck and head.
  add(cyl(0.065, 0.075, 0.1, 8), o.skinTone, { y: 1.54 });
  add(rbox(0.24, 0.27, 0.25, 0.09), o.skinTone, { y: 1.7 });
  add(box(0.04, 0.035, 0.02), 0x1a1a1a, { x: 0.055, y: 1.72, z: 0.125 });
  add(box(0.04, 0.035, 0.02), 0x1a1a1a, { x: -0.055, y: 1.72, z: 0.125 });

  // Headgear and hair per character.
  switch (o.hero) {
    case "soldier":
      add(sphere(0.165, 12, 8), o.suit2, { y: 1.78, sy: 0.75 });
      add(box(0.34, 0.03, 0.3), o.suit2, { y: 1.74 });
      lit(box(0.22, 0.04, 0.02), o.band, { y: 1.82, z: 0.15 }); // goggles on the helmet
      break;
    case "commando":
      add(sphere(0.15, 12, 8), o.band, { x: 0.03, y: 1.84, sy: 0.35, rz: -0.25 }); // beret
      add(rbox(0.22, 0.09, 0.08, 0.03), o.hair, { y: 1.6, z: 0.1 }); // beard
      add(box(0.25, 0.06, 0.26), o.hair, { y: 1.8 });
      break;
    case "ninja":
      add(rbox(0.26, 0.29, 0.27, 0.1), o.suit2, { y: 1.71 }); // hood / mask
      add(box(0.2, 0.05, 0.02), o.skinTone, { y: 1.72, z: 0.135 }); // eye slit
      add(box(0.04, 0.035, 0.02), 0x1a1a1a, { x: 0.05, y: 1.72, z: 0.146 });
      add(box(0.04, 0.035, 0.02), 0x1a1a1a, { x: -0.05, y: 1.72, z: 0.146 });
      lit(box(0.28, 0.035, 0.28), o.band, { y: 1.79 }); // headband
      add(capsule(0.04, 0.22, 5), o.hair, { y: 1.62, z: -0.19, rx: 0.5 }); // ponytail
      lit(box(0.03, 0.2, 0.01), o.band, { x: 0.05, y: 1.7, z: -0.16, rx: 0.4 });
      break;
    case "astronaut":
      add(box(0.25, 0.08, 0.26), o.hair, { y: 1.82 });
      add(cyl(0.17, 0.17, 0.06, 14), o.band, { y: 1.55 }); // collar ring
      break;
    case "cyber":
      add(box(0.05, 0.1, 0.24), o.hair, { y: 1.87 }); // mohawk
      lit(box(0.25, 0.045, 0.03), o.band, { y: 1.73, z: 0.12 }); // visor
      lit(box(0.02, 0.3, 0.02), o.band, { x: 0.22 * w, y: 1.24, z: 0.15 }); // neon lines
      lit(box(0.02, 0.3, 0.02), o.band, { x: -0.22 * w, y: 1.24, z: 0.15 });
      break;
    case "royal":
      add(box(0.26, 0.08, 0.26), o.hair, { y: 1.82 });
      add(box(0.26, 0.14, 0.05), o.hair, { y: 1.68, z: -0.12 });
      lit(cyl(0.13, 0.13, 0.06, 12), o.band, { y: 1.88 }); // crown
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        lit(cone(0.025, 0.07, 5), o.band, { x: Math.cos(a) * 0.11, y: 1.94, z: Math.sin(a) * 0.11 });
      }
      break;
  }
  if (o.female && o.hero !== "ninja" && o.hero !== "astronaut") add(box(0.26, 0.2, 0.06), o.hair, { y: 1.66, z: -0.12 });

  // Arms holding the weapon: shoulder → elbow → hand, gloves at the hands.
  const shR: V = [-0.27 * w, 1.44, 0.0];
  const shL: V = [0.27 * w, 1.44, 0.0];
  const elR: V = [-0.34 * w, 1.2, 0.08];
  const elL: V = [0.12, 1.24, 0.3];
  up.push(paint(limb(shR, elR, 0.065), o.sleeve), paint(limb(elR, GRIP, 0.055), o.sleeve));
  up.push(paint(limb(shL, elL, 0.065), o.sleeve), paint(limb(elL, SUPPORT, 0.055), o.sleeve));
  add(sphere(0.07, 8, 6), o.sleeve, { x: shR[0], y: shR[1], z: shR[2] });
  add(sphere(0.07, 8, 6), o.sleeve, { x: shL[0], y: shL[1], z: shL[2] });
  add(sphere(0.05, 8, 6), o.glove, { x: GRIP[0], y: GRIP[1], z: GRIP[2] });
  add(sphere(0.05, 8, 6), o.glove, { x: SUPPORT[0], y: SUPPORT[1], z: SUPPORT[2] });
  lit(cyl(0.058, 0.058, 0.035, 8), o.band, { x: GRIP[0], y: GRIP[1] + 0.04, z: GRIP[2] - 0.05, rx: 1.1 });

  // Leg (pivot at the hip, hanging along -y): pants, knee pad, boot.
  const leg = merge([
    paint(capsule(0.085, 0.5, 6), o.suit2, { y: -0.36 }),
    paint(rbox(0.13, 0.1, 0.06, 0.03), dark, { y: -0.42, z: 0.07 }),
    paint(rbox(0.15, 0.13, 0.27, 0.05), 0x1f1f1f, { y: -0.83, z: 0.05 }),
  ]);
  return { upper: merge(up), glow: glow.length ? merge(glow) : null, leg, glass: o.hero === "astronaut" };
}

let glowMat: THREE.Material | null = null;
let glassMat: THREE.Material | null = null;

export type Hero = {
  group: THREE.Group;
  upper: THREE.Group; // pivots at the hips: leans with the aim
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  mount: THREE.Group; // weapon holder at the right hand
};

export function buildHero(outfitId?: string): Hero {
  const o = outfitOf(outfitId);
  let b = cache.get(o.id);
  if (!b) {
    b = build(o);
    cache.set(o.id, b);
  }
  glowMat ??= new THREE.MeshBasicMaterial({ vertexColors: true });
  glassMat ??= new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.2, depthWrite: false });
  const mat = toonMaterial();
  const group = new THREE.Group();
  const upper = new THREE.Group();
  upper.position.y = 0.95;
  const body = new THREE.Mesh(b.upper, mat);
  body.position.y = -0.95;
  upper.add(body);
  if (b.glow) {
    const g = new THREE.Mesh(b.glow, glowMat);
    g.position.y = -0.95;
    upper.add(g);
  }
  if (b.glass) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), glassMat);
    bubble.position.y = 1.72 - 0.95;
    upper.add(bubble);
  }
  const mount = new THREE.Group();
  mount.position.set(GRIP[0], GRIP[1] - 0.95 + 0.02, GRIP[2] - 0.02);
  mount.rotation.y = Math.PI + STANCE; // weapon models point along -z, the character faces +z
  upper.add(mount);
  const leftLeg = new THREE.Mesh(b.leg, mat);
  leftLeg.position.set(0.11, 0.9, 0);
  const rightLeg = new THREE.Mesh(b.leg, mat);
  rightLeg.position.set(-0.11, 0.9, 0);
  group.add(upper, leftLeg, rightLeg);
  // Soft round shadow under the feet.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.position.y = 0.03;
  group.add(shadow);
  // Shots never hit the player's own body.
  group.traverse((obj) => (obj.raycast = () => {}));
  return { group, upper, leftLeg, rightLeg, mount };
}
