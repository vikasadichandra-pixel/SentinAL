import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import worldData from "../../assets/globe.json";
import { isOnLand, fibonacciSphereLatLng, polar2Cartesian } from "../../utils/geoDots";

const SAMPLE_COUNT = 13000;
const GLOBE_RADIUS = 100;
const HOVER_RADIUS = 18;
const HOVER_RADIUS_SQ = HOVER_RADIUS * HOVER_RADIUS;
const PUSH_STRENGTH = 150;
const SPRING_STRENGTH = 30.0;
const DAMPING = 0.75;
const EXCITE_SMOOTHING = 8;

const VERTEX_SHADER = `
  attribute float aExcite;
  varying float vExcite;
  varying float vNormalY;

  void main() {
    vExcite = aExcite;
    vNormalY = normalize(position).y;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // Minimal dot size growth on hover to keep globe mesh smooth
    float baseSize = 2.5 + aExcite * 0.8; 
    
    gl_PointSize = baseSize * (600.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uEquatorColor;
  uniform vec3 uPoleColor;
  uniform float uOpacity;
  varying float vExcite;
  varying float vNormalY;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.05, d) * uOpacity;
    vec3 color = mix(uPoleColor, uEquatorColor, 1.0 - abs(vNormalY));

    // Solid white output
    gl_FragColor = vec4(color, alpha);
  }
`;

