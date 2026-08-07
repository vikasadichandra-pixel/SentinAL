import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authHeaders } from "../services/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ─── Skeleton Placeholder for Action Console ───
function ConsoleSkeleton() {
  return (
    <div className="p-4 space-y-4 bg-zinc-900 border border-zinc-800 rounded-lg">
      <div className="skeleton-shimmer skeleton-title" />
      <div className="skeleton-shimmer skeleton-line-sm" style={{ width: '55%' }} />
      <div className="skeleton-shimmer skeleton-button" style={{ opacity: 0.6 }} />
      <div className="skeleton-shimmer skeleton-button" style={{ opacity: 0.4 }} />
    </div>
  );
}

// ─── Typewriter Effect for Target Name ───
function TypewriterText({ text, className = "" }) {
  const [displayed, setDisplayed] = useState("");
  const prevTextRef = useRef("");

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;
    setDisplayed("");

    if (!text) return;

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 28);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={className}>
      {displayed}
      {displayed.length < (text || "").length && (
        <span className="typewriter-cursor" />
      )}
    </span>
  );
}

// ─── Status Message Variants ───
const statusVariants = {
  initial: { opacity: 0, y: -8, height: 0 },
  animate: {
    opacity: 1,
    y: 0,
    height: "auto",
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
  exit: {
    opacity: 0,
    y: -8,
    height: 0,
    transition: { duration: 0.2 },
  },
};


export default function ActionConsole({ selectedViolation, isLoading: externalLoading, onEnforceSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const enforceBtnRef = useRef(null);

  // Show skeleton during initial app loading
  if (externalLoading) {
    return <ConsoleSkeleton />;
  }

  // 1. THE VERIFY BUTTON LOGIC
  const handleVerify = async () => {
    if (!selectedViolation) {
      setStatusMessage({ type: 'error', text: '⚠ Select a violation first!' });
      return;
    }

    setStatusMessage({ type: 'info', text: 'Re-fetching page and verifying SHA-256 Hash...' });

    try {
      const response = await fetch(`${API_BASE_URL}/verify/${selectedViolation.id}/`, {
        method: 'POST',
        headers: authHeaders,
      });

      if (!response.ok) throw new Error("Server rejected the request");

      const result = await response.json();

      setStatusMessage(
        result.verified
          ? { type: 'success', text: `✅ Hash confirmed: ${result.current_hash.substring(0, 10)}...` }
          : { type: 'error', text: `⚠ ${result.note || 'Hash mismatch — evidence may be stale'}` }
      );
    } catch (error) {
      setStatusMessage({ type: 'error', text: '❌ Verification request failed.' });
    }
  };

  // 2. THE ENFORCE (KILL SWITCH) LOGIC — now triggers cinematic sequence
  const handleEnforce = async () => {
    if (!selectedViolation) {
      setStatusMessage({ type: 'error', text: '⚠ Select a violation first!' });
      return;
    }

    setIsLoading(true);
    setIsExecuting(true);
    setStatusMessage({ type: 'info', text: '⚖ Drafting Legal Notice via Gemini...' });

    try {
      const response = await fetch(`${API_BASE_URL}/enforce/${selectedViolation.id}/`, {
        method: 'POST',
        headers: authHeaders,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Server rejected the request");
      }

      // Get button position for blood origin point
      const buttonRect = enforceBtnRef.current
        ? enforceBtnRef.current.getBoundingClientRect()
        : null;

      // Trigger the cinematic enforcement sequence (instead of window.open)
      if (onEnforceSuccess) {
        onEnforceSuccess({
          pdfUrl: result.pdf_url || null,
          violation: selectedViolation,
          buttonRect: buttonRect ? {
            x: buttonRect.x,
            y: buttonRect.y,
            width: buttonRect.width,
            height: buttonRect.height,
          } : null,
          message: result.message,
          directNotice: isEnforced,
        });
      }

      setStatusMessage({ type: 'success', text: `✅ ${result.message}` });

    } catch (error) {
      setStatusMessage({ type: 'error', text: `❌ ${error.message}` });
    } finally {
      setIsLoading(false);
      // Keep executing visual for a beat, then reset
      setTimeout(() => setIsExecuting(false), 300);
    }
  };

  const targetName = selectedViolation ? selectedViolation.asset_name : 'No Target Selected';
  const hasTarget = !!selectedViolation;
  const isEnforced = selectedViolation?.status === 'ENFORCED';

  return (
    <div className="p-4 space-y-4 bg-zinc-900/90 border border-zinc-800 rounded-lg flex flex-col h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-zinc-200 uppercase">Action Console</h2>
        {selectedViolation && (
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
            isEnforced ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {selectedViolation.status || 'OPEN'}
          </span>
        )}
      </div>

      {/* Status Message Display with Animation */}
      <AnimatePresence mode="wait">
        {statusMessage && (
          <motion.div
            key={statusMessage.text}
            variants={statusVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`p-2.5 text-xs rounded-lg font-mono border overflow-hidden ${
              statusMessage.type === 'error'
                ? 'bg-red-950/60 border-red-800 text-red-200'
                : statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-cyan-950/60 border-cyan-800 text-cyan-200'
            }`}
          >
            {statusMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Asset Info with Typewriter */}
      <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3 space-y-1.5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          TARGET ASSET
        </div>
        <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 truncate">
          <span>🎬</span>
          <TypewriterText text={targetName} className="text-zinc-100 font-semibold truncate" />
        </div>

        {selectedViolation && (
          <div className="pt-2 mt-1 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span>NODE: <strong className="text-zinc-300">{selectedViolation.location}</strong></span>
            <span>BREACH: <strong className="text-red-400">{selectedViolation.breach_type}</strong></span>
          </div>
        )}
      </div>

      <div className="space-y-2.5 mt-auto pt-2">
        {/* BUTTON 1: Verify */}
        <motion.button
          onClick={handleVerify}
          disabled={!hasTarget || isLoading}
          whileHover={hasTarget && !isLoading ? { scale: 1.015 } : {}}
          whileTap={hasTarget && !isLoading ? { scale: 0.98 } : {}}
          className={`w-full py-2.5 px-3 text-xs font-bold tracking-wider rounded-lg transition-all border ${
            !hasTarget
              ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer shadow-md'
          }`}
        >
          VERIFY EVIDENCE HASH
        </motion.button>

        {/* BUTTON 2: Enforce — triggers cinematic sequence */}
        <motion.button
          ref={enforceBtnRef}
          onClick={handleEnforce}
          disabled={!hasTarget || isLoading}
          whileHover={hasTarget && !isExecuting && !isLoading ? { scale: 1.02 } : {}}
          whileTap={hasTarget && !isExecuting && !isLoading ? { scale: 0.94 } : {}}
          className={`w-full py-3 px-3 text-xs font-black tracking-widest uppercase rounded-lg transition-all flex justify-center items-center cursor-pointer shadow-lg ${
            isExecuting
              ? 'enforce-btn-executing text-white'
              : !hasTarget
              ? 'bg-red-950/20 border border-red-950/40 text-red-900/60 cursor-not-allowed'
              : isEnforced
              ? 'bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white border border-red-500/50 shadow-red-950/50'
              : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white enforce-btn-active border border-red-500/40'
          }`}
        >
          {isLoading ? (
            <span className="animate-pulse tracking-widest text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              EXECUTING DISPATCH...
            </span>
          ) : isEnforced ? (
            "⚖ VIEW / RE-ISSUE NOTICE"
          ) : (
            "⚡ ENFORCE TAKEDOWN"
          )}
        </motion.button>
      </div>
    </div>
  );
}