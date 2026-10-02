import { HelpCircle, ShieldCheck, Clock, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../common/Card.jsx';
import { LEVEL_STYLE, LEVELS } from '../triage/TriageBadge.jsx';

// "Your status" — current triage level with its top reasons (falls back to the range status before triage exists).
export default function MonitoringStatus({ status, triage, changed }) {
  const t = triage ? LEVEL_STYLE[triage.level] : null;
  const ring = t ? t.ring : '#1f9a86';
  const up = changed && LEVELS.indexOf(changed.to) > LEVELS.indexOf(changed.from);
  const reasons = triage?.reasons?.length ? triage.reasons : triage?.reason ? [triage.reason] : [];

  return (
    <Card
      eyebrow="Your status"
      title={triage ? 'Current triage level' : 'Overall monitoring status'}
      action={<Link to="/insights" aria-label="How is this calculated?"><HelpCircle size={18} className="text-ink-soft hover:text-ink" /></Link>}
      className="lg:col-span-2"
    >
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="grid h-28 w-28 shrink-0 sm:h-32 sm:w-32 place-items-center rounded-full border-[6px]" style={{ borderColor: `${ring}33`, background: `${ring}12` }}>
          <div className="text-center">
            <ShieldCheck size={22} className="mx-auto" style={{ color: ring }} />
            <p className={`mt-1 text-lg font-semibold ${t ? t.text : 'text-brand-700'}`}>{triage ? triage.level : status.label}</p>
            <p className="px-2 text-[10px] text-ink-mute">{triage ? `${Math.round(triage.confidence * 100)}% confidence` : status.note}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ink-soft">{triage ? t.desc : 'All currently available measurements are within the configured monitoring ranges.'}</p>
            {changed && (
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] ${up ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {changed.from} → {changed.to}
              </span>
            )}
          </div>

          {triage && triage.level !== 'LOW' && reasons.length > 0 && (
            <ul className="space-y-1.5">
              {reasons.map((r) => (
                <li key={r} className="flex gap-2 text-ink"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ring }} />{r}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><Clock size={14} /> Last reading {status.updatedAt}</span>
            {triage && (
              <Link to="/insights" className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                See the full explanation <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </div>
      </div>
      {triage && <p className="mt-4 text-[10px] text-ink-mute">Risk/triage information — not a diagnosis.</p>}
    </Card>
  );
}
