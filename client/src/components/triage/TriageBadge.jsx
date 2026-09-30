// Shared visual language for triage levels (LOW → MONITOR → MODERATE → HIGH).
export const LEVELS = ['LOW', 'MONITOR', 'MODERATE', 'HIGH'];

export const LEVEL_STYLE = {
  LOW: { label: 'Low', text: 'text-brand-700', bg: 'bg-brand-50', ring: '#1f9a86', bar: 'bg-brand-500', desc: 'No repeated abnormal patterns. Routine monitoring continues.' },
  MONITOR: { label: 'Monitor', text: 'text-blue-700', bg: 'bg-blue-50', ring: '#4a7fc1', bar: 'bg-blue-500', desc: 'A pattern is emerging. The system is watching more closely.' },
  MODERATE: { label: 'Moderate', text: 'text-amber-700', bg: 'bg-amber-50', ring: '#d08a1c', bar: 'bg-amber-500', desc: 'A repeated pattern with supporting evidence. Consider discussing it with a clinician.' },
  HIGH: { label: 'High', text: 'text-red-700', bg: 'bg-red-50', ring: '#d94452', bar: 'bg-red-500', desc: 'Strong, well-supported pattern. Clinical evaluation is recommended.' },
};

export default function TriageBadge({ level, className = '' }) {
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.LOW;
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${s.bg} ${s.text} ${className}`}>{level}</span>;
}

/** Four-step scale with the current level highlighted. */
export function TriageScale({ level }) {
  const idx = LEVELS.indexOf(level);
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {LEVELS.map((l, i) => (
          <div key={l} className={`h-2 rounded-full ${i <= idx ? LEVEL_STYLE[level].bar : 'bg-line'} ${i === idx ? 'ring-2 ring-offset-2 ring-offset-white' : ''}`} style={i === idx ? { '--tw-ring-color': LEVEL_STYLE[level].ring } : undefined} />
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-[10px] text-ink-mute">
        {LEVELS.map((l) => <span key={l} className={l === level ? `font-semibold ${LEVEL_STYLE[level].text}` : ''}>{l}</span>)}
      </div>
    </div>
  );
}
