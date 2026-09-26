// Cartoon zombies: rounded shapes, big heads, glowing eyes, one look per kind.
// Each zombie is 6 to 8 meshes (head, eyes, torso, 2 arms, 2 legs, + a glow for exploders and
// spitters, + a riot shield). Hits on the mesh named "Shield" are blocked by the engine.
// Geometry is built once per kind and shared; each zombie gets its own material so a hit can
// flash it red. Every head part is named "Head": the engine counts hits on it as headshots.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ZombieKind } from "./content";
import { box, capsule, cone, cyl, merge, paint, sphere, toonMaterial } from "./toon";

export type CharacterKind = ZombieKind | "boss";

type Look = {
  skin: number;
  shirt: number;
  pants: number;
  shoes: number;
  eyes: number;
  extra?: "hood" | "helmet" | "belly" | "crown" | "sac" | "riot";
  bulk: number; // torso/limb thickness
};

const LOOKS: Record<CharacterKind, Look> = {
  walker: { skin: 0x86c96b, shirt: 0x3f7fd1, pants: 0x3b3f6b, shoes: 0x2a2320, eyes: 0xfff35c, bulk: 1 },
  runner: { skin: 0xa3d88d, shirt: 0xff7a2f, pants: 0x2d3a48, shoes: 0xf2f2f2, eyes: 0x6dfaff, extra: "hood", bulk: 0.85 },
  tank: { skin: 0x8f7fd4, shirt: 0x5b5f66, pants: 0x3a2f55, shoes: 0x1e1e24, eyes: 0xff5a36, extra: "helmet", bulk: 1.3 },
  exploder: { skin: 0xc6d65a, shirt: 0x7a5a3a, pants: 0x4a3a2a, shoes: 0x2a2320, eyes: 0xff9b1f, extra: "belly", bulk: 1.15 },
  spitter: { skin: 0xb5d94a, shirt: 0x6b4fa0, pants: 0x3a3350, shoes: 0x2a2320, eyes: 0xd4ff3a, extra: "sac", bulk: 0.95 },
  shield: { skin: 0x9bb7c4, shirt: 0x243447, pants: 0x1f2a38, shoes: 0x111418, eyes: 0x6dfaff, extra: "riot", bulk: 1.1 },
  boss: { skin: 0x7b4fd0, shirt: 0x1f1b2e, pants: 0x2a1f3f, shoes: 0x111111, eyes: 0xff2d55, extra: "crown", bulk: 1.2 },
};

const rbox = (w: number, h: number, d: number, r = 0.08) => new RoundedBoxGeometry(w, h, d, 1, r);

type Parts = {
  head: THREE.BufferGeometry;
  eyes: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  glow?: THREE.BufferGeometry;
  shield?: THREE.BufferGeometry;
};
const cache = new Map<CharacterKind, Parts>();

