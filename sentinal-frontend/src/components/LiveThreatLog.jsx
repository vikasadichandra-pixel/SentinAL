import { motion, AnimatePresence } from "framer-motion";

// ─── Skeleton Card Component ───
function SkeletonCard({ delay = 0 }) {
  return (
    <div
      className="border border-zinc-800/50 rounded-lg p-3 bg-zinc-900/50"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-center">
        <div className="skeleton-shimmer skeleton-badge" />
        <div className="skeleton-shimmer skeleton-line-sm" style={{ width: '80px' }} />
      </div>
      <div className="skeleton-shimmer skeleton-line mt-3" style={{ width: '70%' }} />
      <div className="skeleton-shimmer skeleton-line-sm mt-2" style={{ width: '45%' }} />
    </div>
  );
}

// ─── Breach type → CSS class mapping ───
function getCardClass(breachType) {
  switch (breachType) {
    case "PIRACY": return "threat-card--piracy";
    case "TERRITORY": return "threat-card--territory";
    case "PRE_RELEASE": return "threat-card--pre_release";
    default: return "threat-card--piracy";
  }
}

function getBadgeGlowClass(breachType) {
  switch (breachType) {
    case "PIRACY": return "badge-glow--piracy";
    case "TERRITORY": return "badge-glow--territory";
    case "PRE_RELEASE": return "badge-glow--pre_release";
    default: return "badge-glow--piracy";
  }
}

export default function LiveThreatLog({ violations = [], selectedViolation, loading, error, onSelect }) {
  const isInitialLoad = loading && violations.length === 0;

  const getBreachBorderColor = (type) => {
    switch (type) {
      case "PIRACY": return "border-l-red-500";
      case "TERRITORY": return "border-l-orange-500";
      case "PRE_RELEASE": return "border-l-purple-500";
      default: return "border-l-red-500";
    }
  };

  return (
    <div className="p-3.5 space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0 px-1">
        <h2 className="text-xs font-bold tracking-wider text-zinc-300 uppercase">Live Threat Log</h2>
        <span className="text-[10px] text-zinc-400 font-mono font-bold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
          {violations.length} LOGGED
        </span>
      </div>

      {error && <div className="text-xs text-red-400 flex-shrink-0 px-1">{error}</div>}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-2.5 px-1 py-1">
        {/* ─── Skeleton Loading State ─── */}
        {isInitialLoad && (
          <div className="space-y-2.5">
            <SkeletonCard delay={0} />
            <SkeletonCard delay={100} />
            <SkeletonCard delay={200} />
          </div>
        )}

        {/* ─── Real Violation Cards with Live Animation ─── */}
        {!isInitialLoad && violations.length > 0 && (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {violations.map((v) => {
                const isSelected = selectedViolation && selectedViolation.id === v.id;
                const isEnforced = v.status === 'ENFORCED';

                return (
                  <motion.div
                    key={v.id}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                    className={`threat-card rounded-lg p-3 cursor-pointer transition-colors duration-200 ${
                      isSelected
                        ? 'border-2 border-red-500 bg-zinc-800/95 shadow-[0_0_18px_rgba(239,68,68,0.35)]'
                        : `border border-zinc-800/80 border-l-[3.5px] ${getBreachBorderColor(v.breach_type)} bg-zinc-900/90 hover:bg-zinc-800/70`
                    } ${getCardClass(v.breach_type)}`}
                    onClick={() => onSelect && onSelect(v)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-wider uppercase badge-glow flex-shrink-0 ${getBadgeGlowClass(v.breach_type)} ${
                            v.breach_type === "PIRACY" ? "bg-red-600/90 text-white" :
                            v.breach_type === "TERRITORY" ? "bg-orange-500/90 text-white" :
                            v.breach_type === "PRE_RELEASE" ? "bg-purple-500/90 text-white" :
                            "bg-zinc-600 text-white"
                          }`}
                        >
                          {v.breach_type || 'THREAT'}
                        </span>

                        {isEnforced && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider flex-shrink-0">
                            ENFORCED
                          </span>
                        )}

                        {v.status === 'RESOLVED' && (
                          <span
                            data-testid={`status-badge-resolved-${v.id}`}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase tracking-wider flex-shrink-0 flex items-center gap-0.5 shadow-[0_0_8px_rgba(16,185,129,0.25)]"
                          >
                            <span>✓</span> RESOLVED
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0 ml-1">
                        {v.timestamp ? (new Date(v.timestamp).toLocaleTimeString ? new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : v.timestamp) : ''}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="font-bold text-sm text-zinc-100 truncate pr-2">{v.asset_name}</p>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse flex-shrink-0" />
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-400 font-mono">
                      <span className="truncate">Server: <strong className="text-zinc-300">{v.location}</strong></span>
                      <span className="text-[10px] text-zinc-500 flex-shrink-0 ml-2">#{v.id}</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
