---
name: SentinAL Architecture
description: Architecture and component patterns for the SentinAL cybersecurity enforcement dashboard frontend
---

# SentinAL Architecture Patterns

## Stack
- **Frontend**: React 19 + Vite 7 + Tailwind CSS v4 (`@import "tailwindcss"` in index.css) + Three.js/R3F + framer-motion
- **Backend**: Django REST Framework (polled every 2s)
- **3D**: three-globe + @react-three/fiber + @react-three/drei

## Data Flow
```
useViolations hook
  → polls /api/violations/ every 2s
  → feeds App.jsx state (violations, loading, error)
  → distributes to:
    ├── LiveThreatLog (left panel — scrollable card list)
    ├── MapVisualizer → Globe (3D earth with arcs, rings, threat markers)
    └── ActionConsole (right panel — verify/enforce actions)
```

## Component Hierarchy
```
App.jsx
├── header (brand badge + system telemetry)
├── MapVisualizer (full-screen 3D canvas)
│   ├── BackgroundParticles (starfield)
│   ├── CountryParticles (point-cloud earth mesh, custom shaders)
│   └── Globe (three-globe arcs/rings + ThreatMarkerItem hover pins)
├── LiveThreatLog (left aside panel, toggle-able)
├── ActionConsole (right aside panel, toggle-able)
└── footer (telemetry status ribbon)
```

## Key Patterns
- **Panel toggle**: `showLeft`/`showRight` useState booleans with AnimatePresence for animated mount/unmount
- **Auth**: Token-based via `VITE_API_TOKEN` env variable → `Authorization: Token <token>` header
- **Styling**: Tailwind utility classes in JSX + custom CSS in App.css for keyframe animations (shimmer, pulse, breathe)
- **Globe coordinates**: `polar2Cartesian()` from utils/geoDots.js — lat/lng → xyz aligned with ThreeGlobe internals
- **Rotation control**: `useGlobeRotation` hook manages smooth autoRotateSpeed transitions with RAF lerp loop
