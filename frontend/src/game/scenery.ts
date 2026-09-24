// Decor around the arena: gradient sky with stars, a neon skyline on the horizon, glowing crate
// edges, street lamps and ambient particles. Nothing here collides or is hit by shots.
import * as THREE from "three";
import type { Sector } from "./content";

export type Scenery = { update: (delta: number, time: number) => void };

const SKY_RADIUS = 400;
const PARTICLES = 420;
const PARTICLE_BOX = { x: 70, y: 26, z: 70 }; // half extents around the player

// Vertical gradient on a big inverted sphere: sector colour glow at the horizon, dark sky above.
function buildSky(sector: Sector): THREE.Object3D {
  const geo = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(sector.skyTop);
  const horizon = new THREE.Color(sector.horizon);
  const ground = new THREE.Color(sector.background);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / SKY_RADIUS; // -1 (down) .. 1 (up)
    if (h >= 0) c.copy(horizon).lerp(top, Math.pow(Math.min(1, h * 2.2), 0.7));
    else c.copy(horizon).lerp(ground, Math.min(1, -h * 6));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  // Drawn after the opaque scene: the depth test skips every pixel already covered.
  sky.renderOrder = 10;
  return sky;
}

function buildStars(): THREE.Points {
  const n = 500;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = 0.12 + Math.random() * 0.88; // upper part of the sky only
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(theta) * r * 360, y * 360, Math.sin(theta) * r * 360], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.75, depthWrite: false })
  );
  stars.renderOrder = 11;
  return stars;
}

// Ring of towers far outside the arena, with lit window strips in the sector's neon colours.
// Unlit silhouettes: the fog blends them into the glow of the horizon.
function buildSkyline(sector: Sector) {
  const group = new THREE.Group();
  const count = 56;
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  towerGeo.translate(0, 0.5, 0);
  const towers = new THREE.InstancedMesh(towerGeo, new THREE.MeshBasicMaterial({ color: sector.tower }), count);
  const stripGeo = new THREE.BoxGeometry(1, 1, 1);
  // Windows ignore the fog so the city lights still read at a distance, dimmed toward the sky.
  const lit = (c: number) => new THREE.Color(c).lerp(new THREE.Color(sector.horizon), 0.45);
  const stripsA = new THREE.InstancedMesh(stripGeo, new THREE.MeshBasicMaterial({ color: lit(sector.neonA), fog: false }), count * 3);
  const stripsB = new THREE.InstancedMesh(stripGeo, new THREE.MeshBasicMaterial({ color: lit(sector.neonB), fog: false }), count * 3);
  const beaconGeo = new THREE.SphereGeometry(0.9, 8, 6);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, fog: false });
  const beacons: THREE.Mesh[] = [];

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let a = 0;
  let b = 0;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.05;
    const dist = 175 + Math.random() * 70;
    const w = 10 + Math.random() * 16;
    const d = 10 + Math.random() * 16;
    const h = 18 + Math.random() * 38 + (i % 6 === 0 ? 30 : 0);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    q.setFromAxisAngle(up, -angle);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d));
    towers.setMatrixAt(i, m);

    // Horizontal light bands on the face turned to the arena.
    const face = new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(d / 2 + 0.15);
    const bands = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < bands; k++) {
      const y = h * (0.25 + Math.random() * 0.65);
      m.compose(new THREE.Vector3(x + face.x, y, z + face.z), q, new THREE.Vector3(w * (0.5 + Math.random() * 0.45), 0.5 + Math.random() * 0.7, 0.2));
      if (Math.random() < 0.55) stripsA.setMatrixAt(a++, m);
      else stripsB.setMatrixAt(b++, m);
    }
    if (h > 48) {
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(x, h + 1, z);
      beacon.userData.phase = Math.random() * Math.PI * 2;
      beacons.push(beacon);
      group.add(beacon);
    }
  }
  stripsA.count = a;
  stripsB.count = b;
  group.add(towers, stripsA, stripsB);
  return { group, beaconMat };
}

