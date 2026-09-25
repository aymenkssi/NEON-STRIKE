// Builds the arena of a level: a city square in one of the 6 world cities, closed by rows of
// buildings, with 4 streets the zombies come from and the city's landmark on the horizon.
//
// Everything static is vertex-coloured and merged into 2 meshes (lit by the sun / glowing), so a
// whole city costs a handful of draw calls. Collisions use invisible boxes, one per row of
// buildings or per big prop; shots are stopped by them too.
import * as THREE from "three";
import { CITIES, LIGHTING, cityOfLevel, timeOfLevel, type CityDef, type Lighting, type TimeOfDay } from "./cities";
import { box, capsule, cone, cyl, merge, paint, seeded, sphere, toonMaterial } from "./toon";

export const PLAZA = 44; // half size of the square
const STREET = 7; // half width of a street
const WALK = 9; // street + sidewalk
const STREET_END = 112;

export type World = {
  group: THREE.Group;
  colliders: THREE.Mesh[];
  spawnPoints: THREE.Vector3[];
  lighting: Lighting;
  city: CityDef;
  time: TimeOfDay;
  update: (delta: number, time: number) => void;
};

type Rnd = () => number;
// Flat panel facing +z (2 triangles): windows, signs and frames on facades.
const pane = (w: number, h: number) => new THREE.PlaneGeometry(w, h);
const pick = <T,>(r: Rnd, list: T[]) => list[Math.floor(r() * list.length) % list.length];
const between = (r: Rnd, a: number, b: number) => a + r() * (b - a);

// Collects geometry in a local frame, then places it in the world with one matrix.
class Parts {
  solid: THREE.BufferGeometry[] = [];
  glow: THREE.BufferGeometry[] = [];
  add(geo: THREE.BufferGeometry, color: number, at?: Parameters<typeof paint>[2]) {
    this.solid.push(paint(geo, color, at));
  }
  light(geo: THREE.BufferGeometry, color: number, at?: Parameters<typeof paint>[2]) {
    this.glow.push(paint(geo, color, at));
  }
  place(target: Parts, x: number, z: number, ry = 0, s = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));
    for (const g of this.solid) target.solid.push(g.applyMatrix4(m));
    for (const g of this.glow) target.glow.push(g.applyMatrix4(m));
    this.solid = [];
    this.glow = [];
  }
}

const LIT_WINDOWS = [0xffd27a, 0xffe7a8, 0xfff2cf, 0xffc46b, 0xbfe9ff];

// ---------------------------------------------------------------- buildings
// Local frame: facade on the plane z = 0 facing +z, width along x (centred), body in z < 0.
function windowsGrid(p: Parts, r: Rnd, w: number, floors: number, floorH: number, y0: number, cols: number, winW: number, winH: number, glass: number, night: boolean, frame?: number) {
  const step = w / cols;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + step * (c + 0.5);
      const y = y0 + f * floorH + floorH * 0.5;
      if (frame !== undefined) p.add(pane(winW + 0.3, winH + 0.3), frame, { x, y, z: 0.03 });
      if (night && r() < 0.62) p.light(pane(winW, winH), pick(r, LIT_WINDOWS), { x, y, z: 0.06 });
      else p.add(pane(winW, winH), glass, { x, y, z: 0.06 });
    }
  }
}

function shopFront(p: Parts, r: Rnd, w: number, city: CityDef, night: boolean) {
  const awning = pick(r, [0xd63a3a, 0x2f8f5f, 0x2f6fd6, 0xf2b01e, 0x8a3ab9]);
  p.add(box(w * 0.8, 2.6, 0.15), 0x2a2f3a, { y: 1.6, z: 0.05 });
  if (night) p.light(pane(w * 0.74, 2.2), 0xffe2a0, { y: 1.55, z: 0.14 });
  else p.add(pane(w * 0.74, 2.2), 0x9cc9e8, { y: 1.55, z: 0.14 });
  p.add(box(w * 0.86, 0.25, 1.6), awning, { y: 3.25, z: 0.8, rx: 0.25 });
  if (city.style === "tokyo") p.light(box(w * 0.6, 0.7, 0.2), pick(r, city.trims), { y: 3.9, z: 0.12 });
}

// Far skyline: body, roof and a few bands of windows only.
function farBuilding(p: Parts, r: Rnd, city: CityDef, w: number, d: number, h: number, night: boolean) {
  const wall = pick(r, city.walls);
  p.add(box(w, h, d), wall, { y: h / 2, z: -d / 2 });
  p.add(box(w + 0.4, 0.8, d + 0.4), pick(r, city.trims), { y: h + 0.4, z: -d / 2 });
  for (let y = 4; y < h - 2; y += 4.5) {
    if (night && r() < 0.6) p.light(pane(w * 0.8, 1.4), pick(r, LIT_WINDOWS), { y, z: 0.05 });
    else p.add(pane(w * 0.8, 1.4), 0x7f9fc0, { y, z: 0.05 });
  }
}

