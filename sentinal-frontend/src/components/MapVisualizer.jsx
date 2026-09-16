import React, { useMemo, useState, useRef } from "react";
import { getCoordsForLocation } from "../utils/geo";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Globe } from "./ui/Globe";
import CountryParticles from "./ui/CountryParticles";
import GlobeExplosion from "./ui/GlobeExplosion";
import useGlobeRotation from "../hooks/useGlobeRotation";

// --- Reverted Starry Background Particle System (Vibrant & Lightweight) ---
const BackgroundParticles = ({ isHovered }) => {
  const pointsRef = useRef();

  const particlesCount = 1200;
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
      // Speed up the vortex rotation on hover
      pointsRef.current.rotation.y += delta * 0.15;
      pointsRef.current.rotation.z -= delta * 0.08;
      pointsRef.current.scale.lerp(new THREE.Vector3(1.15, 1.15, 1.15), 0.05);
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
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// --- MAIN VISUALIZER ---
const MapVisualizer = React.memo(({ violations, explosionTarget, onFormationComplete }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Globe rotation control with smooth pause on threat hover
  const {
    autoRotateSpeed,
    handleThreatHover,
    handleThreatUnhover,
    isThreatHovered,
  } = useGlobeRotation(0.5, 4500);

  const arcs = useMemo(
    () => {
      const rawArcs = (violations || [])
        .filter((v) => v.status === "OPEN" || !v.status)
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
            startLat: 30.7333,
            startLng: 76.7794,
            endLat: coords.lat,
            endLng: coords.lng,
            lat: coords.lat,
            lng: coords.lng,
            color: threatColor,
            baseColor: threatColor[2],
            location: v.location || v.location_name || v.location_code || "Target Region",
            assetName: v.asset_name || v.movie_title || "",
            breachType: v.breach_type || v.type || "THREAT DETECTED",
          };
        })
        .filter(Boolean);

      // Stagger arc altitudes so overlapping arcs to the same country are visually distinct
      const locationIndex = {};
      rawArcs.forEach((arc) => {
        const key = `${arc.endLat}_${arc.endLng}`;
        const idx = locationIndex[key] || 0;
        arc.arcAlt = 0.25 + idx * 0.18;
        locationIndex[key] = idx + 1;
      });

      return rawArcs;
    },
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
          dpr={[1, 1.5]}
          gl={{
            powerPreference: "high-performance",
            antialias: true,
            alpha: false,
          }}
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
          <CountryParticles onFormationComplete={onFormationComplete} />
          <Globe
            data={arcs}
            onThreatHover={handleThreatHover}
            onThreatUnhover={handleThreatUnhover}
          />

          {/* Globe Explosion Effect — triggered on enforce */}
          <GlobeExplosion target={explosionTarget} />

          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={20}
            maxDistance={800}
            autoRotate
            autoRotateSpeed={isThreatHovered ? autoRotateSpeed : (isHovered ? 1.5 : autoRotateSpeed)}
          />
        </Canvas>
      </div>
    </div>
  );
});

export default MapVisualizer;