import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { buildHero } from "../game/heroes";
import { buildWeaponModel } from "../game/weapons";
import { buildZombie } from "../game/characters";
import type { Actor } from "../game/story";

// 3D picture of a comic panel: the game's own heroes and zombies posed on a small neon stage.
// One GL context for the whole comic; the cast is rebuilt when the panel changes.
type Props = { actors: Actor[]; bg: number; night?: boolean };

export default function ComicStage({ actors, bg, night }: Props) {
  const root = useRef<THREE.Group | null>(null);
  const cam = useRef<THREE.PerspectiveCamera | null>(null);
  const renderer = useRef<any>(null);
  const raf = useRef<any>(null);
  const arms = useRef<THREE.Object3D[]>([]);
  const current = useRef({ actors, bg, night });
  current.current = { actors, bg, night };

  const show = () => {
    const g = root.current;
    if (!g) return;
    g.clear();
    arms.current = [];
    const { actors: cast, bg: color } = current.current;
    renderer.current?.setClearColor(color, 1);
    // Round floor with a glowing rim.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), roughness: 0.9 }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(4.9, 5.05, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    rim.position.y = 0.01;
    g.add(floor, rim);
    for (const a of cast) {
      let obj: THREE.Object3D;
      if (a.hero) {
        const h = buildHero(a.hero);
        if (a.weapon) h.mount.add(buildWeaponModel(a.weapon, undefined, a.hero, false));
        obj = h.group;
      } else {
        const z = buildZombie("boss", a.zombie ?? "walker");
        arms.current.push(z.limbs.leftArm, z.limbs.rightArm);
        obj = z.group;
      }
      obj.position.set(a.x, 0, a.z ?? 0);
      obj.rotation.y = a.turn ?? 0;
      obj.scale.setScalar(a.scale ?? 1);
      g.add(obj);
    }
  };
  useEffect(show, [actors, bg, night]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const r = new Renderer({ gl });
    r.setSize(w, h);
    renderer.current = r;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x303048, current.current.night ? 1.3 : 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(2, 4, 4);
    scene.add(key);
    const rimL = new THREE.PointLight(0xff3df0, 12, 12);
    rimL.position.set(-3, 2.5, -2);
    const rimR = new THREE.PointLight(0x00e5ff, 12, 12);
    rimR.position.set(3, 2.5, -2);
    scene.add(rimL, rimR);
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 60);
    cam.current = camera;
    const g = new THREE.Group();
    scene.add(g);
    root.current = g;
    show();
    const t0 = Date.now();
    const loop = () => {
      raf.current = requestAnimationFrame(loop);
      const t = (Date.now() - t0) / 1000;
      // Slow camera drift, zombies reaching forward.
      // One character: closer; a group: wider.
      const n = current.current.actors.length;
      const solo = n <= 1;
      const dist = solo ? 4.3 : n > 4 ? 6.4 + (n - 4) * 1.4 : 6.4; // a team of 6 stays in the frame
      camera.position.set(Math.sin(t * 0.25) * (solo ? 0.5 : 0.8), solo ? 1.5 : 1.7, dist);
      camera.lookAt(0, solo ? 1.0 : 1.05, 0);
      arms.current.forEach((a, i) => (a.rotation.x = -Math.PI / 2 + Math.sin(t * 3 + i) * 0.15));
      r.render(scene, camera);
      gl.endFrameEXP();
    };
    loop();
  };

  return <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />;
}