function building(p: Parts, r: Rnd, city: CityDef, w: number, d: number, h: number, night: boolean) {
  const wall = pick(r, city.walls);
  const trim = pick(r, city.trims);
  switch (city.style) {
    case "haussmann": {
      // Cream stone, iron balconies, blue-grey mansard roof with dormers and chimneys.
      p.add(box(w, h, d), wall, { y: h / 2, z: -d / 2 });
      p.add(box(w + 0.2, 0.35, d + 0.2), 0xe6d3ad, { y: 4.1, z: -d / 2 }); // cornice
      windowsGrid(p, r, w, 4, 3, 4.4, Math.max(2, Math.round(w / 2.6)), 1.1, 1.9, 0x6f8faf, night, 0xfaf3e3);
      for (const y of [7.4, 13.4]) p.add(box(w - 0.4, 0.12, 0.7), 0x2b2f38, { y, z: 0.35 });
      p.add(box(w, 3.2, d - 1.2), city.trims[0], { y: h + 1.4, z: -d / 2 - 0.3, sz: 1 });
      p.add(box(w - 1.4, 0.4, d - 3), city.trims[1], { y: h + 3.1, z: -d / 2 - 0.3 });
      for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 2.6) p.add(box(0.9, 1.1, 0.8), 0xf5ead3, { x, y: h + 1.2, z: -0.2 });
      p.add(box(0.8, 1.6, 0.8), 0xc9a27a, { x: w / 2 - 1, y: h + 3.4, z: -d / 2 });
      shopFront(p, r, w, city, night);
      break;
    }
    case "skyscraper": {
      const tiers = h > 45 ? 3 : 1;
      let tw = w;
      let td = d;
      let y = 0;
      const glassy = r() < 0.5;
      for (let t = 0; t < tiers; t++) {
        const th = tiers === 1 ? h : t === 0 ? h * 0.5 : h * 0.25;
        p.add(box(tw, th, td), wall, { y: y + th / 2, z: -d / 2 });
        const floors = Math.floor(th / 3.4);
        if (glassy) {
          for (let c = 0; c < Math.round(tw / 1.6); c++) {
            const x = -tw / 2 + 0.8 + c * 1.6;
            if (night && r() < 0.55) p.light(pane(0.9, th - 1), pick(r, LIT_WINDOWS), { x, y: y + th / 2, z: -d / 2 + td / 2 + 0.05 });
            else p.add(pane(0.9, th - 1), 0x8fb8dc, { x, y: y + th / 2, z: -d / 2 + td / 2 + 0.05 });
          }
        } else {
          const g = new Parts();
          windowsGrid(g, r, tw, floors, 3.4, y, Math.max(2, Math.round(tw / 2.2)), 1, 1.8, 0x5d7896, night, trim);
          g.place(p, 0, -d / 2 + td / 2);
        }
        y += th;
        tw *= 0.72;
        td *= 0.72;
      }
      if (h > 60) p.add(cyl(0.25, 0.4, 12, 6), 0xd9dde3, { y: y + 6, z: -d / 2 });
      else {
        p.add(cyl(1.3, 1.3, 2.4, 10), 0x8a5a3a, { x: w / 4, y: y + 2, z: -d / 2 }); // water tank
        p.add(cone(1.4, 1, 10), 0x6b4428, { x: w / 4, y: y + 3.7, z: -d / 2 });
        for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) p.add(box(0.15, 1, 0.15), 0x3a3a3a, { x: w / 4 + dx, y: y + 0.5, z: -d / 2 + dz });
      }
      if (!glassy && wall !== 0x9aa6b8) for (let f = 1; f < Math.min(6, Math.floor(h / 3.4)); f += 1) p.add(box(3, 0.12, 1.1), 0x22252b, { x: -w / 4, y: f * 3.4, z: 0.55 }); // fire escape
      shopFront(p, r, w, city, night);
      break;
    }
    case "tokyo": {
      p.add(box(w, h, d), wall, { y: h / 2, z: -d / 2 });
      for (let y = 4; y < h - 1; y += 3.2) {
        p.add(box(w + 0.1, 0.3, 0.3), 0xb9c0cc, { y, z: 0.1 });
        if (night && r() < 0.6) p.light(pane(w - 1, 1.4), pick(r, LIT_WINDOWS), { y: y + 1.5, z: 0.06 });
        else p.add(pane(w - 1, 1.4), 0x7fa8cf, { y: y + 1.5, z: 0.06 });
      }
      // Vertical signs and rooftop billboard: they glow day and night.
      const sx = pick(r, [-1, 1]) * (w / 2 - 0.8);
      p.light(box(1.1, Math.min(10, h * 0.5), 0.5), pick(r, city.trims), { x: sx, y: h * 0.55, z: 0.5 });
      p.light(box(0.8, Math.min(8, h * 0.4) - 1, 0.55), 0xffffff, { x: sx, y: h * 0.55, z: 0.52, sx: 0.4 });
      if (r() < 0.6) {
        p.add(box(w * 0.7, 0.3, 0.3), 0x2a2a2a, { y: h + 0.2, z: -2 });
        p.light(box(w * 0.7, 3, 0.3), pick(r, city.trims), { y: h + 2, z: -2 });
      }
      for (let i = 0; i < 3; i++) p.add(box(1, 0.7, 0.6), 0xdadde2, { x: between(r, -w / 2 + 1, w / 2 - 1), y: between(r, 5, h - 2), z: 0.3 }); // AC units
      shopFront(p, r, w, city, night);
      break;
    }
    case "brick": {
      p.add(box(w, h, d), wall, { y: h / 2, z: -d / 2 });
      windowsGrid(p, r, w, Math.floor((h - 4.5) / 3.2), 3.2, 4.2, Math.max(2, Math.round(w / 2.4)), 1.1, 1.9, 0x44556a, night, 0xf2efe8);
      p.add(box(w + 0.3, 0.4, d + 0.3), 0xe7e1d3, { y: h, z: -d / 2 });
      p.add(box(w, 2.6, d * 0.7), 0x3b3f47, { y: h + 1.2, z: -d / 2, rx: 0 });
      for (const x of [-w / 3, w / 3]) {
        p.add(box(1.1, 2.2, 0.9), wall, { x, y: h + 3, z: -d / 2 });
        p.add(cyl(0.18, 0.18, 0.7, 6), 0xb5652f, { x: x - 0.25, y: h + 4.4, z: -d / 2 });
        p.add(cyl(0.18, 0.18, 0.7, 6), 0xb5652f, { x: x + 0.25, y: h + 4.4, z: -d / 2 });
      }
      // Pub front: dark green with gold sign.
      p.add(box(w * 0.85, 3.4, 0.2), 0x1f3b2c, { y: 1.9, z: 0.08 });
      p.add(box(w * 0.7, 0.6, 0.25), 0xd4a93a, { y: 3.3, z: 0.12 });
      if (night) p.light(pane(w * 0.6, 1.8), 0xffcf7a, { y: 1.5, z: 0.2 });
      else p.add(pane(w * 0.6, 1.8), 0x7fa0b8, { y: 1.5, z: 0.2 });
      break;
    }
    case "desert": {
      p.add(box(w, h, d), wall, { y: h / 2, z: -d / 2 });
      p.add(box(w + 0.2, 0.6, d + 0.2), new THREE.Color(wall).multiplyScalar(0.9).getHex(), { y: h + 0.3, z: -d / 2 });
      for (let y = 3; y < h - 1.5; y += 3.2)
        for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 2.8) {
          if (night && r() < 0.5) p.light(pane(1, 1.6), 0xffc46b, { x, y: y + 0.6, z: 0.05 });
          else p.add(pane(1, 1.6), 0x3a2a1a, { x, y: y + 0.6, z: 0.05 });
          p.add(new THREE.CircleGeometry(0.5, 8, 0, Math.PI), 0x3a2a1a, { x, y: y + 1.4, z: 0.05 });
        }
      if (r() < 0.45) p.add(box(2.2, 2.6, 0.8), trim, { x: between(r, -w / 4, w / 4), y: h * 0.6, z: 0.4 }); // mashrabiya
      if (r() < 0.3) {
        p.add(sphere(2.4, 12, 8), 0xf4ecd8, { y: h + 0.4, z: -d / 2, sy: 0.8 });
      } else if (r() < 0.15) {
        p.add(cyl(0.9, 1.1, 14, 8), 0xf0d7a8, { x: w / 3, y: h + 7, z: -d / 2 });
        p.add(cone(1.2, 3, 8), 0x3f8f7f, { x: w / 3, y: h + 15.5, z: -d / 2 });
      }
      // Market awning at street level.
      p.add(box(w * 0.8, 0.2, 2.2), pick(r, [0xd65a3a, 0x2f8f7f, 0xe6b23a]), { y: 3, z: 1.1, rx: 0.2 });
      break;
    }
    case "favela": {
      // Stacked colourful boxes with water tanks: a hillside neighbourhood.
      let y = 0;
      let lw = w;
      while (y < h) {
        const bh = between(r, 2.8, 3.6);
        const col = pick(r, city.walls);
        const off = between(r, -0.8, 0.8);
        p.add(box(lw, bh, d), col, { x: off, y: y + bh / 2, z: -d / 2 });
        for (let x = -lw / 2 + 1; x < lw / 2 - 0.6; x += 2.4) {
          if (night && r() < 0.5) p.light(pane(0.9, 1.1), pick(r, LIT_WINDOWS), { x: x + off, y: y + bh * 0.55, z: 0.05 });
          else p.add(pane(0.9, 1.1), 0x2b3a4a, { x: x + off, y: y + bh * 0.55, z: 0.05 });
        }
        y += bh;
        lw = Math.max(4, lw - between(r, 0, 2));
      }
      p.add(cyl(0.8, 0.8, 1.1, 10), 0x2b7bd6, { x: between(r, -1, 1), y: y + 0.55, z: -d / 2 });
      break;
    }
  }
}

