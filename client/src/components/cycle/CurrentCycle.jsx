import { useState } from 'react';
import { CalendarHeart, CalendarPlus, Info, Plus, Sparkles, TrendingUp, X } from 'lucide-react';
import Card from '../common/Card.jsx';
import Provenance, { fmtDay } from './Provenance.jsx';
import { periodStart, addPreviousCycle, markPreviousUnknown } from '../../services/cycleApi.js';
import { inputCls } from '../input/fields.jsx';

const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;
const longDay = (d) => fmtDay(d, { month: 'long', day: 'numeric' });

/** First-time state: no most-recent period yet → explain and start the guided setup. */
export function UnderstandYourCycle({ onStart }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-600"><CalendarHeart size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">Let&apos;s understand your cycle</p>
          <p className="mt-1 text-sm text-ink-soft">HealthSense uses your previous cycle history to estimate your current cycle and understand patterns that may affect your symptoms, sleep, activity and daily health.</p>
        </div>
        <button onClick={onStart} className="min-h-[44px] rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-600">Start setup</button>
      </div>
    </Card>
  );
}

/** Inline "add a previous cycle" form (validated server-side too). */
export function AddPreviousCycle({ maxDate, onAdded, onCancel }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setError('');
    if (!start) return setError('Choose the date the period started.');
    if (end && end < start) return setError('The end date cannot be before the start date.');
    setBusy(true);
    try { await addPreviousCycle({ startDate: start, periodEndDate: end || null }); onAdded?.(); }
    catch (e) { setError(e.response?.data?.message || 'Could not save.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-soft">Period started<input type="date" max={maxDate} className={`${inputCls} mt-1 block`} value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="text-xs text-ink-soft">Period ended <span className="text-ink-mute">(optional)</span><input type="date" min={start} max={maxDate} className={`${inputCls} mt-1 block`} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <button onClick={save} disabled={busy} className="min-h-[42px] rounded-xl bg-rose-500 px-4 text-xs font-medium text-white disabled:opacity-60">{busy ? 'Saving…' : 'Add cycle'}</button>
        {onCancel && <button onClick={onCancel} aria-label="Cancel" className="min-h-[42px] rounded-xl px-2 text-ink-mute hover:bg-white"><X size={16} /></button>}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Current cycle: estimated day, what it's based on, confidence, and the "Period started today" action. */
export function CurrentCycleCard({ c, onChanged, onSetup }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState(false);

  const started = async () => {
    if (!window.confirm('Record that your period started today?')) return;
    setBusy(true);
    try {
      const r = await periodStart(new Date().toISOString());
      setMsg(r?.pending ? 'Saved on this device — pending sync.' : 'Period start reported. Your cycle was recalculated.');
      onChanged?.();
    } finally { setBusy(false); }
  };

  if (!c.known) return <UnderstandYourCycle onStart={onSetup} />;

  return (
    <Card>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Day */}
        <div className="flex items-center gap-4 lg:w-60 lg:flex-col lg:items-start">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[6px] border-rose-100 bg-rose-50/60 text-center">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-rose-600">Day</p>
              <p className="text-3xl font-semibold leading-none text-rose-700">{c.cycleDay ?? '?'}</p>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold">{c.cycleDay ? `Day ${c.cycleDay}` : 'Cycle day uncertain'}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5"><Provenance source="ai_estimated" confidence={c.confidence} /><span className="text-xs text-ink-mute">Estimated</span></p>
            {c.overdue && <p className="mt-1 text-xs text-amber-700">Your last recorded period was a while ago — has a new one started?</p>}
          </div>
        </div>

        {/* Facts */}
        <dl className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ['Cycle started', longDay(c.lastPeriodStart), <Provenance key="p" source={c.startSource} />],
            ['Typical cycle', c.length?.days ? `${c.length.days} days` : 'Unknown', c.length?.source && <Provenance key="p" source={c.length.source} confidence={c.length.confidence} />],
            ['Current date', longDay(new Date()), null],
            ['Period status', c.period?.label || 'Unknown', c.period?.source && <Provenance key="p" source={c.period.source} confidence={c.period.source === 'ai_estimated' ? c.period.confidence : null} />],
            ['Cycle phase', c.phase?.label || 'Uncertain', c.phase?.source && <Provenance key="p" source="ai_estimated" confidence={c.phase.confidence} />],
            ['Expected next period', c.nextPeriod ? `${fmtDay(c.nextPeriod.date)} ±${c.nextPeriod.windowDays}d` : 'Not estimated', c.nextPeriod && <Provenance key="p" source={c.nextPeriod.source} confidence={c.nextPeriod.confidence} />],
          ].map(([k, v, prov]) => (
            <div key={k} className="rounded-xl bg-canvas px-3 py-2.5">
              <dt className="text-[11px] text-ink-mute">{k}</dt>
              <dd className="mt-0.5 text-sm font-medium">{v}</dd>
              {prov && <div className="mt-1">{prov}</div>}
            </div>
          ))}
        </dl>
      </div>

      {/* Confidence + based on */}
      <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-[180px_1fr]">
        <div>
          <p className="text-[11px] text-ink-mute">Confidence</p>
          <p className="text-2xl font-semibold text-rose-700">{pct(c.confidence)}</p>
          <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-rose-400" style={{ width: pct(c.confidence) }} /></div>
        </div>
        <div>
          <p className="text-[11px] text-ink-mute">Based on</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {(c.confidenceFactors || []).map((f) => (
              <li key={f.factor} className={`rounded-full px-2.5 py-1 text-[11px] ${f.effect === '+' ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-800'}`}>{f.effect === '+' ? '✓' : '!'} {f.factor}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-ink-mute">A software data-confidence indicator — not clinically validated.</p>
        </div>
      </div>

      {/* Missing information */}
      {c.status === 'needs_more' && c.missing?.includes('previous_period_start') && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Info size={15} /> We need a little more information</p>
          <p className="mt-1 text-xs text-amber-900/90">HealthSense knows your most recent period started on {longDay(c.lastPeriodStart)}, but your previous cycle history is incomplete. Adding your previous period date will improve cycle estimation.</p>
          {adding ? (
            <div className="mt-3"><AddPreviousCycle maxDate={new Date(c.lastPeriodStart).toISOString().slice(0, 10)} onAdded={() => { setAdding(false); onChanged?.(); }} onCancel={() => setAdding(false)} /></div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setAdding(true)} className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-xs font-medium text-white"><Plus size={14} /> Add Previous Cycle</button>
              <button onClick={async () => { await markPreviousUnknown(); onChanged?.(); }} className="min-h-[40px] rounded-xl border border-amber-200 bg-white px-4 text-xs text-amber-900">I don&apos;t remember</button>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={started} disabled={busy} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-rose-500 px-5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60">
          <CalendarPlus size={16} /> {busy ? 'Saving…' : 'Period started today'}
        </button>
        {msg && <span className="text-xs text-brand-700">{msg}</span>}
      </div>
    </Card>
  );
}

/** Personal cycle baseline (median length, observed range, cycles analysed). */
export function CycleBaselineCard({ b }) {
  if (!b || b.status === 'developing' && !b.cycles_used) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-base font-semibold"><Sparkles size={16} className="text-rose-500" /> Cycle baseline developing</p>
        <p className="mt-1 text-sm text-ink-soft">HealthSense needs more cycle history to better understand your personal pattern. Each period you report improves it.</p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-semibold"><TrendingUp size={16} className="text-brand-600" /> Your cycle baseline</p>
        {b.status === 'developing' && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800">Still developing</span>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-canvas px-3 py-2.5"><dt className="text-[11px] text-ink-mute">Typical cycle</dt><dd className="text-lg font-semibold">{b.median_cycle_length} days</dd><dd className="text-[10px] text-ink-mute">median</dd></div>
        <div className="rounded-xl bg-canvas px-3 py-2.5"><dt className="text-[11px] text-ink-mute">Observed range</dt><dd className="text-lg font-semibold">{b.min_cycle_length === b.max_cycle_length ? b.min_cycle_length : `${b.min_cycle_length}–${b.max_cycle_length}`} days</dd></div>
        <div className="rounded-xl bg-canvas px-3 py-2.5"><dt className="text-[11px] text-ink-mute">Cycles analysed</dt><dd className="text-lg font-semibold">{b.cycles_used}</dd></div>
        <div className="rounded-xl bg-canvas px-3 py-2.5"><dt className="text-[11px] text-ink-mute">Confidence</dt><dd className="text-lg font-semibold">{pct(b.confidence)}</dd></div>
      </dl>
      {b.status === 'developing' && <p className="mt-3 text-xs text-ink-soft">HealthSense needs more cycle history to better understand your personal pattern (3+ cycles).</p>}
    </Card>
  );
}
