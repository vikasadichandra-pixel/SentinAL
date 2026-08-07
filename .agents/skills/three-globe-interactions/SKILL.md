---
name: Three-Globe Interaction Patterns
description: Hover detection, marker rendering, and interaction patterns for the SentinAL 3D globe visualization
---

# Three-Globe Interaction Patterns

## Hover Detection
- **Invisible hitbox meshes**: `<mesh>` with `<meshBasicMaterial visible={false} />` placed at each threat location
- Sphere geometry (radius 22) for reliable raycasting area
- `onPointerOver` / `onPointerOut` events on the invisible mesh

## Callout Labels
- `<Html>` component from `@react-three/drei` positioned at pin top coordinates
- Styled with Tailwind classes directly in JSX
- Always set `pointerEvents: "none"` on the style prop to prevent interference
- Use `center` prop for automatic centering

## 3D Pins
- `<line>` geometry from base position (radius 101) to top position (radius 112)
- Sphere beacon at top (radius 0.7)
- Both use `raycast={() => null}` to prevent raycast interference

## Raycast Blocking
- Decorative/label elements must have `raycast={() => null}` to not interfere with hover detection
- Groups wrapping decorative content also get `raycast={() => null}`

## CountryParticles Physics
- Spring-based system: `SPRING_STRENGTH = 30.0`, `DAMPING = 0.75`
- Push-on-hover using surface normals (`PUSH_STRENGTH = 150`, `HOVER_RADIUS = 18`)
- `excite` attribute for shader feedback (glow on pushed dots)
- Assembly animation: particles start from radial space positions → converge to globe surface over ~0.5s

## Globe Rotation Pause
- Managed by `useGlobeRotation` hook
- Smooth deceleration/acceleration via RAF lerp loop (ease-in-out)
- 4.5s hold after unhover before resume
- Timer cancellation on re-hover during cooldown

## Coordinate Conversion
```javascript
// polar2Cartesian(lat, lng, radius) → { x, y, z }
// Aligned with ThreeGlobe's internal orientation:
// phi = (90 - lat) * (π / 180)
// theta = (90 - lng) * (π / 180)
```