// ---------------------------------------------------------------- props
function tree(p: Parts, city: CityDef, r: Rnd) {
  switch (city.tree) {
    case "plane":
      p.add(cyl(0.22, 0.3, 3.2, 7), 0x7a5a3a, { y: 1.6 });
      for (const [x, y, z, s] of [[0, 4.4, 0, 1.9], [0.9, 3.8, 0.4, 1.3], [-0.8, 3.9, -0.3, 1.4], [0.2, 5.2, -0.5, 1.2]]) p.add(sphere(s, 10, 8), pick(r, [0x4f9a3a, 0x5aa845, 0x468f33]), { x, y, z });
      break;
    case "cherry":
      p.add(cyl(0.2, 0.28, 2.8, 7), 0x5a3a2a, { y: 1.4 });
      for (const [x, y, z, s] of [[0, 3.8, 0, 1.8], [1, 3.3, 0.3, 1.2], [-0.9, 3.4, -0.2, 1.3], [0.2, 4.6, -0.4, 1.1]]) p.add(sphere(s, 10, 8), pick(r, [0xffb7d5, 0xff9cc6, 0xffc9df]), { x, y, z });
      break;
    case "palm": {
      let x = 0;
      for (let i = 0; i < 6; i++) {
        p.add(cyl(0.2, 0.26, 1.2, 7), i % 2 ? 0x8a6a42 : 0x9c7a4c, { x, y: 0.6 + i * 1.1 });
        x += 0.12;
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        p.add(box(0.5, 0.08, 3.2), pick(r, [0x3f9a3a, 0x4fae45]), { x: x + Math.sin(a) * 1.4, y: 6.8, z: Math.cos(a) * 1.4, rx: 0.35, ry: a });
      }
      break;
    }
    case "small":
      p.add(box(1.6, 0.8, 1.6), 0x8a8f99, { y: 0.4 });
      p.add(cyl(0.12, 0.16, 2, 6), 0x6a4a32, { y: 1.8 });
      p.add(sphere(1.1, 10, 8), 0x4f9a3a, { y: 3.2 });
      break;
  }
}

