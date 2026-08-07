import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { polar2Cartesian } from "../../utils/geoDots";

const PARTICLE_COUNT = 80;
const LIFETIME = 1.5; // seconds

/**
 * GlobeExplosion — GPU-friendly particle burst at a specific lat/lng on the globe.
 *
 * Rendered inside the R3F Canvas. When `target` changes from null to { lat, lng },
 * 80 particles burst outward along the surface normal with staggered lifetimes.
 * All position math runs CPU-side in useFrame (80 particles = negligible cost).
 * Single draw call via BufferGeometry + PointsMaterial with additive blending.
 *
 * @param {{ lat: number, lng: number } | null} target - The explosion origin
 * @param {Function} onComplete - Called when the explosion finishes
 */
export default function GlobeExplosion({ target, onComplete }) {
  const pointsRef = useRef();
  const startTimeRef = useRef(null);
  const activeRef = useRef(false);
  const completedRef = useRef(false);

  // Pre-allocate all buffers once (never re-created)
  const buffers = useMemo(() => ({
    positions: new Float32Array(PARTICLE_COUNT * 3),
    velocities: new Float32Array(PARTICLE_COUNT * 3),
    lifetimes: new Float32Array(PARTICLE_COUNT),
  }), []);

  // Initialize explosion when target changes
  useEffect(() => {
    if (!target) {
      activeRef.current = false;
      completedRef.current = false;
      return;
    }

    const origin = polar2Cartesian(target.lat, target.lng, 101);
    const normal = new THREE.Vector3(origin.x, origin.y, origin.z).normalize();

    // Create two tangent vectors for spread distribution
    const tangent1 = new THREE.Vector3();
    const tangent2 = new THREE.Vector3();
    if (Math.abs(normal.y) < 0.99) {
      tangent1.crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize();
    } else {
      tangent1.crossVectors(normal, new THREE.Vector3(1, 0, 0)).normalize();
    }
    tangent2.crossVectors(normal, tangent1).normalize();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Start at origin
      buffers.positions[i * 3] = origin.x;
      buffers.positions[i * 3 + 1] = origin.y;
      buffers.positions[i * 3 + 2] = origin.z;

      // Random velocity: mostly outward along normal, with tangent spread
      const speed = 15 + Math.random() * 55;
      const spreadAngle = (Math.random() - 0.5) * 1.2;
      const spreadAngle2 = (Math.random() - 0.5) * 1.2;

      const dir = new THREE.Vector3()
        .copy(normal)
        .addScaledVector(tangent1, Math.sin(spreadAngle) * 0.7)
        .addScaledVector(tangent2, Math.sin(spreadAngle2) * 0.7)
        .normalize()
        .multiplyScalar(speed);

      buffers.velocities[i * 3] = dir.x;
      buffers.velocities[i * 3 + 1] = dir.y;
      buffers.velocities[i * 3 + 2] = dir.z;

      buffers.lifetimes[i] = 0.4 + Math.random() * 1.0;
    }

    startTimeRef.current = performance.now();
    activeRef.current = true;
    completedRef.current = false;

    // Force initial position update
    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.attributes.position;
      posAttr.array.set(buffers.positions);
      posAttr.needsUpdate = true;
    }
  }, [target, buffers]);

  // Per-frame particle animation
  useFrame(() => {
    if (!activeRef.current || !pointsRef.current || !startTimeRef.current) return;

    const elapsed = (performance.now() - startTimeRef.current) / 1000;

    // Check if explosion is finished
    if (elapsed > LIFETIME) {
      if (!completedRef.current) {
        completedRef.current = true;
        activeRef.current = false;
        if (onComplete) onComplete();
      }
      return;
    }

    const posArr = pointsRef.current.geometry.attributes.position.array;
    const dt = Math.min(1 / 30, 0.033); // Cap delta to prevent jumps

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Skip dead particles
      if (elapsed > buffers.lifetimes[i]) continue;

      const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;

      // Update position
      posArr[ix] += buffers.velocities[ix] * dt;
      posArr[iy] += buffers.velocities[iy] * dt;
      posArr[iz] += buffers.velocities[iz] * dt;

      // Drag/deceleration
      buffers.velocities[ix] *= 0.97;
      buffers.velocities[iy] *= 0.97;
      buffers.velocities[iz] *= 0.97;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    // Fade opacity over lifetime
    const progress = elapsed / LIFETIME;
    pointsRef.current.material.opacity = Math.max(0, 1 - progress * progress);
    // Size decreases over time
    pointsRef.current.material.size = 3.5 * (1 - progress * 0.6);
  });

  if (!target || !activeRef.current) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={buffers.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={3.5}
        color="#ff3333"
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
