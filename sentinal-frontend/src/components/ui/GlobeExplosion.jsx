import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { polar2Cartesian } from "../../utils/geoDots";

const PARTICLE_COUNT = 240;
const LIFETIME = 2.2; // seconds of cinematic nuclear blast

/**
 * GlobeExplosion — Nuclear Blast Engine on the 3D Globe.
 *
 * Features:
 * 1. Expanding Hyper-Luminous Nuclear Fireball (White -> Solar Yellow -> Crimson).
 * 2. Supersonic Atmospheric Shockwave Rings radiating across the globe surface.
 * 3. 240+ High-Velocity Plasma Debris Particles & Mushroom Plume with Vertex Colors.
 *
 * @param {{ lat: number, lng: number } | null} target - The explosion origin
 * @param {Function} onComplete - Called when the explosion finishes
 */
export default function GlobeExplosion({ target, onComplete }) {
  const groupRef = useRef();
  const fireballRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const pointsRef = useRef();
  const lightRef = useRef();

  const startTimeRef = useRef(null);
  const activeRef = useRef(false);
  const completedRef = useRef(false);

  // Pre-allocate particle buffers (never re-allocated per render)
  const buffers = useMemo(() => ({
    positions: new Float32Array(PARTICLE_COUNT * 3),
    velocities: new Float32Array(PARTICLE_COUNT * 3),
    colors: new Float32Array(PARTICLE_COUNT * 3),
    lifetimes: new Float32Array(PARTICLE_COUNT),
    baseSizes: new Float32Array(PARTICLE_COUNT),
  }), []);

  // Compute orientation vectors for shockwave rings & particle dispersion
  const orientation = useMemo(() => {
    if (!target) return null;
    const origin = polar2Cartesian(target.lat, target.lng, 101.5);
    const normal = new THREE.Vector3(origin.x, origin.y, origin.z).normalize();

    // Compute quaternion to orient shockwave rings flat on the globe surface
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);

    return { origin, normal, quaternion };
  }, [target]);

  // Initialize nuclear explosion when target is set
  useEffect(() => {
    if (!target || !orientation) {
      activeRef.current = false;
      completedRef.current = false;
      return;
    }

    const { origin, normal } = orientation;

    // Tangent vectors for spherical spread
    const tangent1 = new THREE.Vector3();
    const tangent2 = new THREE.Vector3();
    if (Math.abs(normal.y) < 0.99) {
      tangent1.crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize();
    } else {
      tangent1.crossVectors(normal, new THREE.Vector3(1, 0, 0)).normalize();
    }
    tangent2.crossVectors(normal, tangent1).normalize();

    // Initialize 240 particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      buffers.positions[i * 3] = origin.x;
      buffers.positions[i * 3 + 1] = origin.y;
      buffers.positions[i * 3 + 2] = origin.z;

      // 40% mushroom plume upward along normal, 60% radial high-velocity ejecta
      const isPlume = i < PARTICLE_COUNT * 0.4;
      const speed = isPlume ? (30 + Math.random() * 65) : (18 + Math.random() * 75);
      const spread1 = (Math.random() - 0.5) * (isPlume ? 0.6 : 1.8);
      const spread2 = (Math.random() - 0.5) * (isPlume ? 0.6 : 1.8);

      const dir = new THREE.Vector3()
        .copy(normal)
        .addScaledVector(tangent1, spread1)
        .addScaledVector(tangent2, spread2)
        .normalize()
        .multiplyScalar(speed);

      buffers.velocities[i * 3] = dir.x;
      buffers.velocities[i * 3 + 1] = dir.y;
      buffers.velocities[i * 3 + 2] = dir.z;

      buffers.lifetimes[i] = 0.8 + Math.random() * 1.4;
      buffers.baseSizes[i] = 2.5 + Math.random() * 4.5;

      // Vertex color distribution (White-hot -> Solar Yellow -> Fiery Orange -> Crimson)
      const colorRand = Math.random();
      if (colorRand < 0.25) {
        // Blinding white-hot core
        buffers.colors[i * 3] = 1.0;
        buffers.colors[i * 3 + 1] = 1.0;
        buffers.colors[i * 3 + 2] = 1.0;
      } else if (colorRand < 0.55) {
        // Solar nuclear yellow
        buffers.colors[i * 3] = 1.0;
        buffers.colors[i * 3 + 1] = 0.85;
        buffers.colors[i * 3 + 2] = 0.1;
      } else if (colorRand < 0.85) {
        // Plasma flame orange
        buffers.colors[i * 3] = 1.0;
        buffers.colors[i * 3 + 1] = 0.3;
        buffers.colors[i * 3 + 2] = 0.0;
      } else {
        // Deep crimson / laser red
        buffers.colors[i * 3] = 0.95;
        buffers.colors[i * 3 + 1] = 0.05;
        buffers.colors[i * 3 + 2] = 0.15;
      }
    }

    startTimeRef.current = performance.now();
    activeRef.current = true;
    completedRef.current = false;

    // Reset geometry attributes
    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.attributes.position;
      posAttr.array.set(buffers.positions);
      posAttr.needsUpdate = true;

      const colAttr = pointsRef.current.geometry.attributes.color;
      colAttr.array.set(buffers.colors);
      colAttr.needsUpdate = true;
    }
  }, [target, orientation, buffers]);

  // Frame animation loop
  useFrame(() => {
    if (!activeRef.current || !startTimeRef.current || !orientation) return;

    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const progress = Math.min(1, elapsed / LIFETIME);

    // End condition
    if (elapsed >= LIFETIME) {
      if (!completedRef.current) {
        completedRef.current = true;
        activeRef.current = false;
        if (onComplete) onComplete();
      }
      return;
    }

    const dt = Math.min(1 / 30, 0.033);

    // ── 1. Nuclear Core Fireball Animation ──
    if (fireballRef.current) {
      // Starts at 0, rapidly explodes to max scale at t=0.35s, then decays & dissipates
      const fireballScale = progress < 0.3
        ? (progress / 0.3) * 14
        : Math.max(0.1, (1 - (progress - 0.3) / 0.7) * 14);
      fireballRef.current.scale.set(fireballScale, fireballScale, fireballScale);
      fireballRef.current.material.opacity = Math.max(0, 1 - Math.pow(progress, 0.8));
    }

    // ── 2. Primary Shockwave Ring ──
    if (ring1Ref.current) {
      const ringScale = Math.min(45, progress * 48);
      ring1Ref.current.scale.set(ringScale, ringScale, ringScale);
      ring1Ref.current.material.opacity = Math.max(0, (1 - Math.pow(progress, 1.4)) * 0.9);
    }

    // ── 3. Secondary Supersonic Shockwave Ring (Lagged by 0.15s) ──
    if (ring2Ref.current) {
      const lagProgress = Math.max(0, progress - 0.1);
      const ring2Scale = Math.min(36, lagProgress * 42);
      ring2Ref.current.scale.set(ring2Scale, ring2Scale, ring2Scale);
      ring2Ref.current.material.opacity = Math.max(0, (1 - Math.pow(lagProgress, 1.2)) * 0.75);
    }

    // ── 4. Dynamic Blast Flash Light ──
    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0, (1 - Math.pow(progress, 0.6)) * 40);
    }

    // ── 5. Particle Physics & Turbulence ──
    if (pointsRef.current) {
      const posArr = pointsRef.current.geometry.attributes.position.array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (elapsed > buffers.lifetimes[i]) continue;

        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;

        posArr[ix] += buffers.velocities[ix] * dt;
        posArr[iy] += buffers.velocities[iy] * dt;
        posArr[iz] += buffers.velocities[iz] * dt;

        // Aerodynamic drag
        buffers.velocities[ix] *= 0.96;
        buffers.velocities[iy] *= 0.96;
        buffers.velocities[iz] *= 0.96;
      }

      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.material.opacity = Math.max(0, 1 - Math.pow(progress, 1.5));
      pointsRef.current.material.size = Math.max(1, 4.5 * (1 - progress * 0.5));
    }
  });

  if (!target || !activeRef.current || !orientation) return null;

  const { origin, quaternion } = orientation;

  return (
    <group ref={groupRef} position={[origin.x, origin.y, origin.z]}>
      {/* 💥 Point Light Flash */}
      <pointLight
        ref={lightRef}
        color="#ff7733"
        distance={250}
        intensity={35}
        decay={2}
      />

      {/* 🔴 Core Nuclear Fireball Sphere */}
      <mesh ref={fireballRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color="#ff4411"
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ⚪ Shockwave Ring 1 (White-Hot Atmospheric Front) */}
      <mesh ref={ring1Ref} quaternion={quaternion}>
        <ringGeometry args={[0.85, 1.0, 48]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 🟠 Shockwave Ring 2 (Fiery Plasma Shockwave) */}
      <mesh ref={ring2Ref} quaternion={quaternion}>
        <ringGeometry args={[0.7, 0.95, 48]} />
        <meshBasicMaterial
          color="#ff5500"
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ✨ Multi-Color Plasma Particles & Mushroom Debris */}
      <points ref={pointsRef} position={[-origin.x, -origin.y, -origin.z]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={buffers.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={PARTICLE_COUNT}
            array={buffers.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={4.5}
          vertexColors
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
