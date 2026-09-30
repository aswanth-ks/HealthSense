// Low / normal / high zones with a marker at the current value.
export default function RangeBar({ value, range, color }) {
  const pct = (v) => ((v - range.min) / (range.max - range.min)) * 100;
  const low = pct(range.low);
  const high = pct(range.high);
  const pos = Math.min(100, Math.max(0, pct(value)));
  return (
    <div>
      <div className="relative h-2 rounded-full bg-amber-100">
        <div className="absolute inset-y-0 rounded-full bg-brand-100" style={{ left: `${low}%`, width: `${high - low}%` }} />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white"
          style={{ left: `${pos}%`, borderColor: color }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-mute">
        <span>Low</span>
        <span className="text-brand-700">Normal {range.low}–{range.high}</span>
        <span>High</span>
      </div>
    </div>
  );
}
