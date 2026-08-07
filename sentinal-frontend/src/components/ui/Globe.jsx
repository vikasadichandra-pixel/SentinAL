import { useEffect, useRef, useState, useMemo, memo } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { polar2Cartesian } from "../../utils/geoDots";

const SOURCE = { lat: 19.076, lng: 72.8777 }; // Mumbai HQ
const hqBase = polar2Cartesian(SOURCE.lat, SOURCE.lng, 101);
const hqTop = polar2Cartesian(SOURCE.lat, SOURCE.lng, 112);

const ThreatMarkerItem = memo(({ item }) => {
  const [isHovered, setIsHovered] = useState(false);

  const base = useMemo(
    () => polar2Cartesian(item.endLat || item.lat, item.endLng || item.lng, 101),
    [item.endLat, item.lat, item.endLng, item.lng]
  );
  const top = useMemo(
    () => polar2Cartesian(item.endLat || item.lat, item.endLng || item.lng, 112),
    [item.endLat, item.lat, item.endLng, item.lng]
  );

  const stemPoints = useMemo(
    () => [
      new THREE.Vector3(base.x, base.y, base.z),
      new THREE.Vector3(top.x, top.y, top.z),
    ],
    [base, top]
  );

  const markerColor = item.baseColor || "#ef4444";

  return (
    <group>
      {/* Invisible Hover Hitbox over threat target ripple */}
      <mesh
        position={[base.x, base.y, base.z]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setIsHovered(true);
        }}
        onPointerOut={() => setIsHovered(false)}
      >
        <sphereGeometry args={[22, 16, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* 3D PIN STEM + 3D HUD TEXT - ONLY APPEARS WHEN HOVERING OVER THREAT RIPPLE */}
      {isHovered && (
        <group raycast={() => null}>
          {/* 3D Laser Pin Line */}
          <line raycast={() => null}>
            <bufferGeometry attach="geometry" setFromPoints={stemPoints} />
            <lineBasicMaterial attach="material" color={markerColor} transparent opacity={0.85} />
          </line>

          {/* 3D Glowing Threat Beacon Dot */}
          <mesh position={[top.x, top.y, top.z]} raycast={() => null}>
            <sphereGeometry args={[0.7, 12, 12]} />
            <meshBasicMaterial color={markerColor} />
          </mesh>

          {/* 3D High-Contrast Callout Label showing Country Name */}
          <Html
            position={[top.x, top.y, top.z]}
            center
            style={{
              pointerEvents: "none",
            }}
          >
            <div className="flex items-center gap-1.5 select-none pointer-events-none animate-fadeIn transform -translate-y-3 bg-slate-950/90 border border-red-500/65 backdrop-blur-md px-2 py-0.5 rounded shadow-[0_0_12px_rgba(239,68,68,0.4)]">
              <span className="text-sm font-bold tracking-wider text-red-400 font-mono uppercase drop-shadow-[0_0_8px_rgba(239,68,68,0.9)] whitespace-nowrap">
                {item.location}
              </span>
              {item.assetName && (
                <span className="text-[10px] font-semibold text-white tracking-wide bg-red-950/90 border border-red-500/50 px-1.5 py-0.5 rounded text-red-200 shadow-sm whitespace-nowrap">
                  {item.assetName}
                </span>
              )}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
});

export const Globe = memo(({ data }) => {
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
    }
  }, [scene, camera]);

  useEffect(() => {
    if (!globeRef.current || !data) return;

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

    // 1. Render flight attack arcs with high curve resolution
    globeRef.current
      .arcsData(attackArcs)
      .arcColor((d) => d.color)
      .arcAltitude((d) => d.arcAlt ?? 0.35)
      .arcStroke((d) => d.stroke ?? 0.6)
      .arcDashLength((d) => d.dashLength ?? 0.5)
      .arcDashGap((d) => d.dashGap ?? 0.09)
      .arcDashAnimateTime((d) => d.animateTime ?? 2000)
      .arcCurveResolution(64);

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
      .ringMaxRadius(6)
      .ringPropagationSpeed(3.0)
      .ringRepeatPeriod(1000)
      .ringAltitude(0.006);
  }, [data]);

  return (
    <group>
      {/* Invisible Hover Hitbox over Mumbai HQ ripple */}
      <mesh
        position={[hqBase.x, hqBase.y, hqBase.z]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setIsHqHovered(true);
        }}
        onPointerOut={() => setIsHqHovered(false)}
      >
        <sphereGeometry args={[22, 16, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* TRUE 3D PIN STEM + 3D HUD TEXT - ONLY APPEARS WHEN HOVERING OVER MUMBAI RIPPLE */}
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
                Mumbai HQ
              </span>
            </div>
          </Html>
        </group>
      )}

      {/* Threat Target Ripple Markers */}
      {(data || []).map((item) => (
        <ThreatMarkerItem key={item.id || item.order} item={item} />
      ))}
    </group>
  );
});