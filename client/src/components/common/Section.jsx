// Shared page-section panel. Each part of a page sits in a softly tinted panel so sections are easy to tell
// apart. Colour has a fixed meaning across the app (keep it to ~3 tones per page):
//   teal   – your status & baseline        indigo – monitoring & the closed loop
//   amber  – attention: patterns, deviations   violet – insight / meaning
//   sky    – your input                     rose   – menstrual cycle      slate – neutral / system
export const TONES = {
  teal: { panel: 'border-brand-100 bg-brand-50/50', badge: 'bg-brand-600', icon: 'bg-brand-100 text-brand-700', eyebrow: 'text-brand-700' },
  indigo: { panel: 'border-indigo-100 bg-indigo-50/40', badge: 'bg-indigo-600', icon: 'bg-indigo-100 text-indigo-700', eyebrow: 'text-indigo-700' },
  amber: { panel: 'border-amber-100 bg-amber-50/50', badge: 'bg-amber-500', icon: 'bg-amber-100 text-amber-700', eyebrow: 'text-amber-700' },
  violet: { panel: 'border-violet-100 bg-violet-50/40', badge: 'bg-violet-600', icon: 'bg-violet-100 text-violet-700', eyebrow: 'text-violet-700' },
  sky: { panel: 'border-sky-100 bg-sky-50/50', badge: 'bg-sky-600', icon: 'bg-sky-100 text-sky-700', eyebrow: 'text-sky-700' },
  rose: { panel: 'border-rose-100 bg-rose-50/50', badge: 'bg-rose-500', icon: 'bg-rose-100 text-rose-600', eyebrow: 'text-rose-600' },
  slate: { panel: 'border-line bg-white/60', badge: 'bg-ink-soft', icon: 'bg-canvas text-ink-soft', eyebrow: 'text-ink-soft' },
};

export default function Section({ id, n, tone = 'slate', icon: Icon, eyebrow, title, subtitle, action, children, className = '' }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <section id={id} className={`scroll-mt-28 rounded-3xl border p-4 sm:p-6 ${t.panel} ${className}`}>
      {(title || eyebrow) && (
        <div className="mb-5 flex items-start gap-3">
          {n != null && <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white shadow-sm ${t.badge}`}>{n}</span>}
          {n == null && Icon && <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.icon}`}><Icon size={17} /></span>}
          <div className="min-w-0 flex-1">
            {eyebrow && <p className={`text-[11px] font-semibold uppercase tracking-wider ${t.eyebrow}`}>{eyebrow}</p>}
            {title && <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          {action}
          {n != null && Icon && !action && <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${t.icon}`}><Icon size={19} /></span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Chip row that jumps to sections on long story pages (swipeable on phones). */
export function StepNav({ steps }) {
  return (
    <nav aria-label="Page sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {steps.map(([id, label], i) => (
          <li key={id}>
            <a href={`#${id}`} className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-soft shadow-card hover:border-brand-300 hover:text-brand-800">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-canvas text-[10px] font-semibold text-ink">{i + 1}</span>{label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
