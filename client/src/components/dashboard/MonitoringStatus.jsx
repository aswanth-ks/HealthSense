import { HelpCircle, ShieldCheck, Clock, Bluetooth, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../common/Card.jsx';
import { LEVEL_STYLE } from '../triage/TriageBadge.jsx';

// Shows the current triage level when available (spec §27-A "current triage level"), else the range status.
export default function MonitoringStatus({ status, source, triage }) {
  const t = triage ? LEVEL_STYLE[triage.level] : null;
  const ring = t ? t.ring : '#1f9a86';

  return (
    <Card
      eyebrow="Monitoring Overview"
      title={triage ? 'Current Triage Level' : 'Overall Monitoring Status'}
      action={<Link to="/insights" aria-label="How is this calculated?"><HelpCircle size={18} className="text-ink-soft hover:text-ink" /></Link>}
      className="lg:col-span-2"
    >
      <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
        <div className="grid h-32 w-32 shrink-0 place-items-center rounded-full border-[6px]" style={{ borderColor: `${ring}33`, background: `${ring}12` }}>
          <div className="text-center">
            <ShieldCheck size={22} className="mx-auto" style={{ color: ring }} />
            <p className={`mt-1 text-lg font-semibold ${t ? t.text : 'text-brand-700'}`}>{triage ? triage.level : status.label}</p>
            <p className="px-2 text-[10px] text-ink-mute">{triage ? `${Math.round(triage.confidence * 100)}% confidence` : status.note}</p>
          </div>
        </div>
        <div className="space-y-4 text-sm">
          <p className="max-w-md text-ink-soft">
            {triage
              ? (triage.level === 'LOW' ? t.desc : <>{t.desc} <span className="text-ink">Main reason: {triage.reason}.</span></>)
              : 'All currently available measurements are within the configured monitoring ranges.'}
          </p>
          <p className="flex items-center gap-2 text-ink-soft">
            <Clock size={15} /> Last updated <span className="font-medium text-ink">{status.updatedAt}</span>
          </p>
          <p className="flex items-center gap-2 text-ink-soft">
            <Bluetooth size={15} /> Source <span className="font-medium text-ink">{source}</span>
          </p>
          {triage && (
            <Link to="/insights" className="inline-flex items-center gap-1.5 text-xs text-brand-700 hover:underline">
              See why and what changed <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