// Glowing outlines on the crates of the arena (added to the world, not to the crates, so the
// thin lines are never hit by the raycasts that resolve shots).
function buildEdges(crates: THREE.Object3D[], sector: Sector): THREE.Object3D {
  // All outlines of one colour merged into a single geometry: 2 draw calls for the whole arena.
  const merged: number[][] = [[], []];
  crates.forEach((crate, i) => {
    const mesh = crate as THREE.Mesh;
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const pos = edges.attributes.position;
    const out = merged[i % 3 === 0 ? 1 : 0];
    for (let k = 0; k < pos.count; k++) {
      out.push(pos.getX(k) * 1.005 + mesh.position.x, pos.getY(k) * 1.005 + mesh.position.y, pos.getZ(k) * 1.005 + mesh.position.z);
    }
    edges.dispose();
  });
  const group = new THREE.Group();
  [sector.neonB, sector.neonA].forEach((color, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(merged[i], 3));
    group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })));
  });
  return group;
}

// A few street lamps, placed away from the spawn point. The light is faked with a glow on the
// ground: real point lights would make every lit pixel of the arena more expensive on phones.
function buildLamps(sector: Sector): THREE.Object3D {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x1b2230 });
  const headMat = new THREE.MeshBasicMaterial({ color: sector.neonB });
  const spots: [number, number][] = [
    [-22, -18],
    [24, -26],
    [-30, 20],
    [26, 22],
  ];
  for (const [x, z] of spots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), poleMat);
    pole.position.set(x, 3.5, z);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.5), headMat);
    head.position.set(x, 7, z);
    // Glow pool on the ground under the lamp.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(5, 24),
      new THREE.MeshBasicMaterial({ color: sector.neonB, transparent: true, opacity: 0.16, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.03, z);
    group.add(pole, head, pool);
  }
  return group;
}

// Ambient particles that follow the player: rain, snow, embers or floating neon dust.
function buildParticles(sector: Sector) {
  const positions = new Float32Array(PARTICLES * 3);
  for (let i = 0; i < PARTICLES; i++) {
    positions.set(
      [(Math.random() * 2 - 1) * PARTICLE_BOX.x, Math.random() * PARTICLE_BOX.y, (Math.random() * 2 - 1) * PARTICLE_BOX.z],
      i * 3
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const look = {
    rain: { color: 0x9fd8ff, size: 0.12, opacity: 0.55, fall: 26, drift: 0.5 },
    snow: { color: 0xffffff, size: 0.18, opacity: 0.85, fall: 2.2, drift: 1.2 },
    embers: { color: 0xffa040, size: 0.16, opacity: 0.9, fall: -1.6, drift: 1.4 },
    dust: { color: sector.neonB, size: 0.12, opacity: 0.6, fall: 0.35, drift: 0.8 },
  }[sector.particles];
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: look.color, size: look.size, transparent: true, opacity: look.opacity, depthWrite: false })
  );
  points.frustumCulled = false;
  return { points, look };
}

export function buildScenery(world: THREE.Group, sector: Sector, crates: THREE.Object3D[], camera: THREE.Camera): Scenery {
  world.add(buildSky(sector));
  const stars = buildStars();
  world.add(stars);
  const { group: skyline, beaconMat } = buildSkyline(sector);
  world.add(skyline);
  world.add(buildEdges(crates, sector));
  world.add(buildLamps(sector));
  const { points, look } = buildParticles(sector);
  world.add(points);

  const pos = points.geometry.attributes.position as THREE.BufferAttribute;
  return {
    update(delta, time) {
      // Sky and stars stay centred on the player so the horizon never gets closer.
      stars.position.set(camera.position.x, 0, camera.position.z);
      beaconMat.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(time / 380));

      const cx = camera.position.x;
      const cz = camera.position.z;
      const t = time / 1000;
      for (let i = 0; i < PARTICLES; i++) {
        let x = pos.getX(i) + Math.sin(t + i) * look.drift * delta;
        let y = pos.getY(i) - look.fall * delta;
        let z = pos.getZ(i) + Math.cos(t * 0.8 + i) * look.drift * delta;
        if (y < 0) y += PARTICLE_BOX.y;
        else if (y > PARTICLE_BOX.y) y -= PARTICLE_BOX.y;
        // Wrap around the player so the particles are always around them.
        if (x - cx > PARTICLE_BOX.x) x -= PARTICLE_BOX.x * 2;
        else if (cx - x > PARTICLE_BOX.x) x += PARTICLE_BOX.x * 2;
        if (z - cz > PARTICLE_BOX.z) z -= PARTICLE_BOX.z * 2;
        else if (cz - z > PARTICLE_BOX.z) z += PARTICLE_BOX.z * 2;
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    },
  };
}
