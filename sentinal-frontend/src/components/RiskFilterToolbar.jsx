import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * Advanced Bounty — RiskFilterToolbar
 *
 * Provides filter chips to sort/filter Violations by:
 *   - Risk Level:          High (PRE_RELEASE) / Medium (PIRACY) / Low (TERRITORY)
 *   - Status:              OPEN / RESOLVED / ENFORCED
 *   - Investigation Label: SUSPECTED / VERIFIED / NEEDS_REVIEW
 *
 * Also includes a Reset button that clears all active filters.
 *
 * Engineering Constraints:
 *   - data-testid on every interactive element
 *   - useMemo for chip config (avoids re-allocation per render)
 *   - Compact HUD aesthetic matching the SentinAL design system
 */

// ── Chip Configurations (stable reference via module scope) ──
const RISK_CHIPS = [
  { key: 'PRE_RELEASE', label: 'HIGH', testId: 'risk-filter-high',   color: 'purple' },
  { key: 'PIRACY',      label: 'MED',  testId: 'risk-filter-medium', color: 'red'    },
  { key: 'TERRITORY',   label: 'LOW',  testId: 'risk-filter-low',    color: 'orange' },
];

const STATUS_CHIPS = [
  { key: 'OPEN',     label: 'OPEN',     testId: 'status-filter-open',     color: 'red'     },
  { key: 'RESOLVED', label: 'RESOLVED', testId: 'status-filter-resolved', color: 'blue'    },
  { key: 'ENFORCED', label: 'ENFORCED', testId: 'status-filter-enforced', color: 'emerald' },
];

const LABEL_CHIPS = [
  { key: 'SUSPECTED',    label: 'SUSPECTED',    testId: 'label-filter-suspected',    color: 'amber' },
  { key: 'VERIFIED',     label: 'VERIFIED',     testId: 'label-filter-verified',     color: 'emerald' },
  { key: 'NEEDS_REVIEW', label: 'NEEDS REVIEW', testId: 'label-filter-needs-review', color: 'cyan'  },
];

// ── Color Map for active/inactive chip styling ──
const COLOR_STYLES = {
  red:     { active: 'bg-red-500/30 border-red-500/60 text-red-300',        inactive: 'border-zinc-700/60 text-zinc-500 hover:border-red-500/40 hover:text-red-400' },
  orange:  { active: 'bg-orange-500/30 border-orange-500/60 text-orange-300', inactive: 'border-zinc-700/60 text-zinc-500 hover:border-orange-500/40 hover:text-orange-400' },
  purple:  { active: 'bg-purple-500/30 border-purple-500/60 text-purple-300', inactive: 'border-zinc-700/60 text-zinc-500 hover:border-purple-500/40 hover:text-purple-400' },
  blue:    { active: 'bg-blue-500/30 border-blue-500/60 text-blue-300',       inactive: 'border-zinc-700/60 text-zinc-500 hover:border-blue-500/40 hover:text-blue-400' },
  emerald: { active: 'bg-emerald-500/30 border-emerald-500/60 text-emerald-300', inactive: 'border-zinc-700/60 text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-400' },
  amber:   { active: 'bg-amber-500/30 border-amber-500/60 text-amber-300',    inactive: 'border-zinc-700/60 text-zinc-500 hover:border-amber-500/40 hover:text-amber-400' },
  cyan:    { active: 'bg-cyan-500/30 border-cyan-500/60 text-cyan-300',       inactive: 'border-zinc-700/60 text-zinc-500 hover:border-cyan-500/40 hover:text-cyan-400' },
};

// ── Generic Filter Chip Component ──
function FilterChip({ chip, isActive, onToggle }) {
  const styles = COLOR_STYLES[chip.color] || COLOR_STYLES.red;

  return (
    <motion.button
      data-testid={chip.testId}
      onClick={() => onToggle(chip.key)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded border transition-all cursor-pointer ${
        isActive ? styles.active : styles.inactive
      }`}
    >
      {chip.label}
    </motion.button>
  );
}

// ── Filter Section Row ──
function FilterRow({ title, chips, activeSet, onToggle }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-bold w-10 flex-shrink-0">
        {title}
      </span>
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          chip={chip}
          isActive={activeSet.has(chip.key)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}


export default function RiskFilterToolbar({
  riskFilters,
  statusFilters,
  labelFilters,
  onRiskToggle,
  onStatusToggle,
  onLabelToggle,
  onReset,
}) {
  // Count total active filters for the badge
  const activeCount = useMemo(
    () => riskFilters.size + statusFilters.size + labelFilters.size,
    [riskFilters, statusFilters, labelFilters]
  );

  const handleReset = useCallback(() => {
    if (onReset) onReset();
  }, [onReset]);

  return (
    <div className="space-y-1.5 px-1 pb-2 mb-2 border-b border-zinc-800/60">
      {/* Title + Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase">
            Filters
          </span>
          {activeCount > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <motion.button
            data-testid="filter-reset-btn"
            onClick={handleReset}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="text-[9px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer font-bold tracking-wider uppercase"
          >
            RESET
          </motion.button>
        )}
      </div>

      {/* Risk Level Row */}
      <FilterRow
        title="RISK"
        chips={RISK_CHIPS}
        activeSet={riskFilters}
        onToggle={onRiskToggle}
      />

      {/* Status Row */}
      <FilterRow
        title="STATUS"
        chips={STATUS_CHIPS}
        activeSet={statusFilters}
        onToggle={onStatusToggle}
      />

      {/* Investigation Label Row */}
      <FilterRow
        title="LABEL"
        chips={LABEL_CHIPS}
        activeSet={labelFilters}
        onToggle={onLabelToggle}
      />
    </div>
  );
}