function car(p: Parts, color: number, kind: "car" | "taxi" | "cab" = "car") {
  p.add(box(1.9, 0.75, 4.3), color, { y: 0.75 });
  p.add(box(1.7, 0.7, 2.3), kind === "cab" ? 0x1f1f24 : color, { y: 1.45, z: -0.2 });
  p.add(box(1.72, 0.5, 2.1), 0x9cc9e8, { y: 1.45, z: -0.2 });
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) p.add(cyl(0.38, 0.38, 0.3, 10), 0x1a1a1a, { x, y: 0.38, z, rz: Math.PI / 2 });
  p.add(box(1.8, 0.2, 0.1), 0xfff6c8, { y: 0.85, z: 2.16 });
  if (kind === "taxi") p.add(box(0.7, 0.25, 0.3), 0xffffff, { y: 1.9, z: -0.2 });
}

function bus(p: Parts) {
  p.add(box(2.5, 4.3, 10), 0xc8102e, { y: 2.4 });
  for (const y of [1.9, 3.7]) p.add(box(2.56, 0.9, 9.4), 0x2a3440, { y });
  for (const [x, z] of [[-1.25, 3.2], [1.25, 3.2], [-1.25, -3.2], [1.25, -3.2]]) p.add(cyl(0.5, 0.5, 0.3, 10), 0x1a1a1a, { x, y: 0.5, z, rz: Math.PI / 2 });
}

function lamp(p: Parts, night: boolean, city: CityDef) {
  const pole = city.id === "paris" || city.id === "london" ? 0x1e2a24 : 0x5a5f69;
  p.add(cyl(0.1, 0.14, 5, 6), pole, { y: 2.5 });
  p.add(box(0.9, 0.12, 0.2), pole, { x: 0.35, y: 5 });
  if (night) {
    p.light(sphere(0.3, 8, 6), 0xffe3a0, { x: 0.7, y: 4.8 });
    p.light(new THREE.CircleGeometry(3.2, 16), 0xffd98a, { x: 0.7, y: 0.04, rx: -Math.PI / 2 });
  } else p.add(sphere(0.28, 8, 6), 0xf2f2f2, { x: 0.7, y: 4.8 });
}

function bench(p: Parts) {
  p.add(box(2, 0.12, 0.6), 0x8a5a34, { y: 0.55 });
  p.add(box(2, 0.5, 0.1), 0x8a5a34, { y: 0.9, z: -0.28 });
  for (const x of [-0.85, 0.85]) p.add(box(0.1, 0.55, 0.5), 0x2a2a2a, { x, y: 0.28 });
}

function centerpiece(p: Parts, city: CityDef, night: boolean) {
  switch (city.centerpiece) {
    case "fountain": {
      const stone = city.id === "rio" ? 0xf5f5f0 : 0xd9d2c4;
      p.add(cyl(4.2, 4.4, 0.9, 20), stone, { y: 0.45 });
      p.add(cyl(3.7, 3.7, 0.2, 20), 0x3fa9e0, { y: 0.8 });
      p.add(cyl(0.6, 0.9, 2.4, 10), stone, { y: 1.9 });
      p.add(cyl(1.8, 1.4, 0.4, 14), stone, { y: 3.2 });
      if (night) p.light(cone(0.6, 2.2, 8), 0xbfe9ff, { y: 4.5 });
      else p.add(cone(0.6, 2.2, 8), 0x8fd4ff, { y: 4.5 });
      break;
    }
    case "column": {
      // Trafalgar Square style: tall column, statue and 4 lions.
      p.add(box(3.4, 2.2, 3.4), 0xc9c3b3, { y: 1.1 });
      p.add(cyl(0.9, 1.1, 18, 12), 0xd9d3c3, { y: 11.2 });
      p.add(cyl(1.4, 1.2, 1.2, 10), 0xc9c3b3, { y: 21.5 });
      p.add(capsule(0.5, 1.4, 6), 0x5a6a5a, { y: 23.5 });
      p.add(sphere(0.35, 8, 6), 0x5a6a5a, { y: 24.8 });
      for (const [x, z, ry] of [[3.4, 0, Math.PI / 2], [-3.4, 0, -Math.PI / 2], [0, 3.4, 0], [0, -3.4, Math.PI]]) {
        p.add(box(1.4, 0.5, 2.6), 0xc9c3b3, { x: x * 1.6, y: 0.25, z: z * 1.6, ry });
        p.add(box(0.9, 0.9, 2), 0x4a5252, { x: x * 1.6, y: 0.95, z: z * 1.6, ry });
        p.add(sphere(0.55, 8, 6), 0x4a5252, { x: x * 1.6 + Math.sin(ry) * 0.9, y: 1.5, z: z * 1.6 + Math.cos(ry) * 0.9 });
      }
      break;
    }
    case "torii": {
      const red = 0xe0452f;
      for (const x of [-3, 3]) p.add(cyl(0.35, 0.4, 7, 10), red, { x, y: 3.5 });
      p.add(box(9, 0.6, 0.8), red, { y: 6.2 });
      p.add(box(10, 0.6, 1), 0x2a2a2a, { y: 7, rz: 0 });
      p.add(box(7.4, 0.35, 0.5), red, { y: 5 });
      for (const x of [-6, 6]) {
        p.add(box(0.9, 1.6, 0.9), 0xb8b2a6, { x, y: 0.8 });
        if (night) p.light(box(0.7, 0.7, 0.7), 0xffc46b, { x, y: 1.9 });
        else p.add(box(0.7, 0.7, 0.7), 0xe8e0d0, { x, y: 1.9 });
        p.add(cone(0.8, 0.6, 4), 0x8a847a, { x, y: 2.55, ry: Math.PI / 4 });
      }
      break;
    }
    case "obelisk":
      p.add(box(3.6, 1.2, 3.6), 0xcfae7a, { y: 0.6 });
      p.add(cyl(0.9, 1.4, 16, 4), 0xe0c28c, { y: 9.2, ry: Math.PI / 4 });
      p.add(cone(0.95, 1.8, 4), 0xffd26a, { y: 18.1, ry: Math.PI / 4 });
      break;
  }
}

