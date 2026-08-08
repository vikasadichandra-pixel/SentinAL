import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * EnforceOverlay — Ultra-Smooth Master Orchestrator for Cease & Desist Notice and Enforce Sequence.
 *
 * Modes:
 *  1. directNotice (from 'VIEW / RE-ISSUE NOTICE'):
 *     - Opens immediately with zero lag via hardware-accelerated spring.
 *  2. Cinematic Takedown (from fresh 'ENFORCE TAKEDOWN'):
 *     - Smooth 1.6s GPU-accelerated crimson wash sequence.
 *
 * Document Experience:
 *  - Native Interactive Legal Notice (100% smooth scrolling, zero iframe freeze)
 *  - High-resolution PDF Document View with hardware-accelerated viewer parameters
 */

// Drip configuration for fresh takedown
const DRIP_CONFIG = [
  { offsetX: -20, delay: 0, width: 6 },
  { offsetX: -8, delay: 0.1, width: 8 },
  { offsetX: 6, delay: 0.05, width: 7 },
  { offsetX: 18, delay: 0.16, width: 5 },
  { offsetX: 28, delay: 0.08, width: 6 },
];

export default function EnforceOverlay({ enforceState, onDismiss }) {
  const [phase, setPhase] = useState('idle');
  const [activeTab, setActiveTab] = useState('interactive'); // 'interactive' | 'pdf'
  const timersRef = useRef([]);

  const isDirect = enforceState?.directNotice;

  // Phase progression timeline
  useEffect(() => {
    if (!enforceState?.active) {
      setPhase('idle');
      return;
    }

    if (isDirect) {
      setPhase('notice');
      return;
    }

    // Since the 3D globe nuclear blast just finished, open the notice with a crisp 350ms flash
    setPhase('flash');
    const t1 = setTimeout(() => setPhase('notice'), 350);

    timersRef.current = [t1];

    return () => timersRef.current.forEach(clearTimeout);
  }, [enforceState?.active, isDirect]);

  // Safe dismiss handler
  const handleDismiss = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    setPhase('idle');
    if (onDismiss) onDismiss();
  }, [onDismiss]);

  // Keyboard shortcut: Escape key closes the notice
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && enforceState?.active) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enforceState?.active, handleDismiss]);

  // Skip to notice phase on click during cinematic wash
  const handleSkip = useCallback(() => {
    if (phase === 'bleeding' || phase === 'washing' || phase === 'flash') {
      timersRef.current.forEach(clearTimeout);
      setPhase('notice');
    }
  }, [phase]);

  if (!enforceState?.active || phase === 'idle') return null;

  const { buttonRect, pdfUrl, violation } = enforceState;

  // Blood origin point (center of enforce button, fallback to screen center)
  const cx = buttonRect ? buttonRect.x + buttonRect.width / 2 : window.innerWidth / 2;
  const cy = buttonRect ? buttonRect.y + buttonRect.height / 2 : window.innerHeight / 2;

  const isBloodPhase = !isDirect && (phase === 'bleeding' || phase === 'washing' || phase === 'flash');
  const showNotice = phase === 'notice';

  const formattedPdfUrl = pdfUrl
    ? `${pdfUrl}${pdfUrl.includes('#') ? '' : '#toolbar=0&navpanes=0&scrollbar=1&view=FitH'}`
    : null;

  const breachBadgeColor =
    violation?.breach_type === 'PIRACY'
      ? 'bg-red-500/20 text-red-400 border-red-500/40'
      : violation?.breach_type === 'TERRITORY'
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
      : violation?.breach_type === 'PRE_RELEASE'
      ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
      : 'bg-zinc-800 text-zinc-300 border-zinc-700';

  return (
    <div
      className="fixed inset-0 select-none z-[100] overflow-hidden"
      style={{ willChange: 'opacity' }}
    >
      {/* ═══ GPU-ACCELERATED CINEMATIC BLOOD EXPANSION (Fresh Enforce Only) ═══ */}
      <AnimatePresence>
        {isBloodPhase && (
          <motion.div
            key="blood-circle"
            onClick={handleSkip}
            style={{
              position: 'fixed',
              left: cx,
              top: cy,
              width: '280vmax',
              height: '280vmax',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #8b0000 0%, #5a0000 35%, #2a0000 70%, #0a0000 100%)',
              transform: 'translate(-50%, -50%)',
              willChange: 'transform, opacity',
              cursor: 'pointer',
            }}
            initial={{ scale: 0, opacity: 0.95 }}
            animate={{
              scale: 1,
              opacity: phase === 'flash' ? 0.3 : 0.96,
            }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{
              scale: { duration: 1.4, ease: [0.16, 1, 0.3, 1] },
              opacity: phase === 'flash' ? { duration: 0.08 } : { duration: 0.3 },
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ Blood Drips ═══ */}
      {phase === 'bleeding' && (
        <div style={{ pointerEvents: 'none' }}>
          {DRIP_CONFIG.map((drip, i) => (
            <div
              key={i}
              className="enforce-drip"
              style={{
                left: cx + drip.offsetX,
                top: cy + 12,
                animationDelay: `${drip.delay}s`,
                width: drip.width,
              }}
            />
          ))}
        </div>
      )}

      {/* ═══ Ambient Dark Red Wash Backdrop ═══ */}
      <AnimatePresence>
        {(phase === 'washing' || phase === 'flash' || showNotice) && (
          <motion.div
            key="red-wash"
            onClick={showNotice ? handleDismiss : handleSkip}
            className="fixed inset-0"
            style={{
              background: showNotice
                ? 'radial-gradient(ellipse at center, rgba(15, 5, 5, 0.88) 0%, rgba(0, 0, 0, 0.94) 100%)'
                : 'radial-gradient(ellipse at center, #3d0000 0%, #1a0000 50%, #0a0000 100%)',
              backdropFilter: showNotice ? 'blur(10px)' : 'none',
              WebkitBackdropFilter: showNotice ? 'blur(10px)' : 'none',
              willChange: 'opacity',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      {/* ═══ White Flash on Fresh Dispatch ═══ */}
      <AnimatePresence>
        {phase === 'flash' && (
          <motion.div
            key="white-flash"
            className="fixed inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          />
        )}
      </AnimatePresence>

      {/* ═══ ULTRA-SMOOTH HIGH-PERFORMANCE NOTICE MODAL ═══ */}
      <AnimatePresence>
        {showNotice && (
          <div
            className="fixed inset-0 flex items-center justify-center p-3 md:p-6 z-50 pointer-events-auto"
            onClick={handleDismiss}
          >
            <motion.div
              className="relative w-full max-w-5xl h-[90vh] max-h-[920px] bg-zinc-950/95 border border-red-500/30 rounded-2xl flex flex-col overflow-hidden shadow-[0_0_80px_rgba(220,38,38,0.22),0_25px_60px_rgba(0,0,0,0.95)]"
              style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
              initial={{ y: isDirect ? 20 : 40, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.96, opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 340,
                damping: 28,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ─── Top Crimson Accent Bar ─── */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444]" />

              {/* ─── Header Section ─── */}
              <div className="relative px-5 py-3.5 bg-gradient-to-r from-red-950/40 via-zinc-900/80 to-zinc-950/90 border-b border-red-500/20 flex items-center justify-between gap-4 flex-shrink-0">
                {/* Left: Brand Identity */}
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm md:text-base font-black tracking-wider text-red-100 uppercase">
                        Legal Cease & Desist Notice
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-red-900/40 border border-red-500/30 text-red-300 font-bold uppercase tracking-wider">
                        DMCA § 512(c)
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono tracking-wider mt-0.5">
                      REF ID: SEN-VIOL-{violation?.id || '000'} • JURISDICTION: GLOBAL IP ENFORCEMENT
                    </p>
                  </div>
                </div>

                {/* Right: Tab Switcher & Prominent X Close Button */}
                <div className="flex items-center gap-3">
                  {/* View Tabs */}
                  <div className="hidden sm:flex items-center bg-zinc-900/90 border border-zinc-800 rounded-lg p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveTab('interactive')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        activeTab === 'interactive'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      📋 Interactive View
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('pdf')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        activeTab === 'pdf'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      📄 Official PDF
                    </button>
                  </div>

                  {/* Stamp */}
                  <div className="hidden md:flex items-center px-3 py-0.5 border border-red-500/80 text-red-400 font-black text-xs tracking-widest uppercase rounded shadow-[0_0_12px_rgba(239,68,68,0.3)] bg-red-950/40">
                    ENFORCED
                  </div>

                  {/* X Button */}
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-8 h-8 rounded-lg bg-zinc-900/90 hover:bg-red-500/20 border border-zinc-700/80 hover:border-red-500/80 text-zinc-400 hover:text-red-300 flex items-center justify-center transition-all cursor-pointer shadow hover:scale-105 active:scale-95 text-sm font-bold flex-shrink-0"
                    title="Close Notice (Esc)"
                    aria-label="Close Notice"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* ─── Tactical Metadata Bar ─── */}
              <div className="px-5 py-2 bg-zinc-950/90 border-b border-zinc-800/80 grid grid-cols-2 md:grid-cols-4 gap-2.5 flex-shrink-0 text-xs">
                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg px-3 py-1.5 flex flex-col justify-center">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Target Asset</span>
                  <span className="font-semibold text-zinc-100 truncate mt-0.5">
                    🎬 {violation?.asset_name || 'Classified Property'}
                  </span>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg px-3 py-1.5 flex flex-col justify-center">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Breach Classification</span>
                  <div className="mt-0.5">
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${breachBadgeColor}`}>
                      {violation?.breach_type || 'PIRACY'}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg px-3 py-1.5 flex flex-col justify-center">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Target Server Node</span>
                  <span className="font-semibold text-zinc-200 mt-0.5 truncate">
                    🌐 Node: {violation?.location || 'Unknown'}
                  </span>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg px-3 py-1.5 flex flex-col justify-center">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Enforcement Status</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    DISPATCHED // RECORDED
                  </span>
                </div>
              </div>

              {/* ─── Main Document Body (Ultra-Smooth Native Reader or PDF Frame) ─── */}
              <div className="flex-1 min-h-0 bg-zinc-950 relative overflow-hidden flex flex-col">
                {activeTab === 'interactive' ? (
                  /* ─── TAB 1: Hardware-Accelerated Native Document Reader ─── */
                  <div
                    className="w-full h-full overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-6 text-zinc-300 font-sans"
                    style={{
                      scrollBehavior: 'smooth',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    {/* Formal Document Sheet */}
                    <div className="max-w-3xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 md:p-10 shadow-2xl space-y-6 text-sm leading-relaxed">
                      {/* Document Seal & Header */}
                      <div className="border-b border-zinc-800 pb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                          <h1 className="text-lg md:text-xl font-extrabold tracking-wide text-zinc-100 uppercase">
                            Formal Notice of Copyright Infringement
                          </h1>
                          <p className="text-xs text-red-400 font-mono mt-1 font-semibold">
                            PURSUANT TO 17 U.S.C. § 512(c) & INTERNATIONAL COPYRIGHT CONVENTIONS
                          </p>
                        </div>
                        <div className="text-right font-mono text-[11px] text-zinc-500">
                          <div>DATE: {new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</div>
                          <div>TIMESTAMP: {new Date().toLocaleTimeString()} UTC</div>
                        </div>
                      </div>

                      {/* Addressed To Section */}
                      <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-4 font-mono text-xs space-y-1">
                        <div className="text-zinc-500 font-bold">TO HOSTING PROVIDER / NETWORK OPERATOR:</div>
                        <div className="text-zinc-200">Designated Copyright Agent / NOC Routing Desk</div>
                        <div className="text-zinc-400">Node Identifier: <span className="text-zinc-200 font-bold">{violation?.location || 'Global CDN Network'}</span></div>
                        <div className="text-zinc-400">Breach Vector: <span className="text-red-400 font-bold">{violation?.breach_type || 'Unauthorized Public Transmission'}</span></div>
                      </div>

                      {/* Notice Body Text */}
                      <div className="space-y-4 text-xs md:text-sm text-zinc-300">
                        <p>
                          This urgent communication serves as official notification under the <strong>Digital Millennium Copyright Act (DMCA)</strong>, 
                          the <strong>WIPO Copyright Treaty (WCT Article 8)</strong>, and applicable national intellectual property laws that digital content 
                          hosted or routed through your facilities infringes upon protected exclusive distribution rights.
                        </p>

                        <div className="border-l-2 border-red-500 pl-4 py-1 bg-red-950/10 rounded-r">
                          <div className="text-xs font-bold text-red-200 uppercase tracking-wider">Infringing Asset Under Surveillance</div>
                          <div className="text-sm font-semibold text-zinc-100 mt-0.5">🎬 {violation?.asset_name || 'Protected Motion Picture / Audio-Visual Property'}</div>
                          <div className="text-[11px] text-zinc-400 font-mono mt-1">
                            Status: <span className="text-emerald-400 font-bold">Evidence Captured & Cryptographically Hashed</span>
                          </div>
                        </div>

                        <p>
                          We demand that you immediately disable public access, terminate active streaming sessions, and purge unauthorized cached fragments 
                          associated with this asset from your edge caches and server nodes.
                        </p>

                        <p>
                          Failure to act expeditiously to remove or disable access to the infringing material may result in the loss of statutory safe harbor 
                          protections under 17 U.S.C. § 512(c) and expose the service provider to secondary copyright liability.
                        </p>
                      </div>

                      {/* Cryptographic Signature & Seal */}
                      <div className="pt-6 border-t border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="font-mono text-[11px] text-zinc-400 space-y-1">
                          <div className="text-zinc-500 font-bold">DIGITAL SIGNATURE & ATTESTATION:</div>
                          <div className="text-emerald-400">✓ SENTINAL AUTOMATED ENFORCEMENT ENGINE</div>
                          <div className="text-zinc-500">AI Legal Core: Gemini 2.0 Flash • Policy Agent v3.4</div>
                        </div>

                        {pdfUrl && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('pdf')}
                            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
                          >
                            <span>📄</span> Switch to PDF Frame View
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ─── TAB 2: Official PDF File Frame ─── */
                  <div className="w-full h-full p-2 md:p-3 relative">
                    {formattedPdfUrl ? (
                      <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-800 bg-[#1e1e1e] relative shadow-inner">
                        <iframe
                          src={formattedPdfUrl}
                          title="Enforcement Notice PDF"
                          className="w-full h-full border-0"
                          loading="eager"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-xl mb-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                          ⚖
                        </div>
                        <h3 className="text-sm font-bold text-zinc-100 mb-1">
                          Legal Notice Dispatched & Active
                        </h3>
                        <p className="text-xs text-zinc-400 max-w-sm mb-4">
                          The cease & desist record is active. You can review the full document in Interactive View.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('interactive')}
                          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          📋 Open Interactive Notice
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ─── Footer Action Bar ─── */}
              <div className="px-5 py-3 bg-zinc-950 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                {/* Left Telemetry Signature */}
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>SENTINAL ENFORCEMENT ENGINE</span>
                  <span className="text-zinc-700">•</span>
                  <span>AI CORE: GEMINI LEGAL AGENT</span>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-3">
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-semibold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <span>↗</span> Open Full PDF in New Tab
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(220,38,38,0.35)] hover:shadow-[0_0_25px_rgba(220,38,38,0.6)] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
