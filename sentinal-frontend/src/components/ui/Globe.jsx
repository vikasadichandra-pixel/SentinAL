import { useEffect, useRef, useState, useMemo, memo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { polar2Cartesian } from "../../utils/geoDots";

// Chandigarh HQ Coordinates (lat: 30.7333° N, lng: 76.7794° E)
const SOURCE = { lat: 30.7333, lng: 76.7794 };
const hqBase = polar2Cartesian(SOURCE.lat, SOURCE.lng, 101.5);
const hqTop = polar2Cartesian(SOURCE.lat, SOURCE.lng, 113);

// ─── Dedicated Animated 3D HQ Ripple Rings Component ───
const HqRippleRings = memo(({ position }) => {
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const ring3Ref = useRef();

  // Surface normal quaternion to orient rings tangential to the globe sphere
  const orientation = useMemo(() => {
    const normal = new THREE.Vector3(position.x, position.y, position.z).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    return q;
  }, [position.x, position.y, position.z]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 1.8;

    const animateRing = (ref, offset) => {
      if (!ref.current) return;
      const progress = (t + offset) % 1; // 0 to 1
      const scale = 1.0 + progress * 7.5; // grows outward
      ref.current.scale.set(scale, scale, 1);
      ref.current.material.opacity = Math.pow(1 - progress, 1.4) * 0.9;
    };

    animateRing(ring1Ref, 0.0);
    animateRing(ring2Ref, 0.33);
    animateRing(ring3Ref, 0.66);
  });

  return (
    <group position={[position.x, position.y, position.z]} quaternion={orientation}>
      {/* Concentric Expanding Ripple 1 */}
      <mesh ref={ring1Ref}>
        <ringGeometry args={[0.8, 1.25, 32]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Concentric Expanding Ripple 2 */}
      <mesh ref={ring2Ref}>
        <ringGeometry args={[0.8, 1.25, 32]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Concentric Expanding Ripple 3 */}
      <mesh ref={ring3Ref}>
        <ringGeometry args={[0.8, 1.25, 32]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Static Inner Tactical Ring */}
      <mesh>
        <ringGeometry args={[1.3, 1.6, 32]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Central Glowing Beacon Core */}
      <mesh position={[0, 0, 0.1]}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial
          color="#38bdf8"
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
});

// ─── Threat Marker Theme Resolver (Matches trajectory colors) ───
const getMarkerTheme = (item) => {
  const breach = (item.breachType || "").toUpperCase();
  const color = (item.baseColor || "").toLowerCase();

  if (
    breach === "PRE_RELEASE" ||
    breach === "HIGH" ||
    color.includes("a855f7") ||
    color.includes("7e22ce") ||
    color.includes("purple")
  ) {
    return {
      container: "border-purple-500/65 shadow-[0_0_12px_rgba(168,85,247,0.4)]",
      location: "text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]",
      asset: "bg-purple-950/90 border-purple-500/50 text-purple-200",
    };
  }

  if (
    breach === "TERRITORY" ||
    breach === "LOW" ||
    color.includes("ea580c") ||
    color.includes("f97316") ||
    color.includes("c2410c") ||
    color.includes("orange")
  ) {
    return {
      container: "border-orange-500/65 shadow-[0_0_12px_rgba(249,115,22,0.4)]",
      location: "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.9)]",
      asset: "bg-orange-950/90 border-orange-500/50 text-orange-200",
    };
  }

  // Default: Red (PIRACY / MED / etc.)
  return {
    container: "border-red-500/65 shadow-[0_0_12px_rgba(239,68,68,0.4)]",
    location: "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]",
    asset: "bg-red-950/90 border-red-500/50 text-red-200",
  };
};

const ThreatMarkerItem = memo(({ items, onThreatHover, onThreatUnhover }) => {
  const [isHovered, setIsHovered] = useState(false);
  const primaryItem = items[0];

  const base = useMemo(
    () => polar2Cartesian(primaryItem.endLat || primaryItem.lat, primaryItem.endLng || primaryItem.lng, 101.5),
    [primaryItem.endLat, primaryItem.lat, primaryItem.endLng, primaryItem.lng]
  );

  // Compute forked card positions — each violation gets its own branch
  const cardBranches = useMemo(() => {
    const lat = primaryItem.endLat || primaryItem.lat;
    const lng = primaryItem.endLng || primaryItem.lng;
    const baseVec = new THREE.Vector3(base.x, base.y, base.z);

    if (items.length === 1) {
      // Single item — straight pin up
      const topPos = polar2Cartesian(lat, lng, 113);
      return [{
        top: topPos,
        stemPoints: [baseVec.clone(), new THREE.Vector3(topPos.x, topPos.y, topPos.z)],
        color: items[0].baseColor || "#ef4444",
      }];
    }

    // Multiple items — fan out side by side along the globe surface tangent
    const normal = baseVec.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3().crossVectors(normal, up).normalize();
    // Handle pole edge case where cross product with up is near-zero
    if (tangent.lengthSq() < 0.001) {
      tangent.crossVectors(normal, new THREE.Vector3(1, 0, 0)).normalize();
    }

    // Bitangent for vertical separation (perpendicular to both normal and tangent)
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    const topCenter = polar2Cartesian(lat, lng, 122);
    const centerVec = new THREE.Vector3(topCenter.x, topCenter.y, topCenter.z);
    const spread = 30; // Horizontal units to separate each card
    const verticalSpread = 10; // Vertical offset per card for extra separation
    const count = items.length;

    return items.map((item, i) => {
      const hOffset = (i - (count - 1) / 2) * spread;
      const vOffset = (i - (count - 1) / 2) * verticalSpread;
      const pos = centerVec.clone()
        .add(tangent.clone().multiplyScalar(hOffset))
        .add(bitangent.clone().multiplyScalar(vOffset));
      return {
        top: { x: pos.x, y: pos.y, z: pos.z },
        stemPoints: [baseVec.clone(), pos.clone()],
        color: item.baseColor || "#ef4444",
      };
    });
  }, [items, primaryItem, base]);

  const handlePointerOver = (e) => {
    e.stopPropagation();
    setIsHovered(true);
    if (onThreatHover) onThreatHover(primaryItem);
  };

  const handlePointerOut = () => {
    setIsHovered(false);
    if (onThreatUnhover) onThreatUnhover();
  };

  return (
    <group>
      {/* Invisible Hover Hitbox over threat target ripple */}
      <mesh
        position={[base.x, base.y, base.z]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[22, 16, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* 3D FORKED PIN STEMS + SIDE-BY-SIDE HUD LABELS — ONLY VISIBLE ON HOVER */}
      {isHovered && (
        <group raycast={() => null}>
          {cardBranches.map((branch, idx) => {
            const item = items[idx];
            const theme = getMarkerTheme(item);
            return (
              <group key={item.id || idx}>
                {/* 3D Laser Stem Line branching from ripple to this card */}
                <line raycast={() => null}>
                  <bufferGeometry attach="geometry" setFromPoints={branch.stemPoints} />
                  <lineBasicMaterial attach="material" color={branch.color} transparent opacity={0.85} />
                </line>

                {/* 3D Glowing Beacon Dot at branch tip */}
                <mesh position={[branch.top.x, branch.top.y, branch.top.z]} raycast={() => null}>
                  <sphereGeometry args={[0.7, 12, 12]} />
                  <meshBasicMaterial color={branch.color} />
                </mesh>

                {/* Card label at this branch position */}
                <Html
                  position={[branch.top.x, branch.top.y, branch.top.z]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <div className={`flex items-center gap-1.5 select-none pointer-events-none animate-fadeIn transform -translate-y-3 bg-slate-950/90 border backdrop-blur-md px-2 py-0.5 rounded ${theme.container}`}>
                    <span className={`text-sm font-bold tracking-wider font-mono uppercase whitespace-nowrap ${theme.location}`}>
                      {item.location}
                    </span>
                    {item.assetName && (
                      <span className={`text-[10px] font-semibold tracking-wide border px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ${theme.asset}`}>
                        {item.assetName}
                      </span>
                    )}
                    {items.length > 1 && (
                      <span className={`text-[8px] font-black tracking-widest uppercase whitespace-nowrap ${theme.location}`}>
                        {item.breachType}
                      </span>
                    )}
                  </div>
                </Html>
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
});

export const Globe = memo(({ data, onThreatHover, onThreatUnhover }) => {
  const globeRef = useRef();
  const { scene, camera } = useThree();
  const [isHqHovered, setIsHqHovered] = useState(false);

  const stemPoints = useMemo(
    () => [
      new THREE.Vector3(hqBase.x, hqBase.y, hqBase.z),
      new THREE.Vector3(hqTop.x, hqTop.y, hqTop.z),
    ],
    []
  );

  useEffect(() => {
    if (!globeRef.current) {
      const globe = new ThreeGlobe()
        .globeImageUrl(null)
        .showAtmosphere(true)
        .atmosphereColor("#1d4ed8")
        .atmosphereAltitude(0.15);

      globeRef.current = globe;
      scene.add(globe);

      const radius = 600;
      const phi = (90 - SOURCE.lat) * (Math.PI / 180);
      const theta = (90 - SOURCE.lng) * (Math.PI / 180);

      camera.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(0, 0, 0);

      // Initial HQ ring render immediately
      const hqRing = { lat: SOURCE.lat, lng: SOURCE.lng, color: "#38bdf8" };
      globe
        .ringsData([hqRing])
        .ringColor((d) => d.color)
        .ringMaxRadius(7)
        .ringPropagationSpeed(3.2)
        .ringRepeatPeriod(900)
        .ringAltitude(0.02);
    }

    return () => {
      if (globeRef.current) {
        scene.remove(globeRef.current);
        globeRef.current = null;
      }
    };
  }, [scene, camera]);

  const lastDataKeyRef = useRef("");

  useEffect(() => {
    if (!globeRef.current || !data) return;

    const dataKey = data.map((d) => `${d.id}-${d.baseColor}-${d.endLat}-${d.endLng}`).join("|");
    if (lastDataKeyRef.current === dataKey) return;
    lastDataKeyRef.current = dataKey;

    // Dual-layer arcs: a solid dark background trajectory line + bold moving laser pulse
    const attackArcs = data.flatMap((d, i) => [
      {
        ...d,
        color: Array.isArray(d.color) ? [d.color[0], d.color[1]] : d.color,
        stroke: 0.7,
        dashLength: 1.0,
        dashGap: 0,
        animateTime: 0,
      },
      {
        ...d,
        color: d.color,
        stroke: 1.4,
        dashLength: 0.45,
        dashGap: 0.55,
        animateTime: 1600 + (i % 3) * 400,
      },
    ]);

    // 1. Render flight attack arcs with smooth curve resolution
    globeRef.current
      .arcsData(attackArcs)
      .arcColor((d) => d.color)
      .arcAltitude((d) => d.arcAlt ?? 0.35)
      .arcStroke((d) => d.stroke ?? 0.6)
      .arcDashLength((d) => d.dashLength ?? 0.5)
      .arcDashGap((d) => d.dashGap ?? 0.09)
      .arcDashAnimateTime((d) => d.animateTime ?? 2000)
      .arcCurveResolution(36);

    // 2. Render target threat points and HQ ripples
    const hqRing = { lat: SOURCE.lat, lng: SOURCE.lng, color: "#38bdf8" };
    const ringData = data.map((d) => ({
      ...d,
      color: d.baseColor || (Array.isArray(d.color) ? d.color[2] : d.color),
    }));
    const allRings = [hqRing, ...ringData];

    globeRef.current
      .ringsData(allRings)
      .ringColor((d) => d.color)
      .ringMaxRadius(7)
      .ringPropagationSpeed(3.2)
      .ringRepeatPeriod(900)
      .ringAltitude(0.02);
  }, [data]);

  const handleHqPointerOver = (e) => {
    e.stopPropagation();
    setIsHqHovered(true);
    if (onThreatHover) onThreatHover({ location: "Chandigarh HQ" });
  };

  const handleHqPointerOut = () => {
    setIsHqHovered(false);
    if (onThreatUnhover) onThreatUnhover();
  };

  // Group threat markers by location so overlapping violations share one ripple ring
  const groupedMarkers = useMemo(() => {
    if (!data) return [];
    const groups = {};
    data.forEach((item) => {
      const key = `${(item.endLat || item.lat).toFixed(4)}_${(item.endLng || item.lng).toFixed(4)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.values(groups);
  }, [data]);

  return (
    <group>
      {/* ─── 3D Glowing Animated Ripple Rings around Chandigarh HQ ─── */}
      <HqRippleRings position={hqBase} />

      {/* Invisible Hover Hitbox over Chandigarh HQ ripple */}
      <mesh
        position={[hqBase.x, hqBase.y, hqBase.z]}
        onPointerOver={handleHqPointerOver}
        onPointerOut={handleHqPointerOut}
      >
        <sphereGeometry args={[24, 16, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* TRUE 3D PIN STEM + 3D HUD TEXT - ONLY APPEARS WHEN HOVERING OVER CHANDIGARH RIPPLE */}
      {isHqHovered && (
        <group raycast={() => null}>
          {/* 3D Cyan Laser Pin Line rising from Globe Surface */}
          <line raycast={() => null}>
            <bufferGeometry attach="geometry" setFromPoints={stemPoints} />
            <lineBasicMaterial attach="material" color="#38bdf8" transparent opacity={0.85} />
          </line>

          {/* 3D Glowing Beacon Dot at Top of Pin */}
          <mesh position={[hqTop.x, hqTop.y, hqTop.z]} raycast={() => null}>
            <sphereGeometry args={[0.7, 12, 12]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>

          {/* True 3D Transformed High-Contrast Text Label */}
          <Html
            position={[hqTop.x, hqTop.y, hqTop.z]}
            center
            style={{
              pointerEvents: "none",
            }}
          >
            <div className="flex items-center gap-1.5 select-none pointer-events-none animate-fadeIn transform -translate-y-3 bg-slate-950/90 border border-sky-400/60 backdrop-blur-md px-2 py-0.5 rounded shadow-[0_0_12px_rgba(56,189,248,0.4)]">
              <span className="text-sm font-bold tracking-wider text-sky-400 font-mono uppercase drop-shadow-[0_0_8px_rgba(56,189,248,0.9)] whitespace-nowrap">
                Headquarters
              </span>
              <span className="text-[10px] font-semibold text-white tracking-wide bg-sky-950/90 border border-sky-400/50 px-1.5 py-0.5 rounded text-sky-200 shadow-sm whitespace-nowrap">
                Chandigarh HQ
              </span>
            </div>
          </Html>
        </group>
      )}

      {/* Threat Target Ripple Markers (Grouped by Location) */}
      {groupedMarkers.map((items, idx) => (
        <ThreatMarkerItem
          key={items.map(i => i.id || i.order).join('-')}
          items={items}
          onThreatHover={onThreatHover}
          onThreatUnhover={onThreatUnhover}
        />
      ))}
    </group>
  );
});