// ---------------------------------------------------------------- landmarks (far away)
function landmark(p: Parts, city: CityDef, night: boolean) {
  switch (city.id) {
    case "paris": {
      // Eiffel Tower: 4 legs meeting at the first floor, then two tapering square sections.
      const iron = 0x8a6a4a;
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const leg = box(4, 50, 4);
        leg.rotateZ(-x * 0.2);
        leg.rotateX(z * 0.2);
        p.add(leg, iron, { x: x * 12, y: 24, z: z * 12 });
      }
      p.add(box(26, 3, 26), iron, { y: 50 });
      p.add(cyl(5, 11, 55, 4), iron, { y: 79, ry: Math.PI / 4 });
      p.add(box(12, 2.4, 12), iron, { y: 107 });
      p.add(cyl(1.2, 5, 62, 4), iron, { y: 139, ry: Math.PI / 4 });
      p.add(cyl(0.3, 0.6, 14, 6), iron, { y: 176 });
      for (const [rx, ry] of [[0, 0], [0, Math.PI / 2]]) {
        const arch = new THREE.TorusGeometry(10, 1.4, 6, 14, Math.PI);
        arch.rotateY(ry);
        p.add(arch, iron, { y: 22, rx });
      }
      if (night) for (let y = 20; y < 180; y += 14) p.light(sphere(0.9, 6, 4), 0xffd27a, { y, x: y < 50 ? 10 - y * 0.12 : 4 - y * 0.02 });
      break;
    }
    case "newyork": {
      // Empire State: stepped tiers, mast; and a Chrysler-like crown next to it.
      const stone = 0xb9b2a4;
      p.add(box(40, 90, 30), stone, { y: 45 });
      p.add(box(28, 40, 22), stone, { y: 110 });
      p.add(box(16, 25, 14), stone, { y: 142 });
      p.add(box(9, 10, 9), stone, { y: 160 });
      p.add(cyl(1.5, 3, 24, 8), 0xd9dde3, { y: 177 });
      p.add(box(26, 110, 26), 0xa9b3c0, { x: 60, y: 55, z: 30 });
      for (let i = 0; i < 5; i++) p.add(cone(13 - i * 2.4, 8, 8), 0xd9dde3, { x: 60, y: 114 + i * 7, z: 30 });
      p.add(cyl(0.4, 0.9, 20, 6), 0xd9dde3, { x: 60, y: 160, z: 30 });
      const lit = night ? 0xffe2a0 : 0x7fa8cf;
      for (let y = 8; y < 88; y += 6) (night ? p.light.bind(p) : p.add.bind(p))(box(38, 1.4, 30.4), lit, { y });
      break;
    }
    case "tokyo": {
      // Tokyo Tower: red and white lattice sections.
      const colors = [0xf04a2c, 0xf5f5f5];
      let r0 = 16;
      for (let i = 0; i < 8; i++) {
        const h = 16;
        p.add(cyl(r0 * 0.8, r0, h, 4), colors[i % 2], { y: 8 + i * h, ry: Math.PI / 4 });
        r0 *= 0.8;
      }
      p.add(box(14, 4, 14), 0xf5f5f5, { y: 70 });
      p.add(box(7, 3, 7), 0xf5f5f5, { y: 110 });
      p.add(cyl(0.4, 1, 26, 6), 0xf04a2c, { y: 146 });
      if (night) for (let y = 10; y < 150; y += 10) p.light(sphere(1, 6, 4), 0xffa040, { y, x: Math.max(1, 12 - y * 0.08) });
      break;
    }
    case "london": {
      // Elizabeth Tower (Big Ben) with the Houses of Parliament, and the London Eye.
      const stone = 0xd8c690;
      p.add(box(12, 70, 12), stone, { y: 35 });
      p.add(box(14, 14, 14), 0xcdb880, { y: 77 });
      for (const [x, z, ry] of [[0, 7.1, 0], [7.1, 0, Math.PI / 2], [0, -7.1, 0], [-7.1, 0, Math.PI / 2]]) {
        const face = new THREE.CircleGeometry(4.5, 20);
        face.rotateY(ry);
        (night ? p.light.bind(p) : p.add.bind(p))(face, night ? 0xfff2c4 : 0xf7f3e6, { x, y: 77, z });
      }
      p.add(box(10, 10, 10), stone, { y: 89 });
      p.add(cyl(0.5, 7.5, 24, 4), 0x3a4a5a, { y: 106, ry: Math.PI / 4 });
      p.add(box(120, 22, 22), stone, { x: -70, y: 11 });
      for (let x = -125; x < -15; x += 10) p.add(cyl(0.2, 1.4, 8, 4), 0x3a4a5a, { x, y: 25, ry: Math.PI / 4 });
      const eye = new THREE.TorusGeometry(40, 1.1, 6, 40);
      p.add(eye, 0xe8ecf2, { x: 110, y: 46, z: -20, ry: 0.5 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const spoke = box(0.4, 40, 0.4);
        spoke.translate(0, 20, 0);
        spoke.rotateZ(a);
        p.add(spoke, 0xd0d6de, { x: 110, y: 46, z: -20, ry: 0.5 });
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        (night ? p.light.bind(p) : p.add.bind(p))(capsule(1.4, 1.4, 6), night ? 0x9fdcff : 0xf2f6fa, { x: 110 + Math.cos(a) * 40 * Math.cos(0.5), y: 46 + Math.sin(a) * 40, z: -20 - Math.cos(a) * 40 * Math.sin(0.5) });
      }
      break;
    }
    case "cairo": {
      // The 3 pyramids of Giza on the dunes.
      const sand = 0xe0bd7a;
      for (const [x, z, s] of [[0, 0, 1], [-95, 40, 0.85], [80, 60, 0.6]]) p.add(cone(75 * s, 95 * s, 4), sand, { x, y: (95 * s) / 2, z, ry: Math.PI / 4 });
      p.add(cone(9, 11, 4), 0xf4e4b8, { y: 89.5, ry: Math.PI / 4 });
      break;
    }
    case "rio": {
      // Corcovado hill with Christ the Redeemer, and the Sugarloaf.
      p.add(cone(90, 150, 9), 0x3f8f3a, { y: 75 });
      p.add(cone(40, 60, 9), 0x5a7a4a, { y: 150 });
      p.add(box(6, 26, 5), 0xf0ede4, { y: 190 });
      p.add(box(4, 10, 4), 0xf0ede4, { y: 205 });
      p.add(box(46, 4.5, 4), 0xf0ede4, { y: 205 });
      p.add(sphere(3, 10, 8), 0xf0ede4, { y: 213 });
      p.add(capsule(38, 70, 10), 0x4f8a45, { x: 150, y: 20, z: 60, sy: 1.1 });
      if (night) p.light(sphere(4, 8, 6), 0xfff2c4, { y: 200, z: 6 });
      break;
    }
  }
}