function build(kind: CharacterKind): Parts {
  const L = LOOKS[kind];
  const b = L.bulk;
  const darker = new THREE.Color(L.skin).multiplyScalar(0.7).getHex();

  // Head: big rounded block with brow, open jaw and teeth (head centre at y = 1.75).
  const head = [
    paint(rbox(0.56, 0.54, 0.52, 0.14), L.skin, { y: 1.78 }),
    paint(rbox(0.5, 0.1, 0.1, 0.04), darker, { y: 1.9, z: 0.25 }), // brow
    paint(rbox(0.4, 0.14, 0.12, 0.05), 0x3a1020, { y: 1.6, z: 0.24 }), // mouth
    paint(box(0.3, 0.05, 0.04), 0xf5f1e6, { y: 1.655, z: 0.305 }), // teeth
    paint(sphere(0.06, 6, 4), darker, { x: 0.3, y: 1.8 }), // ears
    paint(sphere(0.06, 6, 4), darker, { x: -0.3, y: 1.8 }),
  ];
  if (L.extra === "hood") head.push(paint(rbox(0.66, 0.5, 0.58, 0.18), L.shirt, { y: 1.86, z: -0.05 }));
  if (L.extra === "helmet") {
    head.push(paint(rbox(0.64, 0.26, 0.6, 0.12), 0x6d7480, { y: 2.02 }));
    head.push(paint(box(0.66, 0.05, 0.3), 0x4a505a, { y: 1.93, z: 0.2 }));
  }
  if (L.extra === "riot") {
    // Police helmet with a raised visor (the face stays open for headshots).
    head.push(paint(rbox(0.66, 0.34, 0.62, 0.15), 0x1f2a38, { y: 2.0 }));
    head.push(paint(box(0.6, 0.06, 0.22), 0x6dfaff, { y: 2.18, z: 0.2, rx: -0.5 }));
  }
  if (L.extra === "crown") {
    head.push(paint(cyl(0.3, 0.3, 0.16, 10), 0xffc233, { y: 2.11 }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      head.push(paint(cone(0.07, 0.22, 6), 0xffc233, { x: Math.cos(a) * 0.24, y: 2.29, z: Math.sin(a) * 0.24 }));
    }
  }
  // Glowing eyes (own unlit material).
  const eyes = merge([
    paint(sphere(0.085, 8, 6), L.eyes, { x: 0.13, y: 1.8, z: 0.24 }),
    paint(sphere(0.085, 8, 6), L.eyes, { x: -0.13, y: 1.8, z: 0.24 }),
  ]);

  // Torso: shirt with a torn hem, belt; neck.
  const torso = [
    paint(rbox(0.56 * b, 0.62, 0.32 * b, 0.1), L.shirt, { y: 1.18 }),
    paint(box(0.16 * b, 0.1, 0.02), L.shirt, { x: -0.12, y: 0.84, z: 0.1 }),
    paint(box(0.12 * b, 0.12, 0.02), L.shirt, { x: 0.14, y: 0.85, z: 0.1 }),
    paint(rbox(0.57 * b, 0.1, 0.33 * b, 0.04), 0x3a2a1a, { y: 0.9 }),
    paint(cyl(0.1, 0.12, 0.14, 8), L.skin, { y: 1.52 }),
    paint(box(0.18, 0.12, 0.02), darker, { x: 0.1, y: 1.3, z: 0.165 * b }), // rip showing skin
  ];
  let glow: THREE.BufferGeometry | undefined;
  if (L.extra === "belly") glow = merge([paint(sphere(0.3, 10, 7), 0xffb13b, { y: 1.1, z: 0.12, sz: 0.8 })]);
  // Spitter: swollen glowing throat sac full of acid.
  if (L.extra === "sac") glow = merge([paint(sphere(0.22, 10, 7), 0x9dff2e, { y: 1.5, z: 0.16, sy: 0.8 })]);
  // Riot shield held in front: from the knees to the chin, the head stays above it.
  let shield: THREE.BufferGeometry | undefined;
  if (L.extra === "riot")
    shield = merge([
      paint(rbox(0.92, 1.12, 0.07, 0.03), 0x39434f, { y: 1.02, z: 0.52 }),
      paint(rbox(0.7, 0.3, 0.02, 0.02), 0x8fd8ff, { y: 1.36, z: 0.565 }), // window
      paint(box(0.8, 0.06, 0.02), 0xffd23a, { y: 0.72, z: 0.565 }), // yellow stripe
      paint(box(0.8, 0.06, 0.02), 0xffd23a, { y: 0.62, z: 0.565 }),
    ]);

  // Arm (pivot at the shoulder, hanging down along -y; the engine raises it to point forward).
  const arm = merge([
    paint(capsule(0.1 * b, 0.34, 5), L.shirt, { y: -0.2 }),
    paint(capsule(0.085 * b, 0.3, 5), L.skin, { y: -0.52 }),
    paint(sphere(0.11 * b, 7, 5), L.skin, { y: -0.74, sy: 0.9 }),
  ]);
  // Leg (pivot at the hip).
  const leg = merge([
    paint(capsule(0.12 * b, 0.5, 5), L.pants, { y: -0.36 }),
    paint(rbox(0.2 * b, 0.12, 0.3, 0.05), L.shoes, { y: -0.74, z: 0.05 }),
  ]);
  return { head: merge(head), eyes, torso: merge(torso), arm, leg, glow, shield };
}

function parts(kind: CharacterKind) {
  let p = cache.get(kind);
  if (!p) {
    p = build(kind);
    cache.set(kind, p);
  }
  return p;
}

let shadowGeo: THREE.CircleGeometry | null = null;
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const noRaycast = () => {};

export function buildZombie(kind: CharacterKind) {
  const p = parts(kind);
  const g = new THREE.Group();
  const mat = toonMaterial({ emissive: 0x000000 });
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true });

  const head = new THREE.Mesh(p.head, mat);
  head.name = "Head";
  const eyes = new THREE.Mesh(p.eyes, eyeMat);
  eyes.name = "Head";
  const torso = new THREE.Mesh(p.torso, mat);
  g.add(head, eyes, torso);
  if (p.glow) {
    const glow = new THREE.Mesh(p.glow, new THREE.MeshBasicMaterial({ vertexColors: true }));
    glow.name = "Glow"; // the spitter's sac swells before it spits
    g.add(glow);
  }
  if (p.shield) {
    const shield = new THREE.Mesh(p.shield, mat);
    shield.name = "Shield";
    g.add(shield);
  }

  const b = LOOKS[kind].bulk;
  const leftArm = new THREE.Mesh(p.arm, mat);
  leftArm.position.set(0.36 * b, 1.42, 0);
  leftArm.rotation.x = -Math.PI / 2;
  const rightArm = new THREE.Mesh(p.arm, mat);
  rightArm.position.set(-0.36 * b, 1.42, 0);
  rightArm.rotation.x = -Math.PI / 2;
  const leftLeg = new THREE.Mesh(p.leg, mat);
  leftLeg.position.set(0.15 * b, 0.84, 0);
  const rightLeg = new THREE.Mesh(p.leg, mat);
  rightLeg.position.set(-0.15 * b, 0.84, 0);
  g.add(leftArm, rightArm, leftLeg, rightLeg);

  // Soft round shadow under the feet (never hit by shots).
  shadowGeo ??= new THREE.CircleGeometry(0.55, 16).rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.03;
  shadow.raycast = noRaycast;
  g.add(shadow);

  return { group: g, limbs: { leftLeg, rightLeg, leftArm, rightArm } };
}

// Shared geometry stays cached; only the per-zombie materials are freed.
export function disposeZombie(g: THREE.Object3D) {
  g.traverse((o: any) => {
    if (o.material && o.material !== shadowMat) o.material.dispose();
  });
}
