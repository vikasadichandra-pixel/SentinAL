import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authHeaders } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/**
 * Core Bounty — InvestigationPanel
 *
 * Allows reviewers to mark each Violation with an investigation label
 * (Suspected / Verified / Needs Review) and attach a short investigator note.
 *
 * Engineering Constraints:
 *  - useMemo for derived state
 *  - useEffect cleanup on abort controllers
 *  - data-testid on every interactive element
 *  - XSS prevention via backend serializer (strip_tags)
 */

const LABEL_OPTIONS = [
  { value: '', display: '— Select Label —', color: 'text-zinc-500' },
  { value: 'SUSPECTED', display: 'Suspected', color: 'text-amber-400' },
  { value: 'VERIFIED', display: 'Verified', color: 'text-emerald-400' },
  { value: 'NEEDS_REVIEW', display: 'Needs Review', color: 'text-cyan-400' },
];

const feedbackVariants = {
  initial: { opacity: 0, y: -6, height: 0 },
  animate: { opacity: 1, y: 0, height: 'auto', transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit: { opacity: 0, y: -6, height: 0, transition: { duration: 0.15 } },
};

export default function InvestigationPanel({ violation, onLabelUpdated }) {
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const abortRef = useRef(null);

  // Sync local state when the selected violation changes
  useEffect(() => {
    if (violation) {
      setLabel(violation.investigation_label || '');
      setNotes(violation.investigator_notes || '');
      setFeedback(null);
    }
  }, [violation?.id, violation?.investigation_label, violation?.investigator_notes]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Determine if the form has unsaved changes
  const hasChanges = useMemo(() => {
    if (!violation) return false;
    const currentLabel = violation.investigation_label || '';
    const currentNotes = violation.investigator_notes || '';
    return label !== currentLabel || notes !== currentNotes;
  }, [violation, label, notes]);

  const canSave = useMemo(() => {
    return label !== '' && hasChanges && !saving;
  }, [label, hasChanges, saving]);

  const handleSave = useCallback(async () => {
    if (!violation || !label) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/violations/${violation.id}/investigate/`,
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({
            investigation_label: label,
            investigator_notes: notes,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || 'Server rejected the request');
      }

      const result = await response.json();

      setFeedback({ type: 'success', text: `✅ Label set to ${result.investigation_label}` });

      // Notify parent to refresh violation data
      if (onLabelUpdated) {
        onLabelUpdated(result);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setFeedback({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setSaving(false);
    }
  }, [violation, label, notes, onLabelUpdated]);

  if (!violation) return null;

  // Label badge styling
  const labelBadge = useMemo(() => {
    const current = violation.investigation_label;
    if (!current) return null;
    const styles = {
      SUSPECTED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      VERIFIED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      NEEDS_REVIEW: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return styles[current] || 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30';
  }, [violation.investigation_label]);

  return (
    <div className="mt-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3 space-y-2.5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          Investigation
        </span>
        {violation.investigation_label && (
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${labelBadge}`}
          >
            {violation.investigation_label.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Label Select */}
      <select
        data-testid="investigation-label-select"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={saving}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-colors cursor-pointer disabled:opacity-50 appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.2em 1.2em',
        }}
      >
        {LABEL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.display}
          </option>
        ))}
      </select>

      {/* Notes Input */}
      <textarea
        data-testid="investigator-notes-input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={saving}
        placeholder="Add investigator notes..."
        maxLength={1000}
        rows={2}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-colors resize-none disabled:opacity-50"
      />

      {/* Save Button */}
      <motion.button
        data-testid="save-investigation-btn"
        onClick={handleSave}
        disabled={!canSave}
        whileHover={canSave ? { scale: 1.015 } : {}}
        whileTap={canSave ? { scale: 0.97 } : {}}
        className={`w-full py-2 px-3 text-[11px] font-bold tracking-wider uppercase rounded-md transition-all border cursor-pointer ${canSave
            ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-zinc-100 hover:text-white shadow-md'
            : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            SAVING...
          </span>
        ) : (
          'SAVE INVESTIGATION'
        )}
      </motion.button>

      {/* Feedback Toast */}
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            key={feedback.text}
            variants={feedbackVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`p-2 text-[11px] rounded-md font-mono border overflow-hidden ${feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-red-950/60 border-red-800 text-red-200'
              }`}
          >
            {feedback.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
