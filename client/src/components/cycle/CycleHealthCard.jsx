import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart, Plus, ArrowRight, Repeat, ShieldCheck } from 'lucide-react';
import Provenance, { fmtDay, PERIOD_LABEL, PHASE_HINT } from './Provenance.jsx';
import CycleLogModal from './CycleLogModal.jsx';
import { useInput } from '../../context/InputContext.jsx';

const METRIC = { hr: 'Heart rate', steps: 'Activity', sleep: 'Sleep', temp: 'Temperature' };
const UNIT = { hr: 'BPM', steps: 'steps', sleep: 'h', temp: '°C' };

// "Cycle & Health" on the Overview — cycle context shown next to (and used for) the rest of the data.
export default function CycleHealthCard({ cycle }) {
  const [log, setLog] = useState(false);
  const { bump } = useInput();
  if (!cycle?.tracking) return null;
  const c = cycle.context || {};
  const p = cycle.pattern;
  const recent = (cycle.symptoms || []).filter((s) => Date.now() - new Date(s.ts) < 3 * 86400000 && s.severity != null);
  const maxPain = Math.max(0, ...recent.filter((s) => ['pain', 'cramps'].includes(s.symptom)).map((s) => s.severity));
  const inPeriod = (m) => cycle.baselines?.find((b) => b.metric === m && b.cycleContext === 'period_days_1_3');
  const outside = (m) => cycle.baselines?.find((b) => b.metric === m && b.cycleContext === 'outside_period');
  const compare = ['hr', 'steps', 'sleep'].filter((m) => inPeriod(m) && outside(m));

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-500"><CalendarHeart size={18} /></span>
          <div>
            <p className="eyebrow">Cycle &amp; health</p>
            <h2 className="mt-0.5 text-lg font-medium">{c.known ? (c.cycleDay ? `Cycle day ${c.cycleDay}` : 'Cycle day uncertain') : 'Cycle context'}</h2>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setLog(true)} className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2 text-xs font-medium text-white hover:bg-rose-600"><Plus size={14} /> Log</button>
          <Link to="/cycle" className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs text-ink-soft hover:bg-canvas">Details <ArrowRight size={13} /></Link>
        </div>
      </div>

      {!c.known ? (
        <p className="mt-4 text-sm text-ink-soft">{c.message || 'Record the first day of your period to start cycle context.'}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-canvas px-3 py-2.5">
              <p className="text-[11px] text-ink-mute">Period status</p>
              <p className="mt-0.5 text-sm font-medium">{PERIOD_LABEL[c.period?.status] || '—'}</p>
              <Provenance source={c.period?.source} className="mt-1" />
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2.5">
              <p className="text-[11px] text-ink-mute">Cycle day</p>
              <p className="mt-0.5 text-sm font-medium">{c.cycleDay ?? '—'}{c.overdue && <span className="text-xs font-normal text-amber-700"> · period not recorded</span>}</p>
              <Provenance source={c.startSource} confidence={c.dayConfidence} className="mt-1" />
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2.5">
              <p className="text-[11px] text-ink-mute">Expected period</p>
              <p className="mt-0.5 text-sm font-medium">{fmtDay(c.nextPeriod?.date)} <span className="text-xs font-normal text-ink-mute">±{c.nextPeriod?.windowDays}d</span></p>
              <Provenance source={c.nextPeriod?.source} confidence={c.nextPeriod?.confidence} className="mt-1" />
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2.5" title={PHASE_HINT}>
              <p className="text-[11px] text-ink-mute">Phase</p>
              <p className="mt-0.5 text-sm font-medium capitalize">{c.phase?.name || 'Not estimated'}</p>
              {c.phase && <Provenance source="ai_estimated" confidence={c.phase.confidence} className="mt-1" />}
            </div>
          </div>

          {(recent.length > 0 || compare.length > 0) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recent.length > 0 && (
                <div className="rounded-xl border border-line px-3 py-2.5 text-xs">
                  <p className="font-medium">Last 3 days</p>
                  <p className="mt-1 text-ink-soft">
                    {maxPain > 0 && <>Pain up to <b>{maxPain}/10</b> · </>}
                    {[...new Set(recent.map((s) => s.symptom.replace('_', ' ')))].slice(0, 4).join(', ')}
                  </p>
                </div>
              )}
              {compare.length > 0 && (
                <div className="rounded-xl border border-line px-3 py-2.5 text-xs">
                  <p className="font-medium">Your cycle-aware baseline</p>
                  <ul className="mt-1 space-y-0.5 text-ink-soft">
                    {compare.map((m) => (
                      <li key={m}>{METRIC[m]}: days 1–3 <b>{inPeriod(m).baselineValue}</b> vs <b>{outside(m).baselineValue}</b> {UNIT[m]} otherwise</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {p?.detected && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-900"><Repeat size={15} /> Recurring cycle-associated symptom pattern detected</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">{p.summary}</p>
              <p className="mt-2 flex gap-1.5 text-[11px] text-amber-900/80"><ShieldCheck size={12} className="mt-0.5 shrink-0" /> This is a pattern, not a diagnosis. Consider discussing it with a qualified healthcare professional.</p>
            </div>
          )}
        </>
      )}

      <CycleLogModal open={log} onClose={() => setLog(false)} onSaved={bump} periodOngoing={c.period?.status === 'on_period'} />
    </section>
  );
}
