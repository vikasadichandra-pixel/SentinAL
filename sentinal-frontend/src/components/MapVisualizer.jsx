import React, { useMemo, useState, useRef } from "react";
import { getCoordsForLocation } from "../utils/geo";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Globe } from "./ui/Globe";
import CountryParticles from "./ui/CountryParticles"; // Adjust path if your ui folder is structured differently

// --- Reverted Starry Background Particle System (Vibrant & Glowing) ---
const BackgroundParticles = ({ isHovered }) => {
  const pointsRef = useRef();

  const particlesCount = 4000;
  const positions = useMemo(() => {
    const pos = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      const r = 300 + Math.random() * 500;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    // Base subtle rotation
    pointsRef.current.rotation.y += delta * 0.03;
    pointsRef.current.rotation.x += delta * 0.02;

    if (isHovered) {
      // Speed up the vortex rotation dramatically on hover
      pointsRef.current.rotation.y += delta * 0.2;
      pointsRef.current.rotation.z -= delta * 0.1;
      pointsRef.current.scale.lerp(new THREE.Vector3(1.2, 1.2, 1.2), 0.05);
    } else {
      pointsRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={2.5}
        color={isHovered ? "#00ffff" : "#1e3a8a"}
        transparent
        opacity={0.6} // Reverted back to 0.6 for rich brightness
        blending={THREE.AdditiveBlending} // Reverted back to Additive Blending for the glow effect
        depthWrite={false}
      />
    </points>
  );
};

// --- MAIN VISUALIZER ---
const MapVisualizer = ({ violations }) => {
  const [isHovered, setIsHovered] = useState(false);

  const arcs = useMemo(
    () =>
      (violations || [])
        .map((v, index) => {
          const coords = getCoordsForLocation(v.location_code || v.location);
          if (!coords) return null;

          let threatColor = ["#990000", "#dc2626", "#ff2244"];
          if (v.breach_type === "PRE_RELEASE") {
            threatColor = ["#581c87", "#7e22ce", "#a855f7"];
          }
          if (v.breach_type === "TERRITORY") {
            threatColor = ["#7c2d12", "#c2410c", "#ea580c"];
          }

          return {
            id: v.id || index,
            order: index + 1,
            startLat: 19.0760,
            startLng: 72.8777,
            endLat: coords.lat,
            endLng: coords.lng,
            lat: coords.lat,
            lng: coords.lng,
            color: threatColor,
            baseColor: threatColor[2], // single solid hex for target rings
            location: v.location || v.location_name || v.location_code || "Target Region",
            assetName: v.asset_name || v.movie_title || "",
            breachType: v.breach_type || v.type || "THREAT DETECTED",
          };
        })
        .filter(Boolean),
    [violations]
  );

  return (
    <div
      className="w-full h-full bg-[#020617] flex items-center justify-center overflow-hidden cursor-crosshair relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-full h-full relative">
        <Canvas
          style={{ background: "#000000" }}
          camera={{ position: [0, 0, 600], fov: 45, far: 3000 }}
        >
          <ambientLight intensity={100.0} />
          <pointLight position={[100, 100, 100]} intensity={2.5} />
          <pointLight
            position={[-100, -100, -100]}
            intensity={1.5}
            color="#1d4ed8"
          />

          <BackgroundParticles isHovered={isHovered} />
          <CountryParticles />
          <Globe data={arcs} />

          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={20}
            maxDistance={800}
            autoRotate
            autoRotateSpeed={isHovered ? 1.5 : 0.5}
          />
        </Canvas>
      </div>
    </div>
  );
};

export default MapVisualizer;