// ---------------------------------------------------------------- sky
function sky(lighting: Lighting) {
  const R = 480;
  const geo = new THREE.SphereGeometry(R, 32, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(lighting.skyTop);
  const hor = new THREE.Color(lighting.horizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / R;
    c.copy(hor).lerp(top, Math.pow(Math.min(1, Math.max(0, h) * 2.4), 0.65));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = 10; // after opaque geometry: hidden pixels are skipped
  return mesh;
}

function clouds(r: Rnd, lighting: Lighting) {
  const p = new Parts();
  const tint = lighting.night ? 0x3a4670 : new THREE.Color(0xffffff).lerp(new THREE.Color(lighting.horizon), 0.25).getHex();
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = between(r, 200, 330);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = between(r, 90, 150);
    const n = 3 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) p.add(sphere(between(r, 9, 17), 7, 5), tint, { x: x + k * 12 - n * 6, y: y + between(r, -3, 4), z: z + between(r, -6, 6), sy: 0.6 });
  }
  const mesh = new THREE.Mesh(merge(p.solid), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: lighting.night ? 0.5 : 0.95 }));
  mesh.renderOrder = 11;
  return mesh;
}

function sunDisc(lighting: Lighting) {
  const d = new THREE.Vector3(...lighting.sunDir).normalize().multiplyScalar(420);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(lighting.night ? 12 : 22, 24),
    new THREE.MeshBasicMaterial({ color: lighting.night ? 0xe8eeff : 0xfff6d8, fog: false, depthWrite: false })
  );
  mesh.position.copy(d);
  mesh.lookAt(0, 0, 0);
  mesh.renderOrder = 11;
  return mesh;
}

function stars(r: Rnd) {
  const n = 600;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = r() * Math.PI * 2;
    const y = 0.15 + r() * 0.85;
    const rr = Math.sqrt(1 - y * y);
    positions.set([Math.cos(t) * rr * 440, y * 440, Math.sin(t) * rr * 440], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  pts.renderOrder = 11;
  return pts;
}

// Weather around the player: rain (London), sand dust (Cairo), petals (Tokyo), leaves (Paris).
function weather(city: CityDef, camera: THREE.Camera) {
  if (city.weather === "none") return null;
  const N = 380;
  const B = { x: 60, y: 24, z: 60 };
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) positions.set([(Math.random() * 2 - 1) * B.x, Math.random() * B.y, (Math.random() * 2 - 1) * B.z], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const look = {
    rain: { color: 0xb8d8f0, size: 0.1, opacity: 0.6, fall: 24, drift: 0.4 },
    dust: { color: 0xe8cf9a, size: 0.14, opacity: 0.55, fall: 0.6, drift: 2.2 },
    petals: { color: 0xffb7d5, size: 0.2, opacity: 0.9, fall: 1.4, drift: 1.4 },
    leaves: { color: 0xd9a03a, size: 0.2, opacity: 0.85, fall: 1.2, drift: 1.2 },
  }[city.weather];
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: look.color, size: look.size, transparent: true, opacity: look.opacity, depthWrite: false }));
  points.frustumCulled = false;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const update = (delta: number, time: number) => {
    const cx = camera.position.x;
    const cz = camera.position.z;
    const t = time / 1000;
    for (let i = 0; i < N; i++) {
      let x = pos.getX(i) + Math.sin(t + i) * look.drift * delta;
      let y = pos.getY(i) - look.fall * delta;
      let z = pos.getZ(i) + Math.cos(t * 0.8 + i) * look.drift * delta;
      if (y < 0) y += B.y;
      if (x - cx > B.x) x -= B.x * 2;
      else if (cx - x > B.x) x += B.x * 2;
      if (z - cz > B.z) z -= B.z * 2;
      else if (cz - z > B.z) z += B.z * 2;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  };
  return { points, update };
}

