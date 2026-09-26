import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { buildWeaponModel } from "../game/weapons";

// Rotating 3D view of a weapon held in the gloved hand, with the previewed skin and outfit.
export default function WeaponPreview({ weaponSkin, outfit, weapon, withHand = true }: { weaponSkin: string; outfit: string; weapon: string; withHand?: boolean }) {
  const holder = useRef<THREE.Group | null>(null);
  const cam = useRef<THREE.PerspectiveCamera | null>(null);
  const raf = useRef<any>(null);
  const current = useRef({ weaponSkin, outfit, weapon });
  current.current = { weaponSkin, outfit, weapon };

  const show = () => {
    const h = holder.current;
    if (!h) return;
    h.clear();
    const { weaponSkin: s, outfit: o, weapon: w } = current.current;
    const model = buildWeaponModel(w, s, o, withHand);
    // Turn around the middle of the weapon and frame it whatever its size (pistol … sniper).
    const bb = new THREE.Box3().setFromObject(model);
    const center = bb.getCenter(new THREE.Vector3());
    model.position.sub(center);
    h.add(model);
    const size = bb.getSize(new THREE.Vector3());
    const d = Math.max(size.z, size.x, size.y * 2) * (withHand ? 1.5 : 0.92) + 0.05;
    cam.current?.position.set(0, d * 0.16, d);
    cam.current?.lookAt(0, 0, 0);
  };
  useEffect(show, [weaponSkin, outfit, weapon]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);
    renderer.setClearColor(0x2b313b, 1);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(2, 3, 2);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.05, 20);
    cam.current = camera;
    const g = new THREE.Group();
    scene.add(g);
    holder.current = g;
    show();
    const loop = () => {
      raf.current = requestAnimationFrame(loop);
      // Side view (the silhouette reads best) with a slow sway to show the volume.
      g.rotation.y = -Math.PI / 2 + Math.sin(Date.now() / 1400) * 0.55;
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    loop();
  };

  return <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />;
}

