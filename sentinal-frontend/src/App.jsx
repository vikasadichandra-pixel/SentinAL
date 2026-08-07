import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useViolations from "./hooks/useViolations";
import LiveThreatLog from "./components/LiveThreatLog";
import MapVisualizer from "./components/MapVisualizer";
import ActionConsole from "./components/ActionConsole";
import EnforceOverlay from "./components/EnforceOverlay";
import { getCoordsForLocation } from "./utils/geo";

// ─── Panel Animation Variants (Spring Physics Side-Zoom) ───
const leftPanelVariants = {
  hidden: {
    x: -400,
    scale: 0.9,
    opacity: 0,
  },
  visible: {
    x: 0,
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    x: -400,
    scale: 0.9,
    opacity: 0,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 30,
    },
  },
};

const rightPanelVariants = {
  hidden: {
    x: 400,
    scale: 0.9,
    opacity: 0,
  },
  visible: {
    x: 0,
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 25,
      mass: 0.8,
      delay: 0.15, // Stagger slightly after left panel
    },
  },
  exit: {
    x: 400,
    scale: 0.9,
    opacity: 0,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 30,
    },
  },
};

const collapseButtonVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: { duration: 0.12 },
  },
};

export default function App() {
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [globeReady, setGlobeReady] = useState(false);
  const { violations, loading, error } = useViolations();

  // Trigger HUD & side panels entrance smoothly ONLY after the 3D globe formation animation ends (~2.2s)
  const handleGlobeFormationComplete = useCallback(() => {
    setGlobeReady(true);
  }, []);

  React.useEffect(() => {
    // Safety fallback timer so panels always appear even if WebGL is disabled or headless
    const timer = setTimeout(() => {
      setGlobeReady(true);
    }, 3800);
    return () => clearTimeout(timer);
  }, []);

  // Keep selectedViolation in sync with live backend list
  React.useEffect(() => {
    if (!violations || violations.length === 0) return;
    setSelectedViolation((prev) => {
      if (!prev) return violations[0];
      const matched = violations.find((v) => v.id === prev.id);
      return matched || violations[0];
    });
  }, [violations]);

  // ─── Enforce Takedown Cinematic State ───
  const [enforceState, setEnforceState] = useState({
    active: false,
    pdfUrl: null,
    violation: null,
    buttonRect: null,
  });
  const [explosionTarget, setExplosionTarget] = useState(null);
  const [neutralizedCount, setNeutralizedCount] = useState(0);

  const openCount = useMemo(() => (violations ? violations.filter(v => v.status === 'OPEN').length : 0), [violations]);
  const enforcedCount = useMemo(() => (violations ? violations.filter(v => v.status === 'ENFORCED').length : 0), [violations]);

  // ─── Selecting a threat card in the log auto-opens the console ───
  const handleSelectViolation = useCallback((v) => {
    setSelectedViolation(v);
    setShowRight(true);
  }, []);

  // ─── Handle Enforce Success — triggers the cinematic sequence ───
  const handleEnforceSuccess = useCallback(({ pdfUrl, violation, buttonRect, directNotice }) => {
    // 1. Trigger globe explosion at the threat's coordinates (if fresh enforce)
    if (!directNotice) {
      const locationCode = violation?.location_code || violation?.location;
      const coords = getCoordsForLocation(locationCode);
      if (coords) {
        setExplosionTarget({ lat: coords.lat, lng: coords.lng });
        // Clear explosion target after it completes
        setTimeout(() => setExplosionTarget(null), 2000);
      }
      // Increment neutralized counter
      setNeutralizedCount(prev => prev + 1);
    }

    // 2. Activate the overlay
    setEnforceState({
      active: true,
      pdfUrl: pdfUrl,
      violation: violation,
      buttonRect: buttonRect,
      directNotice: !!directNotice,
    });
  }, []);

  // ─── Handle Enforce Overlay Dismiss — return to dashboard ───
  const handleEnforceDismiss = useCallback(() => {
    setEnforceState({
      active: false,
      pdfUrl: null,
      violation: null,
      buttonRect: null,
      directNotice: false,
    });
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden select-none font-mono scanline-sweep">

      {/* ☀️ ATMOSPHERIC GLOW BACKDROP */}
      <div
        className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-gradient-to-b from-red-600/15 via-orange-500/10 to-transparent rounded-full blur-[140px] pointer-events-none z-0"
      />

      {/* 🌌 HUD DOT GRID PATTERN */}
      <div className="absolute inset-0 pointer-events-none opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:28px_28px] z-0" />

      {/* 🧭 MINIMAL TOP HEADER — Smoothly drops down after globe forms */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={globeReady ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute top-0 left-0 right-0 z-30 px-6 py-4 flex items-center justify-between pointer-events-none"
      >
        {/* Brand Badge */}
        <div className="pointer-events-auto flex items-center gap-3 bg-zinc-950/75 backdrop-blur-xl px-4 py-2 rounded-lg border border-zinc-800/80 shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse" />
          <span className="text-xs font-bold tracking-widest text-zinc-100">
            SENTINAL <span className="text-red-500">//</span> ENFORCEMENT ENGINE
          </span>
        </div>

        {/* System Telemetry Tag */}
        <div className="pointer-events-auto flex items-center gap-4 bg-zinc-950/75 backdrop-blur-xl px-4 py-2 rounded-lg border border-zinc-800/80 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="tracking-wider text-emerald-400 font-semibold">ONLINE</span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-400">AI CORE: <span className="text-zinc-200">GEMINI 2.0 FLASH</span></span>
        </div>
      </motion.header>

      {/* 🌍 3D GLOBE CANVAS */}
      <main className="absolute inset-0 z-10 w-full h-full">
        <MapVisualizer
          violations={violations}
          explosionTarget={explosionTarget}
          onFormationComplete={handleGlobeFormationComplete}
        />
      </main>

      {/* ⬅️ LEFT PANEL: LIVE THREAT LOG (Enters only AFTER globe formation ends) */}
      <AnimatePresence mode="wait">
        {globeReady && (
          showLeft ? (
            <motion.aside
              key="left-panel"
              variants={leftPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute top-16 left-4 bottom-14 w-[350px] z-20"
              style={{ transformOrigin: "left center" }}
            >
              <div className="relative h-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-xl p-3 flex flex-col shadow-2xl shadow-black/80">
                {/* Header Control inside Panel */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60">
                  <span className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
                    Threat Surveillance
                  </span>
                  <button
                    onClick={() => setShowLeft(false)}
                    className="w-6 h-6 rounded bg-zinc-900/80 hover:bg-red-500/20 hover:border-red-500/50 border border-zinc-800 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer text-xs"
                    title="Collapse Panel"
                  >
                    ‹
                  </button>
                </div>

                <div className="flex-1 overflow-hidden">
                  <LiveThreatLog
                    violations={violations}
                    selectedViolation={selectedViolation}
                    loading={loading}
                    error={error}
                    onSelect={handleSelectViolation}
                  />
                </div>
              </div>
            </motion.aside>
          ) : (
            <motion.button
              key="left-trigger"
              variants={collapseButtonVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setShowLeft(true)}
              className="absolute top-20 left-0 z-30 bg-zinc-950/90 hover:bg-zinc-900 border-y border-r border-zinc-800 hover:border-red-500/50 text-zinc-400 hover:text-white px-2 py-4 rounded-r-lg flex flex-col items-center gap-1 cursor-pointer backdrop-blur-md transition-all shadow-lg"
              title="Expand Threat Log"
              whileHover={{ x: 3 }}
            >
              <span className="text-xs">›</span>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 [writing-mode:vertical-lr] my-1">LOGS</span>
            </motion.button>
          )
        )}
      </AnimatePresence>

      {/* ➡️ RIGHT PANEL: ACTION CONSOLE (Enters only AFTER globe formation ends) */}
      <AnimatePresence mode="wait">
        {globeReady && (
          showRight ? (
            <motion.aside
              key="right-panel"
              variants={rightPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute top-16 right-4 bottom-14 w-[360px] z-20"
              style={{ transformOrigin: "right center" }}
            >
              <div className="relative h-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-xl p-3 flex flex-col shadow-2xl shadow-black/80">
                {/* Header Control inside Panel */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60">
                  <button
                    onClick={() => setShowRight(false)}
                    className="w-6 h-6 rounded bg-zinc-900/80 hover:bg-red-500/20 hover:border-red-500/50 border border-zinc-800 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer text-xs"
                    title="Collapse Panel"
                  >
                    ›
                  </button>
                  <span className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
                    Enforcement Console
                  </span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <ActionConsole
                    selectedViolation={selectedViolation}
                    isLoading={loading}
                    onEnforceSuccess={handleEnforceSuccess}
                  />
                </div>
              </div>
            </motion.aside>
          ) : (
            <motion.button
              key="right-trigger"
              variants={collapseButtonVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setShowRight(true)}
              className="absolute top-20 right-0 z-30 bg-zinc-950/90 hover:bg-zinc-900 border-y border-l border-zinc-800 hover:border-red-500/50 text-zinc-400 hover:text-white px-2 py-4 rounded-l-lg flex flex-col items-center gap-1 cursor-pointer backdrop-blur-md transition-all shadow-lg"
              title="Expand Action Console"
              whileHover={{ x: -3 }}
            >
              <span className="text-xs">‹</span>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 [writing-mode:vertical-lr] my-1">CONSOLE</span>
            </motion.button>
          )
        )}
      </AnimatePresence>

      {/* 📊 BOTTOM TELEMETRY STATUS RIBBON — Glides up after globe forms */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={globeReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute bottom-0 left-0 right-0 z-30 px-6 py-2 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">ACTIVE THREATS:</span>
            <span className="font-bold text-red-400">{openCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">ENFORCED:</span>
            <span className="font-bold text-emerald-400">{enforcedCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">GEOFENCE GUARD:</span>
            <span className="text-zinc-200">ACTIVE</span>
          </div>
          {/* ─── Enforcement Counter (ML engagement feature) ─── */}
          {neutralizedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">NEUTRALIZED:</span>
              <span className="font-bold text-red-400">{neutralizedCount}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-zinc-500">
          <span>LATENCY: <span className="text-zinc-300">24ms</span></span>
          <span>CONFIDENCE: <span className="text-emerald-400">99.4%</span></span>
        </div>
      </motion.footer>

      {/* 🔴 ENFORCE TAKEDOWN CINEMATIC OVERLAY */}
      <EnforceOverlay
        enforceState={enforceState}
        onDismiss={handleEnforceDismiss}
      />

    </div>
  );
}