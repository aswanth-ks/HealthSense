const STYLES = {
  measured: { label: 'Measured', cls: 'bg-brand-50 text-brand-700' },
  reported: { label: 'Reported', cls: 'bg-blue-50 text-blue-700' },
  estimated: { label: 'AI Estimated', cls: 'bg-amber-50 text-amber-700' },
  imported: { label: 'Imported', cls: 'bg-sky-50 text-sky-800' }, // Health Connect / Apple Health
};

// Every data point shows where it came from and how confident we are (spec §F).
export default function SourceBadge({ source, confidence, className = '' }) {
  const s = STYLES[source];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls} ${className}`}>
      {s.label}
      {confidence != null && <span className="font-normal opacity-80">· {Math.round(confidence * 100)}%</span>}
    </span>
  );
}
