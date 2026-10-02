import Section from '../components/common/Section.jsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { CalendarHeart, Plus, Trash2, Pencil, Check, X, Repeat, Lock, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import ConnectionUnavailable from '../components/common/ConnectionUnavailable.jsx';
import Provenance, { fmtDay, PERIOD_LABEL, REGULARITY_LABEL, PHASE_HINT } from '../components/cycle/Provenance.jsx';
import CycleLogModal from '../components/cycle/CycleLogModal.jsx';
import CycleSetupModal, { SAFETY } from '../components/cycle/CycleSetupModal.jsx';
import { CurrentCycleCard, CycleBaselineCard, AddPreviousCycle } from '../components/cycle/CurrentCycle.jsx';
import useCycle from '../hooks/useCycle.js';
import { useInput } from '../context/InputContext.jsx';
import { editCycle, deleteCycle, deleteCycleSymptom } from '../services/cycleApi.js';

const METRIC = { hr: 'Heart rate (BPM)', temp: 'Temperature (°C)', resp: 'Respiration (br/min)', spo2: 'SpO₂ (%)', steps: 'Activity (steps)', sleep: 'Sleep (h)' };
const SYM = { pain: 'Pain', cramps: 'Cramps', fatigue: 'Fatigue', bloating: 'Bloating', headache: 'Headache', sleep_disturbance: 'Sleep disturbance', activity_impact: 'Activity impact', flow: 'Flow', custom: 'Other' };
const inputCls = 'rounded-lg border border-line bg-white px-2 py-1.5 text-xs';

function Stat({ label, children, sub }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2.5">
      <p className="text-[11px] text-ink-mute">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

function CycleRow({ c, onChanged }) {
  const [edit, setEdit] = useState(false);
  const [start, setStart] = useState(c.startDate?.slice(0, 10));
  const [end, setEnd] = useState(c.periodEndDate?.slice(0, 10) || '');
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    if (end && end < start) return setErr('End cannot be before start.');
    try { await editCycle(c.id, { startDate: start, periodEndDate: end || null }); setEdit(false); onChanged(); }
    catch (e) { setErr(e.response?.data?.message || 'Could not save.'); }
  };
  const remove = async () => { if (window.confirm('Delete this cycle record?')) { await deleteCycle(c.id); onChanged(); } };
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
      {edit ? (
        <>
          <label className="text-xs text-ink-mute">Start <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="text-xs text-ink-mute">Period end <input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <div className="ml-auto flex gap-1">
            <button onClick={save} aria-label="Save" className="rounded-lg p-1.5 text-brand-700 hover:bg-brand-50"><Check size={16} /></button>
            <button onClick={() => setEdit(false)} aria-label="Cancel" className="rounded-lg p-1.5 text-ink-mute hover:bg-canvas"><X size={16} /></button>
          </div>
          {err && <p className="w-full text-xs text-red-600">{err}</p>}
        </>
      ) : (
        <>
          <div className="min-w-[110px] flex-1">
            <p className="font-medium">{fmtDay(c.startDate, { month: 'long', day: 'numeric' })} → {c.endDate ? fmtDay(c.endDate, { month: 'long', day: 'numeric' }) : 'now'}</p>
            <p className="text-[11px] text-ink-mute">{c.cycleLength ? `${c.cycleLength} days${c.possibleGap ? ' · possible missing cycle record (not used for your baseline)' : ''}` : 'Current cycle'} · {c.periodLength ? `${c.periodLength}-day period` : 'period end not recorded'}</p>
          </div>
          <Provenance source={c.source} confidence={c.confidence} />
          <div className="flex gap-1">
            <button onClick={() => setEdit(true)} aria-label="Edit" className="rounded-lg p-1.5 text-ink-mute hover:bg-canvas"><Pencil size={15} /></button>
            <button onClick={remove} aria-label="Delete" className="rounded-lg p-1.5 text-ink-mute hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
          </div>
        </>
      )}
    </li>
  );
}

