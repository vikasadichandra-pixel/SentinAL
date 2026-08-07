import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import worldData from "../../assets/globe.json";
import { isOnLand, fibonacciSphereLatLng, polar2Cartesian } from "../../utils/geoDots";

const SAMPLE_COUNT = 20000;
const GLOBE_RADIUS = 100;
const HOVER_RADIUS = 18;
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

    const hoverPoint = useRef(null);

    const { positions, homes, startPositions, normals, count } = useMemo(() => {
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

            // Structured outer space starting positions extending radially from globe normal
            const spaceDistance = 220 + (i % 40) * 8 + Math.sin(i * 0.05) * 60;
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

        return { positions, homes, startPositions, normals, count };
    }, []);

    const velocitiesRef = useRef();
    const exciteRef = useRef();
    const progressRef = useRef(0);

    if (!velocitiesRef.current) velocitiesRef.current = new Float32Array(count * 3);
    if (!exciteRef.current) exciteRef.current = new Float32Array(count);

    useFrame((state, delta) => {
        const geom = pointsRef.current?.geometry;
        if (!geom) return;

        const arr = geom.attributes.position.array;
        const exciteArr = geom.attributes.aExcite.array;
        const velocities = velocitiesRef.current;
        const hp = hoverPoint.current;
        const dt = Math.min(delta, 0.05);

        // Fast assembly progress from surrounding space -> globe surface (~0.5s)
        if (progressRef.current < 1) {
            progressRef.current = Math.min(1, progressRef.current + dt * 1.8);
        }

        const p = progressRef.current;
        // Fast linear-accelerated easing to maintain high velocity at the end
        const ease = Math.pow(p, 1.2);
        const swirlAngle = (1 - ease) * 0.08;

        const cosA = Math.cos(swirlAngle);
        const sinA = Math.sin(swirlAngle);

        const currentSpring = p > 0.7 ? 60.0 : SPRING_STRENGTH;

        for (let i = 0; i < count; i++) {
            const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;

            // Target position smoothly moves from galaxy space to globe home
            let targetX = startPositions[ix] + (homes[ix] - startPositions[ix]) * ease;
            let targetY = startPositions[iy] + (homes[iy] - startPositions[iy]) * ease;
            let targetZ = startPositions[iz] + (homes[iz] - startPositions[iz]) * ease;

            if (p < 0.98) {
                // Swirl particles around Y axis while assembling
                const rx = targetX * cosA - targetZ * sinA;
                const rz = targetX * sinA + targetZ * cosA;
                targetX = rx;
                targetZ = rz;
            }

            let fx = (targetX - arr[ix]) * currentSpring;
            let fy = (targetY - arr[iy]) * currentSpring;
            let fz = (targetZ - arr[iz]) * currentSpring;

            let pushFactor = 0;
            if (hp && p >= 0.85) {
                const dx = homes[ix] - hp.x, dy = homes[iy] - hp.y, dz = homes[iz] - hp.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
                if (dist < HOVER_RADIUS) {
                    pushFactor = (1 - dist / HOVER_RADIUS) ** 2;
                    const strength = pushFactor * PUSH_STRENGTH;
                    fx += normals[ix] * strength;
                    fy += normals[iy] * strength;
                    fz += normals[iz] * strength;
                }
            }

            velocities[ix] = (velocities[ix] + fx * dt) * DAMPING;
            velocities[iy] = (velocities[iy] + fy * dt) * DAMPING;
            velocities[iz] = (velocities[iz] + fz * dt) * DAMPING;

            arr[ix] += velocities[ix] * dt;
            arr[iy] += velocities[iy] * dt;
            arr[iz] += velocities[iz] * dt;

            exciteArr[i] += (pushFactor - exciteArr[i]) * Math.min(1, dt * EXCITE_SMOOTHING);
        }

        geom.attributes.position.needsUpdate = true;
        geom.attributes.aExcite.needsUpdate = true;
    });

    return (
        <>
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
                        array={exciteRef.current}
                        itemSize={1}
                    />
                </bufferGeometry>
                {/* Removed Additive Blending to keep it stark white */}
                <shaderMaterial
                    uniforms={uniforms}
                    vertexShader={VERTEX_SHADER}
                    fragmentShader={FRAGMENT_SHADER}
                    transparent
                    depthWrite={false}
                />
            </points>

            <mesh
                onPointerMove={(e) => { hoverPoint.current = e.point.clone(); }}
                onPointerOut={() => { hoverPoint.current = null; }}
            >
                <sphereGeometry args={[GLOBE_RADIUS, 32, 32]} />
                <meshBasicMaterial visible={false} />
            </mesh>
        </>
    );
}