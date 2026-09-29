"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { coinSVGDocument } from "./EpochCoin";

/* A physical coin: cylinder body, reeded edge (bump map), raised bevel rings and
   the SVG emblem as the face texture, lit by a procedural studio environment.
   It turns slowly and leans toward the pointer. No network assets. */

function useFaceTexture() {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let dead = false;
    const img = new Image();
    img.onload = () => {
      if (dead) return;
      const c = document.createElement("canvas"); c.width = c.height = 1024;
      c.getContext("2d")!.drawImage(img, 0, 0, 1024, 1024);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; setTex(t);
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(coinSVGDocument(1024));
    return () => { dead = true; };
  }, []);
  return tex;
}

function useReedingBump() {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 8;
    const g = c.getContext("2d")!; g.fillStyle = "#000"; g.fillRect(0, 0, 1024, 8);
    g.fillStyle = "#fff"; const n = 120; for (let i = 0; i < n; i++) g.fillRect((i / n) * 1024, 0, 1024 / n / 2, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; return t;
  }, []);
}

function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04);
    // three.js scene state, not React state — mutating it is the intended use
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = env.texture;
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

function Coin({ tex }: { tex: THREE.Texture }) {
  const spin = useRef<THREE.Group>(null); const tilt = useRef<THREE.Group>(null);
  const bump = useReedingBump();
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f2b81c", metalness: 1, roughness: 0.28 }), []);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e9a800", metalness: 1, roughness: 0.32, bumpMap: bump, bumpScale: 1.6 }), [bump]);
  // cylinder caps map UVs turned 90°; rotate each face so the emblem sits upright, mirrored-correct on both sides
  const [front, back] = useMemo(() => {
    const mk = (rot: number) => { const t = tex.clone(); t.center.set(0.5, 0.5); t.rotation = rot; t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.1 }); };
    return [mk(Math.PI / 2), mk(Math.PI / 2)];
  }, [tex]);

  useFrame((s, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.55;
    if (tilt.current) {
      tilt.current.rotation.x = THREE.MathUtils.lerp(tilt.current.rotation.x, -s.pointer.y * 0.35 + 0.12, 0.06);
      tilt.current.rotation.z = THREE.MathUtils.lerp(tilt.current.rotation.z, s.pointer.x * 0.12, 0.06);
      tilt.current.position.y = Math.sin(s.clock.elapsedTime * 0.9) * 0.06;
    }
  });

  return (
    <group ref={tilt}>
      <group ref={spin}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={[edge, front, back]}>
          <cylinderGeometry args={[1, 1, 0.15, 128, 1]} />
        </mesh>
        {[0.078, -0.078].map((z) => (
          <mesh key={z} position={[0, 0, z]} material={gold}><torusGeometry args={[0.965, 0.028, 20, 160]} /></mesh>
        ))}
      </group>
    </group>
  );
}

export default function Coin3DScene() {
  const tex = useFaceTexture();
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 4.3], fov: 32 }} gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>
      <Studio />
      <ambientLight intensity={0.25} />
      <directionalLight position={[2.5, 3, 3]} intensity={1.6} />
      {tex && <Coin tex={tex} />}
    </Canvas>
  );
}
