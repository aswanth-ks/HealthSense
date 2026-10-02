import { ArrowDownRight, ArrowUpRight, Minus, Smartphone, FlaskConical } from 'lucide-react';
import { todayKey } from '../../services/healthApi.js';
import { addDays } from '../../services/stepsCalc.js';

export const fmtSteps = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
export const SOURCE_NAME = { HEALTH_CONNECT: 'Health Connect', APPLE_HEALTH: 'Apple Health', DEMO: 'Demo data' };

const keyDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

/** "Today" / "Yesterday" / "Oct 1" */
export function dayLabel(key, opts = { month: 'short', day: 'numeric' }) {
  const t = todayKey();
  if (key === t) return 'Today';
  if (key === addDays(t, -1)) return 'Yesterday';
  return keyDate(key).toLocaleDateString('en-US', opts);
}
export const shortDay = (key) => keyDate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "Today, 8:30 AM" */
export function syncedLabel(ts) {
  if (!ts) return 'Never';
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dayLabel(todayKeyOf(d))}, ${time}`;
}
const pad = (n) => String(n).padStart(2, '0');
const todayKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** ↑ 1,240 · +22.1% — or "Comparison unavailable" (missing / zero previous day). */
export function Change({ change, vs = 'vs yesterday', className = '', showPercent = true }) {
  if (!change || change.diff == null || (!change.available && change.reason !== 'previous_zero')) {
    return <span className={`text-xs text-ink-mute ${className}`}>Comparison unavailable</span>;
  }
  const up = change.direction === 'up';
  const same = change.direction === 'same';
  const Icon = same ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const cls = same ? 'text-ink-soft' : up ? 'text-brand-700' : 'text-amber-700';
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 text-xs ${className}`}>
      <span className={`inline-flex items-center gap-0.5 font-semibold ${cls}`}><Icon size={14} />{fmtSteps(Math.abs(change.diff))}</span>
      {showPercent && (change.percent != null
        ? <span className={cls}>{change.percent > 0 ? '+' : ''}{change.percent}%</span>
        : <span className="text-ink-mute">· % unavailable</span>)}
      {vs && <span className="text-ink-mute">{vs}</span>}
    </span>
  );
}

/** Small source chip: Health Connect / Apple Health (Imported) or Demo data. */
export function SourceChip({ source, className = '' }) {
  if (!source) return null;
  const demo = source === 'DEMO';
  const Icon = demo ? FlaskConical : Smartphone;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${demo ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'} ${className}`}>
      <Icon size={10} /> {SOURCE_NAME[source] || source}{!demo && <span className="font-normal opacity-80">· Imported</span>}
    </span>
  );
}