// Full "Cycle & Health" view: context, recurring patterns across cycles, cycle-aware baselines, history, privacy.
export default function CycleHealth() {
  const { data, error, reload } = useCycle();
  const { bump } = useInput();
  const [log, setLog] = useState(false);
  const [setup, setSetup] = useState(false);
  const [addPrev, setAddPrev] = useState(false);
  const changed = () => { reload(); bump(); };

  if (error && !data) return <ConnectionUnavailable onRetry={reload} />;
  if (!data) return <p className="text-sm text-ink-soft">Loading…</p>;
  if (!data.tracking) {
    return (
      <section className="card mx-auto max-w-xl p-6 text-center">
        <CalendarHeart className="mx-auto text-rose-500" size={28} />
        <h1 className="mt-3 text-xl font-medium">Menstrual cycle tracking is off</h1>
        <p className="mt-2 text-sm text-ink-soft">{data.sample ? 'Cycle tracking needs a HealthSense account.' : 'Turn it on in Settings → Health tracking to use your cycle as context for your symptoms and readings.'}</p>
        {!data.sample && <Link to="/settings" className="mt-5 inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-medium text-white">Open Settings</Link>}
      </section>
    );
  }

  const c = data.context;
  const p = data.pattern;
  const chart = (p?.perCycle || []).map((x) => ({
    name: `Cycle ${fmtDay(x.startDate)}`,
    pain: x.pain,
    fatigue: x.fatigue,
    drop: Math.max(0, x.activityDropPct ?? 0),
  }));
  const contexts = [...new Set(data.baselines.map((b) => b.metric))].map((m) => ({
    metric: m,
    inP: data.baselines.find((b) => b.metric === m && b.cycleContext === 'period_days_1_3'),
    out: data.baselines.find((b) => b.metric === m && b.cycleContext === 'outside_period'),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Health tracking"
        title="Cycle & Health"
        subtitle="Your menstrual cycle as context for your symptoms and physiological data — learned from your own history."
        right={<button onClick={() => setLog(true)} className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-medium text-white hover:bg-rose-600"><Plus size={14} /> Log cycle info</button>}
      />

      {/* Current cycle — estimated from your reported history, never assumed */}
      <Section tone="rose" icon={CalendarHeart} eyebrow="Current cycle" title={c.known ? 'Your current cycle' : 'Cycle tracking setup'} subtitle={c.status === 'ready' ? 'Cycle tracking is ready' : undefined}>
        <CurrentCycleCard c={c} onChanged={changed} onSetup={() => setSetup(true)} />
      </Section>

      <Section tone="teal" className="!p-2 sm:!p-3">
        <CycleBaselineCard b={c.baseline} />
      </Section>

      {/* Recurring patterns across cycles */}
      <Section tone="amber" className="!p-2 sm:!p-3">
        <Card eyebrow="Across cycles" title="Recurring patterns">
          {p?.detected ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-900"><Repeat size={15} /> Recurring cycle-associated symptom pattern detected</p>
              <p className="mt-1 text-xs text-amber-900/90">{p.summary}</p>
              <p className="mt-1.5 text-[11px] text-amber-900/80">{p.statement}</p>
            </div>
          ) : (
            <p className="mb-4 text-sm text-ink-soft">No recurring pattern across cycles yet. Patterns need at least two cycles with recorded symptoms.</p>
          )}
          {chart.length > 0 && (p?.perCycle || []).some((x) => x.symptomsRecorded > 0 || x.activityDropPct != null) && (
            <>
              <p className="mb-2 text-xs text-ink-mute">Cycle days 1–3 compared across your recent cycles</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 6, right: -8, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e4ebe9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8a9895' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="s" domain={[0, 10]} tick={{ fontSize: 10, fill: '#8a9895' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#8a9895' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4ebe9', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="s" dataKey="pain" name="Max pain (0–10)" fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar yAxisId="s" dataKey="fatigue" name="Max fatigue (0–10)" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar yAxisId="p" dataKey="drop" name="Activity drop (%)" fill="#6b7fd7" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 divide-y divide-line text-xs sm:hidden">
                {p.perCycle.map((x) => <li key={x.index} className="py-2">Cycle {fmtDay(x.startDate)}: pain {x.pain}/10, fatigue {x.fatigue}/10{x.activityDropPct != null ? `, activity −${Math.max(0, x.activityDropPct)}%` : ''}{x.sleepHours != null ? `, sleep ${x.sleepHours} h` : ''}</li>)}
              </ul>
            </>
          )}
        </Card>
      </Section>

      {/* Cycle-aware baseline */}
      <Section tone="teal" className="!p-2 sm:!p-3">
        <Card eyebrow="Personal baseline" title="Cycle-aware baseline">
          {contexts.length ? (
            <ul className="divide-y divide-line">
              {contexts.map(({ metric, inP, out }) => (
                <li key={metric} className="grid grid-cols-1 gap-1 py-3 text-sm sm:grid-cols-[1.2fr_1fr_1fr]">
                  <span className="font-medium">{METRIC[metric] || metric}</span>
                  <span className="text-ink-soft">Days 1–3: {inP ? <><b className="text-ink">{inP.range.lo}–{inP.range.hi}</b> <span className="text-[11px] text-ink-mute">({Math.round(inP.confidence * 100)}% · {inP.cyclesUsed} cycles)</span></> : <span className="text-ink-mute">not enough data</span>}</span>
                  <span className="text-ink-soft">Outside period: {out ? <><b className="text-ink">{out.range.lo}–{out.range.hi}</b> <span className="text-[11px] text-ink-mute">({Math.round(out.confidence * 100)}%)</span></> : <span className="text-ink-mute">not enough data</span>}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Cycle-specific baselines appear once at least two cycles with monitoring data are recorded. Until then your general baseline is used.</p>
          )}
          <p className="mt-3 text-[11px] text-ink-mute">Every body is different: changes during your cycle are compared with <i>your</i> usual pattern for that part of the cycle, not with a universal threshold.</p>
        </Card>
      </Section>

      <Section tone="slate">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card
          eyebrow="History" title="Your cycle history"
          action={<button onClick={() => setAddPrev((v) => !v)} className="flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-xs text-ink-soft hover:bg-canvas"><Plus size={13} /> Add Previous Cycle</button>}
        >
          {addPrev && <div className="mb-3"><AddPreviousCycle maxDate={new Date().toISOString().slice(0, 10)} onAdded={() => { setAddPrev(false); changed(); }} onCancel={() => setAddPrev(false)} /></div>}
          <p className="mb-2 text-[11px] text-ink-mute">Edit cycle history: use the pencil to correct a start or end date. Lengths, your baseline and estimates are recalculated automatically.</p>
            {data.cycles.length ? <ul className="-mx-4 divide-y divide-line sm:-mx-6">{data.cycles.map((x) => <CycleRow key={x.id} c={x} onChanged={changed} />)}</ul>
              : <p className="text-sm text-ink-soft">No cycles recorded yet.</p>}
          </Card>

          <Card eyebrow="Entries" title="Cycle symptoms (90 days)">
            {data.symptoms.length ? (
              <ul className="-mx-4 max-h-96 divide-y divide-line overflow-y-auto sm:-mx-6">
                {data.symptoms.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.symptom === 'custom' ? s.label : SYM[s.symptom] || s.symptom}{s.severity != null && <span className="font-normal text-ink-soft"> · {s.severity}/10</span>}{s.flow && <span className="font-normal text-ink-soft"> · {s.flow}</span>}{s.activityImpact && <span className="font-normal text-ink-soft"> · {s.activityImpact}</span>}</p>
                      <p className="text-[11px] text-ink-mute">{new Date(s.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                    <Provenance source={s.source} />
                    <button onClick={async () => { await deleteCycleSymptom(s.id); changed(); }} aria-label="Delete entry" className="rounded-lg p-1.5 text-ink-mute hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">No cycle symptoms recorded.</p>}
          </Card>
        </div>
      </Section>

      <section className="card flex flex-wrap items-start gap-3 p-5 text-xs text-ink-soft">
        <Lock size={15} className="mt-0.5 shrink-0" />
        <p className="min-w-0 flex-1">Menstrual information is sensitive. It is used only to interpret your own readings, is never shared, and you can edit or delete any entry. To stop tracking or delete all cycle data, go to <Link to="/settings" className="text-brand-700 underline">Settings → Health tracking</Link>.</p>
        <p className="flex w-full gap-1.5 text-[11px] text-ink-mute"><ShieldCheck size={13} className="mt-0.5 shrink-0" /> {SAFETY} HealthSense identifies symptom patterns and provides triage support; it does not diagnose endometriosis or any other condition.</p>
      </section>

      <CycleSetupModal open={setup} initial={data.settings} onClose={() => setSetup(false)} onDone={() => { setSetup(false); changed(); }} />
      <CycleLogModal open={log} onClose={() => setLog(false)} onSaved={changed} periodOngoing={c.period?.status === 'on_period'} />
    </div>
  );
}
