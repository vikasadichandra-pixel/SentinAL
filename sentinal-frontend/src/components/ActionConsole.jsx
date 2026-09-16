import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authHeaders } from "../services/api";
import InvestigationPanel from './InvestigationPanel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

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


export default function ActionConsole({ selectedViolation, isLoading: externalLoading, onEnforceSuccess, onStatusUpdated }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [takedownAlert, setTakedownAlert] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [verifiedStatus, setVerifiedStatus] = useState({});
  const enforceBtnRef = useRef(null);
  const exportUrlRef = useRef(null);

  // Clear takedown alert if target changes
  useEffect(() => {
    setTakedownAlert(null);
  }, [selectedViolation?.id]);

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (exportUrlRef.current) {
        URL.revokeObjectURL(exportUrlRef.current);
        exportUrlRef.current = null;
      }
    };
  }, []);

  // Show skeleton during initial app loading
  if (externalLoading) {
    return <ConsoleSkeleton />;
  }

  // 1. THE VERIFY EVIDENCE BUTTON LOGIC
  const handleVerify = async () => {
    if (!selectedViolation) {
      setStatusMessage({ type: 'error', text: '⚠ Select a violation first!' });
      return;
    }

    setIsVerifying(true);
    setStatusMessage({ type: 'info', text: 'Re-fetching page and verifying SHA-256 Hash...' });

    try {
      const response = await fetch(`${API_BASE_URL}/verify/${selectedViolation.id}/`, {
        method: 'POST',
        headers: authHeaders,
      });

      const result = await response.json();

      if (!response.ok || !result.verified) {
        setVerifiedStatus(prev => ({ ...prev, [selectedViolation.id]: false }));
        setStatusMessage({
          type: 'error',
          text: `❌ ${result.note || result.error || 'Hash mismatch after 3 verification passes — evidence verification failed. Enforcement locked.'}`
        });
        return;
      }

      setVerifiedStatus(prev => ({ ...prev, [selectedViolation.id]: true }));
      setStatusMessage({
        type: 'success',
        text: `✅ ${result.note || `Hash confirmed: ${result.current_hash ? result.current_hash.substring(0, 10) : ''}... Evidence verified. Enforcement unlocked.`}`
      });

      if (onStatusUpdated && selectedViolation.investigation_label !== 'VERIFIED') {
        onStatusUpdated({
          ...selectedViolation,
          investigation_label: 'VERIFIED'
        });
      }
    } catch (error) {
      setVerifiedStatus(prev => ({ ...prev, [selectedViolation.id]: false }));
      setStatusMessage({ type: 'error', text: '❌ Verification request failed. Host unreachable or offline.' });
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. THE ENFORCE (KILL SWITCH) LOGIC
  const handleEnforce = async () => {
    if (!selectedViolation) {
      setStatusMessage({ type: 'error', text: '⚠ Select a violation first!' });
      return;
    }

    // Gate: Enforcement strictly requires verified evidence hash for takedowns
    if (!isEnforced && !isHashVerified) {
      setStatusMessage({ type: 'error', text: '🔒 Hash verification required before takedown enforcement.' });
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
        if (result.verified === false) {
          setVerifiedStatus(prev => ({ ...prev, [selectedViolation.id]: false }));
        }
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

      if (onStatusUpdated) {
        onStatusUpdated({
          ...selectedViolation,
          status: 'ENFORCED',
          investigation_label: 'VERIFIED'
        });
      }

      setStatusMessage({ type: 'success', text: `✅ ${result.message}` });

    } catch (error) {
      setStatusMessage({ type: 'error', text: `❌ ${error.message}` });
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsExecuting(false), 300);
    }
  };

  // 3. THE AUTO-RESOLVE (TAKEDOWN VERIFICATION) LOGIC
  const handleAutoResolve = async () => {
    if (!selectedViolation) return;

    setIsResolving(true);
    setStatusMessage({ type: 'info', text: '🔍 Pinging pirate host & inspecting response headers...' });

    try {
      const response = await fetch(`${API_BASE_URL}/violations/${selectedViolation.id}/auto-resolve/`, {
        method: 'POST',
        headers: authHeaders,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.reason || result.error || "Takedown check failed");
      }

      if (result.resolved) {
        setTakedownAlert({
          reason: result.reason,
          httpStatus: result.http_status,
        });

        setStatusMessage({
          type: 'success',
          text: `🛡️ TAKEDOWN CONFIRMED: ${result.reason}`,
        });

        if (onStatusUpdated) {
          onStatusUpdated({
            ...selectedViolation,
            status: 'RESOLVED',
          });
        }
      } else {
        setStatusMessage({
          type: 'info',
          text: `⚠️ Target Still Active: ${result.reason}`,
        });
      }
    } catch (error) {
      setStatusMessage({ type: 'error', text: `❌ Health Check Error: ${error.message}` });
    } finally {
      setIsResolving(false);
    }
  };

  const targetName = selectedViolation ? selectedViolation.asset_name : 'No Target Selected';
  const hasTarget = !!selectedViolation;
  const isEnforced = selectedViolation?.status === 'ENFORCED';
  const isResolved = selectedViolation?.status === 'RESOLVED';

  // Hash is verified if explicitly passed in session, or if already marked VERIFIED (and not explicitly failed)
  const isHashVerified = hasTarget && (
    verifiedStatus[selectedViolation.id] === true ||
    (verifiedStatus[selectedViolation.id] === undefined && selectedViolation.investigation_label === 'VERIFIED')
  );

  return (
    <div className="p-3 space-y-3 bg-zinc-900/90 border border-zinc-800 rounded-lg flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold tracking-wider text-zinc-200 uppercase">Action Console</h2>
        {selectedViolation && (
          <span
            data-testid={isResolved ? `status-badge-resolved-${selectedViolation.id}` : undefined}
            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1 transition-all ${
              isResolved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : isEnforced
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {isResolved && <span>✓</span>}
            <span>{selectedViolation.status || 'OPEN'}</span>
          </span>
        )}
      </div>

      {/* ── Status Toast (auto-dismiss) ── */}
      <AnimatePresence mode="wait">
        {statusMessage && (
          <motion.div
            key={statusMessage.text}
            variants={statusVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`p-2 text-[10px] rounded-md font-mono border overflow-hidden flex-shrink-0 ${
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

      {/* ── Takedown Verified Success Alert ── */}
      <AnimatePresence>
        {takedownAlert && (
          <motion.div
            data-testid="takedown-verified-alert"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            className="p-2.5 bg-emerald-950/80 border border-emerald-600/80 rounded-lg text-emerald-200 font-mono text-[10px] space-y-1 shadow-lg flex-shrink-0"
          >
            <div className="flex items-center justify-between font-bold uppercase tracking-wider text-emerald-300">
              <span className="flex items-center gap-1.5">
                <span>🛡️</span>
                <span>TAKEDOWN CONFIRMED // RESOLVED</span>
              </span>
              <button
                onClick={() => setTakedownAlert(null)}
                className="text-emerald-400 hover:text-white px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-emerald-300/90 leading-tight">{takedownAlert.reason}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable Content Area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 scrollbar-thin">

        {/* ── Target Asset Card ── */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-2.5 space-y-1">
          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
            TARGET ASSET
          </div>
          <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 truncate">
            <TypewriterText text={targetName} className="text-zinc-100 font-semibold truncate" />
          </div>
          {selectedViolation && (
            <div className="pt-1.5 mt-1 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>NODE: <strong className="text-zinc-300">{selectedViolation.location}</strong></span>
              <span>BREACH: <strong className="text-red-400">{selectedViolation.breach_type}</strong></span>
            </div>
          )}
        </div>

        {/* ── Investigation Section ── */}
        <InvestigationPanel
          violation={selectedViolation}
          onLabelUpdated={(result) => {
            setStatusMessage({ type: 'success', text: `Label: ${result.investigation_label}` });
          }}
        />

      </div>

      {/* ── Action Buttons (pinned to bottom) ── */}
      <div className="space-y-2 flex-shrink-0 pt-2 border-t border-zinc-800/60">
        
        {/* Verify Takedown Status (Active when ENFORCED) */}
        {isEnforced && (
          <motion.button
            data-testid="auto-resolve-btn"
            onClick={handleAutoResolve}
            disabled={isResolving}
            whileHover={!isResolving ? { scale: 1.015 } : {}}
            whileTap={!isResolving ? { scale: 0.98 } : {}}
            className="w-full py-2 px-3 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all border bg-emerald-950/70 hover:bg-emerald-900/80 border-emerald-600/70 text-emerald-200 hover:text-white cursor-pointer shadow-md flex items-center justify-center gap-1.5"
          >
            {isResolving ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                VERIFYING TAKEDOWN...
              </span>
            ) : (
              <>
                <span>🛡️</span>
                <span>VERIFY TAKEDOWN STATUS</span>
              </>
            )}
          </motion.button>
        )}
        {/* Export PDF */}
        {selectedViolation && (
          <motion.button
            data-testid="export-pdf-btn"
            onClick={async () => {
              if (!selectedViolation || isExporting) return;
              setIsExporting(true);
              setStatusMessage({ type: 'info', text: 'Generating report...' });

              if (exportUrlRef.current) {
                URL.revokeObjectURL(exportUrlRef.current);
                exportUrlRef.current = null;
              }

              try {
                const response = await fetch(
                  `${API_BASE_URL}/violations/${selectedViolation.id}/export-report/`,
                  {
                    method: 'GET',
                    headers: { 'Authorization': `Token ${API_TOKEN}` },
                  }
                );

                if (!response.ok) {
                  const errData = await response.json().catch(() => ({}));
                  throw new Error(errData.error || 'Failed to generate report');
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                exportUrlRef.current = url;

                const a = document.createElement('a');
                a.href = url;
                a.download = `SentinAL_Case_Report_${selectedViolation.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                setStatusMessage({ type: 'success', text: 'Report downloaded.' });
              } catch (err) {
                setStatusMessage({ type: 'error', text: `Export failed: ${err.message}` });
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={!selectedViolation || isExporting}
            whileHover={selectedViolation && !isExporting ? { scale: 1.015 } : {}}
            whileTap={selectedViolation && !isExporting ? { scale: 0.97 } : {}}
            className={`w-full py-2 px-3 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all border cursor-pointer ${
              !selectedViolation || isExporting
                ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-zinc-100 hover:text-white shadow-md'
            }`}
          >
            {isExporting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                GENERATING...
              </span>
            ) : (
              'EXPORT CASE REPORT'
            )}
          </motion.button>
        )}

        {/* Verify Evidence */}
        <motion.button
          onClick={handleVerify}
          disabled={!hasTarget || isVerifying || isLoading}
          whileHover={hasTarget && !isVerifying && !isLoading ? { scale: 1.015 } : {}}
          whileTap={hasTarget && !isVerifying && !isLoading ? { scale: 0.98 } : {}}
          className={`w-full py-2 px-3 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
            !hasTarget
              ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
              : isHashVerified
              ? 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : 'bg-zinc-800 hover:bg-zinc-700 border-cyan-600/60 text-cyan-200 hover:text-white shadow-md'
          }`}
        >
          {isVerifying ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              VERIFYING SHA-256 HASH...
            </span>
          ) : isHashVerified ? (
            <>
              <span>✓</span>
              <span>EVIDENCE HASH VERIFIED</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>VERIFY EVIDENCE HASH</span>
            </>
          )}
        </motion.button>

        {/* Enforce Takedown */}
        <motion.button
          ref={enforceBtnRef}
          onClick={handleEnforce}
          disabled={!hasTarget || isLoading || isResolved || (!isEnforced && !isHashVerified)}
          whileHover={hasTarget && !isExecuting && !isLoading && !isResolved && (isEnforced || isHashVerified) ? { scale: 1.02 } : {}}
          whileTap={hasTarget && !isExecuting && !isLoading && !isResolved && (isEnforced || isHashVerified) ? { scale: 0.94 } : {}}
          className={`w-full py-2.5 px-3 text-[10px] font-black tracking-widest uppercase rounded-md transition-all flex justify-center items-center cursor-pointer shadow-lg ${
            isExecuting
              ? 'enforce-btn-executing text-white'
              : !hasTarget || isResolved
              ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
              : !isEnforced && !isHashVerified
              ? 'bg-zinc-900/90 border border-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
              : isEnforced
              ? 'bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white border border-red-500/50 shadow-red-950/50'
              : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white enforce-btn-active border border-red-500/40'
          }`}
        >
          {isLoading ? (
            <span className="animate-pulse tracking-widest text-[10px] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              DISPATCHING...
            </span>
          ) : isResolved ? (
            "THREAT RESOLVED (TAKEDOWN COMPLETE)"
          ) : isEnforced ? (
            "VIEW / RE-ISSUE NOTICE"
          ) : !isHashVerified ? (
            "🔒 ENFORCE TAKEDOWN (VERIFY HASH FIRST)"
          ) : (
            "⚡ ENFORCE TAKEDOWN"
          )}
        </motion.button>
      </div>
    </div>
  );
}