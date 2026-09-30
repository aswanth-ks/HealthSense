// Small form controls shared by the check-in, symptom log and question cards.

export function Chips({ options, value, onChange, multi = false }) {
  const active = (o) => (multi ? value.includes(o) : value === o);
  const toggle = (o) => (multi ? onChange(active(o) ? value.filter((x) => x !== o) : [...value, o]) : onChange(active(o) ? null : o));
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const label = typeof o === 'object' ? o.label : o;
        const val = typeof o === 'object' ? o.value : o;
        return (
          <button
            key={String(val)}
            type="button"
            onClick={() => toggle(val)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active(val) ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-line bg-white text-ink-soft hover:bg-canvas'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ value, onChange, min = 0, max = 10, low = 'None', high = 'Worst' }) {
  const pct = ((value ?? min) - min) / (max - min);
  const color = pct >= 0.6 ? 'text-red-600' : pct >= 0.3 ? 'text-amber-600' : 'text-brand-700';
  return (
    <div>
      <div className="flex items-center gap-4">
        <input
          type="range" min={min} max={max} step={1} value={value ?? min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-brand-600"
        />
        <span className={`w-10 text-right text-sm font-medium ${color}`}>{value ?? '—'}</span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-mute"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function Section({ label, hint, children }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[11px] text-ink-mute">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
