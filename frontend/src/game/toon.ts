// Cartoon rendering helpers: stepped ("toon") shading and vertex-coloured geometry merged into
// as few meshes as possible (one draw call per material), which keeps the cities fast on phones.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

let gradient: THREE.DataTexture | null = null;

// 4 light steps: the flat, bright look of cartoon shooters.
function gradientMap() {
  if (!gradient) {
    const steps = [90, 160, 220, 255];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
    gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function toonMaterial(opts: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: gradientMap(), vertexColors: true, ...opts });
}

const tmpColor = new THREE.Color();

// Paints a whole geometry in one colour (vertex colours), optionally moved/rotated/scaled first.
export function paint(
  geo: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  at?: { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number }
): THREE.BufferGeometry {
  const g = geo;
  if (at) {
    if (at.sx !== undefined || at.sy !== undefined || at.sz !== undefined) g.scale(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
    if (at.rx) g.rotateX(at.rx);
    if (at.ry) g.rotateY(at.ry);
    if (at.rz) g.rotateZ(at.rz);
    g.translate(at.x ?? 0, at.y ?? 0, at.z ?? 0);
  }
  tmpColor.set(color);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // Merging needs the same attributes everywhere: keep position / normal / color only.
  for (const name of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(name)) g.deleteAttribute(name);
  return g.index ? g.toNonIndexed() : g;
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.BufferGeometry();
}

// Shorthands for the primitives the city and the characters are made of.
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const sphere = (r: number, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
export const capsule = (r: number, len: number, seg = 6) => new THREE.CapsuleGeometry(r, len, 2, seg);
export const cone = (r: number, h: number, seg = 10) => new THREE.ConeGeometry(r, h, seg);

// Deterministic random numbers: the same level always gets the same city layout.
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
