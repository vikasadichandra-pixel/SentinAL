import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authHeaders } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

// ─── Risk Level Display Config ───
const RISK_CONFIG = {
  PRE_RELEASE: { label: 'HIGH', full: 'Pre-Release', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  PIRACY:      { label: 'MED',  full: 'Piracy',      color: 'bg-red-500/20 text-red-300 border-red-500/40' },
  TERRITORY:   { label: 'LOW',  full: 'Territory',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
};

// ─── Status Display Config ───
const STATUS_CONFIG = {
  OPEN:     { label: 'OPEN',     color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  ENFORCED: { label: 'ENFORCED', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  RESOLVED: { label: 'RESOLVED', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

// ─── Label Display Config ───
const LABEL_CONFIG = {
  SUSPECTED:    { label: 'SUSPECTED',    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  VERIFIED:     { label: 'VERIFIED',     color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  NEEDS_REVIEW: { label: 'NEEDS REVIEW', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
};

// ─── Format Timestamp Safely ───
function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch {
    return isoString;
  }
}

export default function ThreatHistoryModal({ isOpen, onClose, violations = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [labelFilter, setLabelFilter] = useState('ALL');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Active download tracking per item id
  const [downloadingAudit, setDownloadingAudit] = useState({});
  const [downloadingDmca, setDownloadingDmca] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  // Stored Blob URLs for cleanup
  const blobUrlsRef = useRef([]);

  // ESC key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Cleanup all generated Object URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  // Reset pagination to page 1 whenever filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, riskFilter, labelFilter, pageSize]);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // ─── Sanitized Search & Filtering (useMemo for 60fps performance) ───
  const filteredViolations = useMemo(() => {
    if (!violations || violations.length === 0) return [];

    const query = searchTerm.trim().toLowerCase();

    return violations.filter((v) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;

      // 2. Risk / Breach Filter
      if (riskFilter !== 'ALL' && v.breach_type !== riskFilter) return false;

      // 3. Label Filter
      if (labelFilter !== 'ALL') {
        if (labelFilter === 'UNLABELED') {
          if (v.investigation_label) return false;
        } else {
          if (v.investigation_label !== labelFilter) return false;
        }
      }

      // 4. Real-time Search Match
      if (query) {
        const titleMatch = (v.asset_name || '').toLowerCase().includes(query);
        const urlMatch = (v.url || '').toLowerCase().includes(query);
        const locMatch = (v.location || '').toLowerCase().includes(query);
        const hashMatch = (v.html_hash || '').toLowerCase().includes(query);
        const noteMatch = (v.investigator_notes || v.investigator_note || '').toLowerCase().includes(query);
        const idMatch = String(v.id || '').includes(query);

        if (!titleMatch && !urlMatch && !locMatch && !hashMatch && !noteMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  }, [violations, searchTerm, statusFilter, riskFilter, labelFilter]);

  // ─── Pagination Calculations ───
  const totalItems = filteredViolations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredViolations.slice(start, start + pageSize);
  }, [filteredViolations, safePage, pageSize]);

  // ─── Active Filters Count ───
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (statusFilter !== 'ALL') count++;
    if (riskFilter !== 'ALL') count++;
    if (labelFilter !== 'ALL') count++;
    return count;
  }, [searchTerm, statusFilter, riskFilter, labelFilter]);

  // ─── Reset All Filters ───
  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setRiskFilter('ALL');
    setLabelFilter('ALL');
    setCurrentPage(1);
  }, []);

  // ─── Direct DMCA Notice PDF Download ───
  const handleDownloadDmca = useCallback(async (item) => {
    if (item.status !== 'ENFORCED') {
      setToastMessage({ type: 'info', text: `Notice not yet generated for Case #${item.id} (Status: ${item.status})` });
      return;
    }

    setDownloadingDmca((prev) => ({ ...prev, [item.id]: true }));
    setToastMessage({ type: 'info', text: `Retrieving DMCA Notice for Case #${item.id}...` });

    try {
      const directUrl = item.dmca_pdf_url || `/media/notices/Notice_Violation_${item.id}.pdf`;
      const response = await fetch(directUrl, {
        headers: { 'Authorization': `Token ${API_TOKEN}` }
      });

      if (!response.ok) {
        throw new Error(`DMCA Notice file not found on server (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      blobUrlsRef.current.push(url);

      const a = document.createElement('a');
      a.href = url;
      a.download = `SentinAL_DMCA_Notice_${item.id}.pdf`;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setToastMessage({ type: 'success', text: `✅ DMCA Notice downloaded for Case #${item.id}` });
    } catch (err) {
      setToastMessage({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setDownloadingDmca((prev) => ({ ...prev, [item.id]: false }));
    }
  }, []);

  // ─── Direct Case Audit Report PDF Download ───
  const handleDownloadAudit = useCallback(async (item) => {
    setDownloadingAudit((prev) => ({ ...prev, [item.id]: true }));
    setToastMessage({ type: 'info', text: `Generating Case Audit Report for Case #${item.id}...` });

    try {
      const endpoint = item.audit_report_url || `${API_BASE_URL}/violations/${item.id}/export-report/`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Authorization': `Token ${API_TOKEN}` },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      blobUrlsRef.current.push(url);

      const a = document.createElement('a');
      a.href = url;
      a.download = `SentinAL_Case_Report_${item.id}.pdf`;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setToastMessage({ type: 'success', text: `✅ Case Audit Report downloaded for Case #${item.id}` });
    } catch (err) {
      setToastMessage({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setDownloadingAudit((prev) => ({ ...prev, [item.id]: false }));
    }
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-text font-mono">
        
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-xl cursor-pointer"
        />

        {/* Modal Container */}
        <motion.div
          data-testid="threat-history-modal"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-7xl max-h-[92vh] bg-zinc-950/95 border border-zinc-800/90 rounded-2xl shadow-2xl shadow-red-950/20 flex flex-col overflow-hidden z-10"
        >

          {/* ─── Modal Header ─── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse" />
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-widest text-zinc-100 uppercase">
                  THREAT AUDIT LOG <span className="text-red-500">//</span> HISTORICAL ARCHIVE
                </h1>
                <p className="text-[10px] text-zinc-400 tracking-wider">
                  SENTINAL ENFORCEMENT ENGINE · EVIDENCE REPOSITORY & AUDIT TRAIL
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-[10px] px-2.5 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 font-bold uppercase tracking-wider">
                TOTAL ARCHIVED: <strong className="text-red-400 font-mono">{violations.length}</strong>
              </span>

              <button
                data-testid="history-modal-close-btn"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-zinc-900/80 hover:bg-red-500/20 border border-zinc-700 hover:border-red-500/50 text-zinc-400 hover:text-red-300 flex items-center justify-center transition-all cursor-pointer text-sm font-bold shadow-md"
                title="Close Modal (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ─── Toast Feedback Notification ─── */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mx-6 mt-3 p-2.5 rounded-lg text-xs font-mono border flex items-center justify-between ${
                  toastMessage.type === 'error'
                    ? 'bg-red-950/80 border-red-700 text-red-200'
                    : toastMessage.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                    : 'bg-zinc-900/90 border-zinc-700 text-zinc-200'
                }`}
              >
                <span>{toastMessage.text}</span>
                <button
                  onClick={() => setToastMessage(null)}
                  className="text-xs text-zinc-400 hover:text-white px-2 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Interactive Search & Filter Bar ─── */}
          <div className="px-6 pt-4 pb-3 border-b border-zinc-800/60 bg-zinc-950/40 flex-shrink-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
              
              {/* Real-time Search Input */}
              <div className="lg:col-span-4 relative">
                <input
                  data-testid="history-search-input"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search title, URL, node, hash, notes..."
                  className="w-full bg-zinc-900/90 border border-zinc-700/80 focus:border-red-500/80 focus:ring-1 focus:ring-red-500/40 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 font-mono transition-all outline-none"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Dropdown Filter */}
              <div className="lg:col-span-2">
                <select
                  data-testid="history-filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:border-red-500/80 outline-none cursor-pointer"
                >
                  <option value="ALL">Status: ALL</option>
                  <option value="OPEN">Status: OPEN</option>
                  <option value="ENFORCED">Status: ENFORCED</option>
                  <option value="RESOLVED">Status: RESOLVED</option>
                </select>
              </div>

              {/* Breach / Risk Dropdown Filter */}
              <div className="lg:col-span-2">
                <select
                  data-testid="history-filter-risk"
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:border-red-500/80 outline-none cursor-pointer"
                >
                  <option value="ALL">Risk: ALL</option>
                  <option value="PRE_RELEASE">Risk: HIGH (Pre-Release)</option>
                  <option value="PIRACY">Risk: MED (Piracy)</option>
                  <option value="TERRITORY">Risk: LOW (Territory)</option>
                </select>
              </div>

              {/* Investigation Label Dropdown Filter */}
              <div className="lg:col-span-2">
                <select
                  data-testid="history-filter-label"
                  value={labelFilter}
                  onChange={(e) => setLabelFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:border-red-500/80 outline-none cursor-pointer"
                >
                  <option value="ALL">Label: ALL</option>
                  <option value="SUSPECTED">Label: SUSPECTED</option>
                  <option value="VERIFIED">Label: VERIFIED</option>
                  <option value="NEEDS_REVIEW">Label: NEEDS REVIEW</option>
                  <option value="UNLABELED">Label: UNLABELED</option>
                </select>
              </div>

              {/* Reset Filters Button */}
              <div className="lg:col-span-2 flex items-center gap-2">
                <motion.button
                  data-testid="history-filter-reset"
                  onClick={handleResetFilters}
                  disabled={activeFilterCount === 0}
                  whileHover={activeFilterCount > 0 ? { scale: 1.02 } : {}}
                  whileTap={activeFilterCount > 0 ? { scale: 0.98 } : {}}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                    activeFilterCount > 0
                      ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-zinc-200 hover:text-white cursor-pointer shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  RESET {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                </motion.button>
              </div>

            </div>

            {/* Filter Summary Ribbon */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-1">
              <div>
                SHOWING <strong className="text-zinc-200">{filteredViolations.length}</strong> OF{' '}
                <strong className="text-zinc-200">{violations.length}</strong> RECORDED CASES
              </div>
              <div className="flex items-center gap-3">
                <span>PAGE SIZE:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-300 font-mono cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>

          {/* ─── Data Table / Audit Log Grid ─── */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto scrollbar-thin px-6 py-2">
            {paginatedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center space-y-2">
                <span className="text-3xl">🔍</span>
                <span className="text-sm font-bold uppercase tracking-wider text-zinc-400">No Matching Threat Records Found</span>
                <p className="text-xs max-w-md text-zinc-600">
                  Try adjusting your search criteria or clearing active filters to view archived violations.
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="mt-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-700 cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur-md text-zinc-400 border-b border-zinc-800 uppercase tracking-widest text-[9px] z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">CASE / TIME</th>
                    <th className="py-2.5 px-3 font-bold">TARGET ASSET</th>
                    <th className="py-2.5 px-3 font-bold">SOURCE URL</th>
                    <th className="py-2.5 px-3 font-bold text-center">NODE</th>
                    <th className="py-2.5 px-3 font-bold text-center">RISK</th>
                    <th className="py-2.5 px-3 font-bold text-center">STATUS</th>
                    <th className="py-2.5 px-3 font-bold">INVESTIGATION</th>
                    <th className="py-2.5 px-3 font-bold text-right">EVIDENCE & ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {paginatedData.map((item) => {
                    const riskCfg = RISK_CONFIG[item.breach_type] || { label: item.breach_type || 'UNKNOWN', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
                    const statusCfg = STATUS_CONFIG[item.status] || { label: item.status || 'UNKNOWN', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
                    const labelCfg = item.investigation_label ? LABEL_CONFIG[item.investigation_label] : null;
                    const notes = item.investigator_notes || item.investigator_note || '';

                    const isEnforced = item.status === 'ENFORCED';
                    const isDmcaLoading = !!downloadingDmca[item.id];
                    const isAuditLoading = !!downloadingAudit[item.id];

                    return (
                      <tr
                        key={item.id}
                        data-testid={`history-table-row-${item.id}`}
                        className="hover:bg-zinc-900/60 transition-colors group"
                      >
                        {/* 1. Case ID + Timestamp */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-red-400 font-bold text-[10px]">
                              #{item.id}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {formatDateTime(item.timestamp)}
                          </div>
                        </td>

                        {/* 2. Asset Name */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-zinc-100 flex items-center gap-1.5 truncate max-w-[200px]" title={item.asset_name}>
                            <span>🎬</span>
                            <span className="truncate">{item.asset_name}</span>
                          </div>
                          {item.html_hash && (
                            <div className="text-[9px] text-zinc-500 font-mono truncate max-w-[200px]" title={`SHA-256: ${item.html_hash}`}>
                              HASH: {item.html_hash.substring(0, 10)}...
                            </div>
                          )}
                        </td>

                        {/* 3. Threat URL */}
                        <td className="py-3 px-3 max-w-[220px]">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-red-400 transition-colors truncate block text-[10px] underline decoration-zinc-700 hover:decoration-red-400"
                            title={item.url}
                          >
                            {item.url}
                          </a>
                        </td>

                        {/* 4. Location Node */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold text-[10px]">
                            {item.location || '—'}
                          </span>
                        </td>

                        {/* 5. Risk Level */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${riskCfg.color}`}>
                            {riskCfg.label}
                          </span>
                        </td>

                        {/* 6. Status */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* 7. Investigation Label & Notes */}
                        <td className="py-3 px-3 max-w-[200px]">
                          {labelCfg ? (
                            <div className="space-y-1">
                              <span className={`inline-block px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${labelCfg.color}`}>
                                {labelCfg.label}
                              </span>
                              {notes && (
                                <p className="text-[10px] text-zinc-400 truncate" title={notes}>
                                  "{notes}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600 text-[10px]">— Unreviewed —</span>
                          )}
                        </td>

                        {/* 8. Evidence & Reports Actions */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* DMCA Takedown Notice PDF Download */}
                            <motion.button
                              data-testid={`download-dmca-pdf-btn-${item.id}`}
                              onClick={() => handleDownloadDmca(item)}
                              disabled={!isEnforced || isDmcaLoading}
                              whileHover={isEnforced && !isDmcaLoading ? { scale: 1.05 } : {}}
                              whileTap={isEnforced && !isDmcaLoading ? { scale: 0.95 } : {}}
                              className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-wider uppercase border transition-all flex items-center gap-1 ${
                                isEnforced
                                  ? 'bg-red-950/50 hover:bg-red-900/60 border-red-700/60 text-red-200 hover:text-white cursor-pointer shadow-sm'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                              }`}
                              title={isEnforced ? 'Download DMCA Takedown Notice PDF' : 'DMCA notice only available for Enforced threats'}
                            >
                              {isDmcaLoading ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              ) : (
                                <span>⚖</span>
                              )}
                              <span>DMCA NOTICE</span>
                            </motion.button>

                            {/* Case Audit Report PDF Download */}
                            <motion.button
                              data-testid={`download-audit-pdf-btn-${item.id}`}
                              onClick={() => handleDownloadAudit(item)}
                              disabled={isAuditLoading}
                              whileHover={!isAuditLoading ? { scale: 1.05 } : {}}
                              whileTap={!isAuditLoading ? { scale: 0.95 } : {}}
                              className="px-2.5 py-1 rounded text-[9px] font-bold tracking-wider uppercase bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white cursor-pointer transition-all shadow-sm flex items-center gap-1"
                              title="Download Full Case Audit Report PDF"
                            >
                              {isAuditLoading ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              ) : (
                                <span>📄</span>
                              )}
                              <span>AUDIT REPORT</span>
                            </motion.button>

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── Pagination Footer ─── */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md flex-shrink-0 text-xs font-mono">
            <div className="text-zinc-400 text-[11px]">
              PAGE <strong className="text-zinc-200">{safePage}</strong> OF{' '}
              <strong className="text-zinc-200">{totalPages}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                data-testid="history-page-prev"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                  safePage > 1
                    ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                }`}
              >
                ◀ PREV
              </button>

              <button
                data-testid="history-page-next"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                  safePage < totalPages
                    ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                }`}
              >
                NEXT ▶
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