export default function CountryParticles({
    equatorColor = "#ffffff",
    poleColor = "#ffffff",
    opacity = 1.0,
    onFormationComplete,
}) {
    const pointsRef = useRef();

    const uniforms = useMemo(
        () => ({
            uEquatorColor: { value: new THREE.Color(equatorColor) },
            uPoleColor: { value: new THREE.Color(poleColor) },
            uOpacity: { value: opacity },
        }),
        [equatorColor, poleColor, opacity]
    );

    const hoverPoint = useRef(new THREE.Vector3());
    const isHoveringRef = useRef(false);
    const hasCompletedRef = useRef(false);

    const { positions, homes, startPositions, normals, aExcite, count } = useMemo(() => {
        const candidates = fibonacciSphereLatLng(SAMPLE_COUNT);
        const kept = candidates.filter(({ lat, lng }) => isOnLand(lng, lat, worldData.features));

        const count = kept.length;
        const positions = new Float32Array(count * 3);
        const homes = new Float32Array(count * 3);
        const startPositions = new Float32Array(count * 3);
        const normals = new Float32Array(count * 3);

        kept.forEach(({ lat, lng }, i) => {
            const p = polar2Cartesian(lat, lng, GLOBE_RADIUS);
            const n = new THREE.Vector3(p.x, p.y, p.z).normalize();

            homes[i * 3] = p.x;
            homes[i * 3 + 1] = p.y;
            homes[i * 3 + 2] = p.z;

            // Majestic outer space starting positions extending radially in a cosmic swirl
            const spaceDistance = 320 + (i % 50) * 12 + Math.sin(i * 0.08) * 90;
            const sx = n.x * (GLOBE_RADIUS + spaceDistance);
            const sy = n.y * (GLOBE_RADIUS + spaceDistance);
            const sz = n.z * (GLOBE_RADIUS + spaceDistance);

            startPositions[i * 3] = sx;
            startPositions[i * 3 + 1] = sy;
            startPositions[i * 3 + 2] = sz;

            // Start particles positioned in surrounding space shell
            positions[i * 3] = sx;
            positions[i * 3 + 1] = sy;
            positions[i * 3 + 2] = sz;

            normals[i * 3] = n.x;
            normals[i * 3 + 1] = n.y;
            normals[i * 3 + 2] = n.z;
        });

        const aExcite = new Float32Array(count);
        return { positions, homes, startPositions, normals, aExcite, count };
    }, []);

    const progressRef = useRef(0);
    const settledRef = useRef(false);

    useFrame((state, delta) => {
        const geom = pointsRef.current?.geometry;
        if (!geom) return;

        const arr = geom.attributes.position.array;
        const exciteArr = geom.attributes.aExcite.array;
        const isHovering = isHoveringRef.current;
        const hp = hoverPoint.current;
        const dt = Math.min(delta, 0.05);

        // 1. Formation Phase: cosmic swirl into globe surface (~2.1s)
        if (progressRef.current < 1) {
            const FORMATION_RATE = 0.48;
            progressRef.current = Math.min(1, progressRef.current + dt * FORMATION_RATE);
            const p = progressRef.current;

            // Smooth cubic ease-out
            const ease = 1 - Math.pow(1 - p, 2.5);
            const swirlAngle = (1 - ease) * 0.25;
            const cosA = Math.cos(swirlAngle);
            const sinA = Math.sin(swirlAngle);

            for (let i = 0; i < count; i++) {
                const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;

                const targetX = startPositions[ix] + (homes[ix] - startPositions[ix]) * ease;
                const targetY = startPositions[iy] + (homes[iy] - startPositions[iy]) * ease;
                const targetZ = startPositions[iz] + (homes[iz] - startPositions[iz]) * ease;

                if (p < 0.98) {
                    arr[ix] = targetX * cosA - targetZ * sinA;
                    arr[iy] = targetY;
                    arr[iz] = targetX * sinA + targetZ * cosA;
                } else {
                    arr[ix] = targetX;
                    arr[iy] = targetY;
                    arr[iz] = targetZ;
                }
            }

            geom.attributes.position.needsUpdate = true;
            geom.attributes.aExcite.needsUpdate = true;

            if (progressRef.current >= 0.98 && !hasCompletedRef.current) {
                hasCompletedRef.current = true;
                if (onFormationComplete) onFormationComplete();
            }
            return;
        }

        // 2. Post-Formation Permanent State: 0% CPU when idle, active only on cursor hover
        if (!isHovering) {
            if (!settledRef.current) {
                for (let i = 0; i < count; i++) {
                    const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
                    arr[ix] = homes[ix];
                    arr[iy] = homes[iy];
                    arr[iz] = homes[iz];
                    exciteArr[i] = 0;
                }
                geom.attributes.position.needsUpdate = true;
                geom.attributes.aExcite.needsUpdate = true;
                settledRef.current = true;
            }
            return; // ⚡ Zero CPU usage during normal globe rotation
        }

        // When cursor is actively hovering over globe:
        settledRef.current = false;
        for (let i = 0; i < count; i++) {
            const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
            const dx = homes[ix] - hp.x;
            const dy = homes[iy] - hp.y;
            const dz = homes[iz] - hp.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < HOVER_RADIUS_SQ) {
                const dist = Math.sqrt(distSq);
                const pushFactor = (1 - dist / HOVER_RADIUS) ** 2;
                const strength = pushFactor * 14.0;
                arr[ix] = homes[ix] + normals[ix] * strength;
                arr[iy] = homes[iy] + normals[iy] * strength;
                arr[iz] = homes[iz] + normals[iz] * strength;
                exciteArr[i] = pushFactor;
            } else {
                arr[ix] = homes[ix];
                arr[iy] = homes[iy];
                arr[iz] = homes[iz];
                exciteArr[i] = 0;
            }
        }
        geom.attributes.position.needsUpdate = true;
        geom.attributes.aExcite.needsUpdate = true;
    });

    return (
        <>
            {/* Dark core globe sphere beneath particles for rich depth */}
            <mesh>
                <sphereGeometry args={[GLOBE_RADIUS - 0.8, 48, 48]} />
                <meshBasicMaterial color="#020817" />
            </mesh>

            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={count}
                        array={positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-aExcite"
                        count={count}
                        array={aExcite}
                        itemSize={1}
                    />
                </bufferGeometry>
                <shaderMaterial
                    uniforms={uniforms}
                    vertexShader={VERTEX_SHADER}
                    fragmentShader={FRAGMENT_SHADER}
                    transparent
                    depthWrite={false}
                />
            </points>

            <mesh
                onPointerMove={(e) => { 
                    isHoveringRef.current = true;
                    hoverPoint.current.copy(e.point); 
                }}
                onPointerOut={() => {
                    isHoveringRef.current = false;
                    settledRef.current = false;
                }}
            >
                <sphereGeometry args={[GLOBE_RADIUS + 2, 32, 32]} />
                <meshBasicMaterial visible={false} />
            </mesh>
        </>
    );
}