// ---------------------------------------------------------------- city
export function buildWorld(level: number, camera: THREE.Camera): World {
  const city = cityOfLevel(level);
  const time = timeOfLevel(level);
  const lighting = LIGHTING[time];
  const night = lighting.night;
  const r = seeded(level * 7919 + 17);
  const all = new Parts();
  const colliders: THREE.Mesh[] = [];
  const collider = (minX: number, maxX: number, minZ: number, maxZ: number, h: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, h, maxZ - minZ), new THREE.MeshBasicMaterial());
    m.position.set((minX + maxX) / 2, h / 2, (minZ + maxZ) / 2);
    m.visible = false;
    m.updateMatrixWorld();
    m.userData.aabb = new THREE.Box3().setFromObject(m);
    colliders.push(m);
  };

  // Ground: land, roads, square paving, sidewalks and road markings. The land and the roads
  // go into `far`, merged after everything else: in a merged mesh triangles are drawn in order,
  // so drawing near things first lets the depth test skip the hidden ground pixels.
  const far = new Parts();
  far.add(new THREE.PlaneGeometry(900, 900), city.ground, { y: -0.02, rx: -Math.PI / 2 });
  for (const rot of [0, Math.PI / 2]) {
    for (const end of [-1, 1]) {
      const len = STREET_END + 20 - PLAZA;
      far.add(new THREE.PlaneGeometry(STREET * 2, len), city.road, rot ? { x: end * (PLAZA + len / 2), y: 0.01, rx: -Math.PI / 2, ry: rot } : { z: end * (PLAZA + len / 2), y: 0.01, rx: -Math.PI / 2 });
    }
    for (let s = PLAZA + 3; s < STREET_END; s += 6) for (const sign of [-1, 1]) all.add(box(0.25, 0.06, 2.6), 0xf2f2f2, { x: rot ? sign * s : 0, y: 0.02, z: rot ? 0 : sign * s, ry: rot });
    // Sidewalks along the streets only (not across the square).
    const len = STREET_END - PLAZA;
    for (const side of [-1, 1])
      for (const end of [-1, 1]) {
        const c = end * (PLAZA + len / 2);
        all.add(box(2, 0.25, len), 0xb4b4ae, rot ? { x: c, y: 0.1, z: side * (STREET + 1), ry: rot } : { x: side * (STREET + 1), y: 0.1, z: c });
      }
  }
  const tile = 4;
  for (let i = -PLAZA; i < PLAZA; i += tile)
    for (let j = -PLAZA; j < PLAZA; j += tile) {
      let alt = Math.abs((i + j) / tile) % 2 === 0;
      if (city.id === "rio") alt = Math.floor((j + PLAZA + Math.sin((i + PLAZA) * 0.3) * 3) / 4) % 3 !== 0; // Copacabana waves
      all.add(pane(tile, tile), alt ? city.plaza[0] : city.plaza[1], { x: i + tile / 2, y: 0.08, z: j + tile / 2, rx: -Math.PI / 2 });
    }

  // Rows of buildings: square sides (8 half rows) and street walls (8), street ends (4).
  // A row runs from `a` to `b` along its axis; its facade is at `front`, facing `normal`.
  const row = (axis: "x" | "z", a: number, b: number, front: number, normal: 1 | -1, depth: [number, number], hScale = 1) => {
    let t = a;
    let maxDepth = 0;
    let maxH = 0;
    while (t < b - 3) {
      const w = Math.min(b - t, between(r, 8, 13));
      const d = between(r, depth[0], depth[1]);
      const h = between(r, city.heights[0], city.heights[1]) * hScale;
      const p = new Parts();
      building(p, r, city, w - 0.2, d, h, night);
      const mid = t + w / 2;
      // Local +z (the facade) must point along the row normal.
      if (axis === "x") p.place(all, mid, front, normal > 0 ? 0 : Math.PI);
      else p.place(all, front, mid, normal > 0 ? Math.PI / 2 : -Math.PI / 2);
      maxDepth = Math.max(maxDepth, d);
      maxH = Math.max(maxH, h);
      t += w;
    }
    const back = front - normal * maxDepth;
    if (axis === "x") collider(a, b, Math.min(front, back), Math.max(front, back), maxH);
    else collider(Math.min(front, back), Math.max(front, back), a, b, maxH);
  };
  const D: [number, number] = [11, 15];
  for (const s of [-1, 1] as const) {
    // Square sides (s = -1: north / west, +1: south / east), split by the street.
    row("x", -PLAZA - 16, -WALK, s * PLAZA, (s * -1) as 1 | -1, D);
    row("x", WALK, PLAZA + 16, s * PLAZA, (s * -1) as 1 | -1, D);
    row("z", -PLAZA, -WALK, s * PLAZA, (s * -1) as 1 | -1, D);
    row("z", WALK, PLAZA, s * PLAZA, (s * -1) as 1 | -1, D);
    // Street walls from the square to the end of the street.
    for (const side of [-1, 1] as const) {
      const a = s < 0 ? -STREET_END : PLAZA + 15;
      const b = s < 0 ? -PLAZA - 15 : STREET_END;
      // Facades face the street (normal = -side), bodies extend away from it.
      row("z", a, b, side * WALK, (-side) as 1 | -1, [10, 13]); // street along z, walls at x = ±WALK
      row("x", a, b, side * WALK, (-side) as 1 | -1, [10, 13]); // street along x, walls at z = ±WALK
    }
    // Street ends: a building across the street and a barricade of cars.
    row("x", -WALK - 4, WALK + 4, s * (STREET_END + 2), (s * -1) as 1 | -1, [10, 12], 1.1);
    row("z", -WALK - 4, WALK + 4, s * (STREET_END + 2), (s * -1) as 1 | -1, [10, 12], 1.1);
  }

  // Background skyline beyond the rows (no collisions: out of reach).
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const d = between(r, 95, 190);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.abs(x) < WALK + 6 || Math.abs(z) < WALK + 6) continue; // keep the street views open
    const w = between(r, 10, 22);
    const h = between(r, city.heights[0], city.heights[1] * 1.3);
    const p = new Parts();
    farBuilding(p, r, city, w, w, h, night);
    p.place(far, x, z, Math.atan2(-x, -z));
  }

  // The landmark, seen through the north street and above the roofs.
  const lm = new Parts();
  landmark(lm, city, night);
  const lmPos = { paris: [30, -250], newyork: [-20, -240], tokyo: [25, -230], london: [45, -220], cairo: [30, -210], rio: [0, -330] }[city.id];
  lm.place(far, lmPos[0], lmPos[1], 0);

  // Square: centrepiece, trees, lamps, benches, parked cars (cover).
  const cp = new Parts();
  centerpiece(cp, city, night);
  cp.place(all, 0, 0);
  const cpSize = city.centerpiece === "fountain" ? 4.4 : city.centerpiece === "column" ? 1.8 : city.centerpiece === "torii" ? 3.4 : 1.9;
  if (city.centerpiece === "torii") {
    collider(-3.4, -2.6, -0.4, 0.4, 7);
    collider(2.6, 3.4, -0.4, 0.4, 7);
  } else collider(-cpSize, cpSize, -cpSize, cpSize, city.centerpiece === "fountain" ? 1 : 20);

  const spots: [number, number][] = [
    [-30, -30], [30, -30], [-30, 30], [30, 30], [-18, -36], [18, -36], [-36, 18], [36, -18],
  ];
  for (const [x, z] of spots) {
    const p = new Parts();
    tree(p, city, r);
    p.place(all, x, z, r() * Math.PI * 2);
    collider(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 4);
  }
  for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14], [-40, 0], [40, 0], [0, -40]]) {
    const p = new Parts();
    lamp(p, night, city);
    p.place(all, x, z, Math.atan2(-x, -z) + Math.PI / 2);
  }
  for (const [x, z, ry] of [[-22, -8, 0], [22, 8, Math.PI], [-8, 24, Math.PI / 2], [8, -24, -Math.PI / 2]]) {
    const p = new Parts();
    bench(p);
    p.place(all, x, z, ry);
  }
  // Parked vehicles: cover in the square and a barricade at each street end.
  const vehicle = (x: number, z: number, ry: number) => {
    const p = new Parts();
    if (city.id === "london" && r() < 0.35) {
      bus(p);
      p.place(all, x, z, ry);
      const along = Math.abs(Math.sin(ry)) > 0.5;
      collider(x - (along ? 5 : 1.3), x + (along ? 5 : 1.3), z - (along ? 1.3 : 5), z + (along ? 1.3 : 5), 4.5);
      return;
    }
    const color = pick(r, city.cars);
    car(p, color, city.id === "newyork" && color === 0xffc61a ? "taxi" : city.id === "london" && color === 0x1f1f24 ? "cab" : "car");
    p.place(all, x, z, ry);
    const along = Math.abs(Math.sin(ry)) > 0.5;
    collider(x - (along ? 2.2 : 1), x + (along ? 2.2 : 1), z - (along ? 1 : 2.2), z + (along ? 1 : 2.2), 1.9);
  };
  for (const [x, z, ry] of [[-26, -14, 0.3], [27, 18, -0.4], [-20, 22, 1.4], [24, -22, 1.8], [-34, -6, 0.1], [10, 32, 1.6]]) vehicle(x, z, ry);
  for (const s of [-1, 1]) {
    vehicle(-3, s * (STREET_END - 6), Math.PI / 2);
    vehicle(3.4, s * (STREET_END - 8), Math.PI / 2 + 0.3);
    vehicle(s * (STREET_END - 6), -3, 0);
    vehicle(s * (STREET_END - 8), 3.4, 0.3);
  }

  // Zombies enter from the 4 streets.
  const spawnPoints: THREE.Vector3[] = [];
  for (const d of [48, 55, 62, 69]) {
    for (const lat of [-4, 0, 4]) {
      spawnPoints.push(new THREE.Vector3(lat, 0, -d), new THREE.Vector3(lat, 0, d), new THREE.Vector3(-d, 0, lat), new THREE.Vector3(d, 0, lat));
    }
  }

  // Assemble: 1 lit toon mesh, 1 glowing mesh, sky, clouds / stars, sun or moon, weather.
  const group = new THREE.Group();
  const solid = new THREE.Mesh(merge([...all.solid, ...far.solid]), toonMaterial());
  group.add(solid);
  if (all.glow.length + far.glow.length) group.add(new THREE.Mesh(merge([...all.glow, ...far.glow]), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  colliders.forEach((c) => group.add(c));
  const skyMesh = sky(lighting);
  group.add(skyMesh, sunDisc(lighting));
  const cloudMesh = clouds(r, lighting);
  group.add(cloudMesh);
  if (night) group.add(stars(r));
  const w = weather(city, camera);
  if (w) group.add(w.points);

  return {
    group,
    colliders,
    spawnPoints,
    lighting,
    city,
    time,
    update(delta, t) {
      cloudMesh.rotation.y += delta * 0.004;
      w?.update(delta, t);
    },
  };
}

export { CITIES };
