export default function ScoreRing({ score, size = 140 }) {
  const r = 58;
  const c = 2 * Math.PI * r;
  const label = score >= 85 ? 'Good' : score >= 70 ? 'Fair' : 'Needs attention';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#d5eeea" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke="#1f9a86" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-4xl font-medium leading-none text-brand-900">{score}</p>
          <p className="mt-1 text-[11px] text-ink-mute">/ 100</p>
          <p className="mt-1 text-xs font-medium text-brand-700">{label}</p>
        </div>
      </div>
    </div>
  );
}
