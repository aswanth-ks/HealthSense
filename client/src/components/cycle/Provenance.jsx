// Menstrual-data provenance: observed (reported) vs historical estimate vs AI estimate — never blurred.
const STYLES = {
  user_reported: { label: 'Reported', cls: 'bg-blue-50 text-blue-700' },
  historical: { label: 'Historical estimate', cls: 'bg-violet-50 text-violet-700' },
  ai_estimated: { label: 'AI estimated', cls: 'bg-amber-50 text-amber-700' },
};

export default function Provenance({ source, confidence, className = '' }) {
  const s = STYLES[source];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls} ${className}`}>
      {s.label}
      {confidence != null && <span className="font-normal opacity-80">· {Math.round(confidence * 100)}%</span>}
    </span>
  );
}

export const fmtDay = (d, opts = { month: 'short', day: 'numeric' }) => (d ? new Date(d).toLocaleDateString('en-US', opts) : '—');
export const PERIOD_LABEL = { on_period: 'On period', not_on_period: 'Not on period' };
export const REGULARITY_LABEL = { regular: 'Regular', somewhat_irregular: 'Somewhat irregular', very_irregular: 'Very irregular', unsure: 'Not sure yet' };
export const PHASE_HINT = 'Phase is an estimate based on your cycle length — not a measurement.';
