// Advertising posters on the facades (admin page → "Publicités", backend/billboards.py).
// The live posters come with the remote config when the app opens; their images are downloaded
// once (expo-asset keeps them in the phone cache) and turned into textures ready for the levels.
// A level shows at most one poster per slot; a slot without a poster keeps its normal facade.
import * as THREE from "three";
import { TextureLoader } from "expo-three";
import { backendUrl, post } from "../api/client";

export type RemoteBillboard = { id: string; slot: number; level_from: number; level_to: number; url: string };

let list: RemoteBillboard[] = [];
const textures = new Map<string, THREE.Texture>(); // by image URL (a new image has a new URL)
const loading = new Set<string>();

function load(url: string) {
  if (textures.has(url) || loading.has(url)) return;
  loading.add(url);
  try {
    new TextureLoader().load(
      backendUrl(url),
      (tex: THREE.Texture) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        textures.set(url, tex);
        loading.delete(url);
      },
      undefined,
      () => loading.delete(url)
    );
  } catch {
    loading.delete(url);
  }
}

export function setRemoteBillboards(next: RemoteBillboard[] | undefined) {
  if (!Array.isArray(next)) return;
  list = next.filter((b) => b && typeof b.url === "string" && b.slot >= 0 && b.slot <= 3);
  list.forEach((b) => load(b.url));
}

// Posters of a level, one per slot at most (random among the ones booked on the same slot).
// The views are sent to the admin statistics.
export function billboardsFor(level: number): { slot: number; id: string; texture: THREE.Texture }[] {
  const out: { slot: number; id: string; texture: THREE.Texture }[] = [];
  for (const slot of [1, 2, 3]) {
    const ready = list.filter((b) => level >= b.level_from && level <= b.level_to && textures.has(b.url));
    // A poster booked on this very slot has priority; "all slots" posters fill the others.
    const own = ready.filter((b) => b.slot === slot);
    const choices = own.length ? own : ready.filter((b) => b.slot === 0);
    if (!choices.length) continue;
    // Different posters on the facades when possible; a poster for "all slots" may repeat.
    const free = choices.filter((b) => !out.some((o) => o.id === b.id));
    const pool = free.length ? free : choices;
    const b = pool[Math.floor(Math.random() * pool.length)];
    out.push({ slot, id: b.id, texture: textures.get(b.url)! });
  }
  if (out.length) post("/billboards/views", { ids: Array.from(new Set(out.map((o) => o.id))) }).catch(() => {});
  return out;
}
