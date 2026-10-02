import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ArrowDown, ShieldCheck, Moon, Activity, HeartPulse, Droplets, Wind, Thermometer, Repeat, Eye, Lightbulb,
  HelpCircle, ChevronDown, Target, CalendarHeart, ClipboardCheck, Stethoscope, Database, RefreshCw, Info, CircleDot,
} from 'lucide-react';
import Section, { StepNav } from '../components/common/Section.jsx';
import ConnectionUnavailable from '../components/common/ConnectionUnavailable.jsx';
import QuestionCard from '../components/questions/QuestionCard.jsx';
import EvidenceModal, { ProvenancePill } from '../components/assessment/EvidenceModal.jsx';
import { LEVEL_STYLE, TriageScale } from '../components/triage/TriageBadge.jsx';
import useAssessment from '../hooks/useAssessment.js';
import { useInput } from '../context/InputContext.jsx';

const DOT = { LOW: '🟢', MONITOR: '🟡', MODERATE: '🟠', HIGH: '🔴' };
const METRIC_ICON = { sleep_duration: Moon, activity: Activity, resting_hr: HeartPulse, spo2: Droplets, respiration: Wind, temperature: Thermometer };
const CAT_BORDER = { sleep: 'border-l-indigo-500', fatigue: 'border-l-amber-500', activity: 'border-l-sky-500', physiology: 'border-l-red-400', symptoms: 'border-l-rose-500', cycle: 'border-l-rose-400' };
const CAT_CHIP = { sleep: 'bg-indigo-50 text-indigo-700', fatigue: 'bg-amber-50 text-amber-700', activity: 'bg-sky-50 text-sky-700', physiology: 'bg-red-50 text-red-600', symptoms: 'bg-rose-50 text-rose-600', cycle: 'bg-rose-50 text-rose-600' };
const CAT_ICON = { sleep: Moon, fatigue: Activity, activity: Activity, physiology: HeartPulse, symptoms: Activity, cycle: CalendarHeart };
const ITEM_DOT = { sleep: 'bg-indigo-400', night: 'bg-indigo-600', spo2: 'bg-brand-500', symptom: 'bg-blue-500', activity: 'bg-amber-500', pattern: 'bg-red-400', question: 'bg-violet-500', answer: 'bg-blue-600', triage: 'bg-red-500', priority: 'bg-indigo-500' };
const SAFETY = 'HealthSense provides personalized health-pattern analysis and triage support. It does not diagnose medical conditions or replace professional medical evaluation.';

const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;
const fmtRange = (s, e) => {
  const o = { month: 'long', day: 'numeric' };
  const a = new Date(s);
  const b = new Date(e);
  return `${a.toLocaleDateString('en-US', o)} – ${b.toLocaleDateString('en-US', { ...o, year: 'numeric' })}`;
};
const hm = (h) => { if (h == null) return '—'; const H = Math.floor(Math.abs(h)); const M = Math.round((Math.abs(h) - H) * 60); return `${H}h ${M}m`; };
const val = (v, unit) => (v == null ? '—' : unit === 'hours' ? hm(v) : unit === 'steps' ? Math.round(v).toLocaleString('en-US') : `${v}${unit === '%' ? '%' : ` ${unit}`}`);
function change(r) {
  if (r.deviation == null) return '—';
  if (r.direction === 'stable') return 'No meaningful change';
  const arrow = r.deviation > 0 ? '↑' : '↓';
  if (r.unit === 'hours') return `${arrow} ${hm(r.deviation)}`;
  if (r.unit === 'steps') return `${arrow} ${Math.abs(Math.round(r.deviation_percent))}%`;
  return `${arrow} ${Math.abs(r.deviation)} ${r.unit === '%' ? '%' : r.unit}`;
}
const STATUS = {
  changed: { text: 'Changed', cls: 'bg-amber-50 text-amber-800' },
  slight_change: { text: 'Slight change', cls: 'bg-amber-50/60 text-amber-700' },
  typical: { text: 'Typical for you', cls: 'bg-brand-50 text-brand-700' },
  baseline_developing: { text: 'Baseline developing', cls: 'bg-canvas text-ink-soft' },
  no_data: { text: 'No data', cls: 'bg-canvas text-ink-mute' },
};

const STEPS = [
  ['happened', 'What happened'], ['changed', 'What changed'], ['patterns', 'Patterns'], ['matters', 'Why it matters'],
  ['todo', 'What to do'], ['evaluation', 'Evaluation'], ['next', 'Next 24h'], ['questions', 'Questions'], ['quality', 'Data quality'],
];

function Collapsible({ title, children, defaultOpen = false, icon: Icon = Info }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <Icon size={17} className="text-brand-700" />
        <span className="flex-1 font-medium">{title}</span>
        <ChevronDown size={18} className={`text-ink-mute transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-line px-5 py-4">{children}</div>}
    </div>
  );
}

// 3-Day AI Health Assessment — a structured, evidence-backed story of the last 72 hours.
export default function ThreeDayAssessment() {
  const { data: a, error, loading, reload } = useAssessment();
  const { openCheckin } = useInput();
  const [evidence, setEvidence] = useState(null);
  const [proOpen, setProOpen] = useState(false);

  const back = (
    <div className="sticky top-[57px] z-10 -mx-4 mb-4 bg-canvas/90 px-4 py-2 backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
      <Link to="/insights" className="inline-flex items-center gap-1.5 rounded-xl py-1.5 text-sm text-brand-700 hover:underline"><ArrowLeft size={16} /> Back to AI Insights</Link>
    </div>
  );

  if (loading && !a) return <div>{back}<p className="text-sm text-ink-soft">Analysing your last 3 days…</p></div>;
  if (error && !a) return <div>{back}<ConnectionUnavailable onRetry={() => reload()} /></div>;
  if (!a) return null;

  const s = LEVEL_STYLE[a.triage_level] || LEVEL_STYLE.LOW;
  const n = a.narrative;
  const openQs = a.adaptive_questions || [];
  const pe = a.professional_evaluation;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {back}

      {/* Header */}
      <header>
        <p className="eyebrow">AI Insights · 3-day assessment{a.sample && ' · sample data'}</p>
        <h1 className="mt-2 text-3xl font-medium sm:text-4xl">3-Day AI Health Assessment</h1>
        <p className="mt-2 text-ink-soft">Personalized assessment based on your recent health data</p>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="card px-4 py-3"><p className="text-[11px] text-ink-mute">Assessment period</p><p className="mt-0.5 text-sm font-medium">{fmtRange(a.period.start_at, a.period.end_at)}</p></div>
          <div className="card px-4 py-3"><p className="text-[11px] text-ink-mute">Data completeness</p><p className="mt-0.5 text-2xl font-medium text-brand-700">{pct(a.data_quality.completeness)}</p></div>
          <div className="card px-4 py-3"><p className="text-[11px] text-ink-mute">Assessment confidence</p><p className="mt-0.5 text-2xl font-medium text-brand-700">{pct(a.confidence)}</p></div>
        </div>
      </header>

      {a.sufficient && <StepNav steps={a.cycle_context?.enabled ? [...STEPS.slice(0, 4), ['cycle', 'Cycle'], ...STEPS.slice(4)] : STEPS} />}

      {!a.sufficient ? (
        <section className="card p-6 text-center">
          <Database className="mx-auto text-amber-600" size={28} />
          <h2 className="mt-3 text-lg font-medium">Insufficient data for a reliable 3-day assessment.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{n?.summary || 'Keep wearing your watch and complete your daily check-ins. The assessment appears once at least two of the last three days have enough data.'}</p>
          <button onClick={() => openCheckin()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-medium text-white"><ClipboardCheck size={14} /> Add a daily check-in</button>
        </section>
      ) : (
        <>
          {/* Hero */}
          <section className="card overflow-hidden" style={{ borderColor: `${s.ring}40` }}>
            <div className="p-5 sm:p-7" style={{ background: `linear-gradient(135deg, ${s.ring}14, transparent 65%)` }}>
              <p className="eyebrow">Current assessment</p>
              <p className={`mt-2 text-2xl font-semibold tracking-tight sm:text-3xl ${s.text}`}>{DOT[a.triage_level]} {(n?.headline || a.triage_level).toUpperCase()}</p>
              {n ? <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink">{n.summary}</p>
                : <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-ink-soft">AI narrative temporarily unavailable. The structured assessment below is complete.</p>}
              <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_1.4fr]">
                <div>
                  <p className="text-xs text-ink-mute">Current triage</p>
                  <p className={`mt-1 text-xl font-semibold ${s.text}`}>{a.triage_level}</p>
                  <div className="mt-3 max-w-xs"><TriageScale level={a.triage_level} /></div>
                  <p className="mt-2 text-[11px] text-ink-mute">Prototype triage levels — not medically validated severity grades.</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Why?</p>
                  <ul className="mt-2 space-y-2">
                    {a.why.map((w) => (
                      <li key={w.factor} className="text-sm"><span className="font-medium">{w.factor}:</span> <span className="text-ink-soft">{w.value}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* What happened */}
          <Section id="happened" n={1} tone="indigo" icon={CircleDot} eyebrow="The story" title="What happened over the last 3 days?" subtitle="Events recorded day by day — nothing is added that wasn't measured or reported.">
            <ol className="grid gap-4 md:grid-cols-3">
              {a.day_events.map((d) => (
                <li key={d.day} className="card overflow-hidden">
                  <div className="flex items-center justify-between bg-indigo-600 px-4 py-2.5 text-white">
                    <p className="text-sm font-semibold">Day {d.day} <span className="font-normal text-indigo-100">· {d.label}</span></p>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{d.items.length} event{d.items.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="p-4">
                  {d.items.length ? (
                    <ul className="space-y-0">
                      {d.items.map((it, i) => (
                        <li key={i} className="relative pb-3 pl-5 last:pb-0">
                          {i < d.items.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-line" />}
                          <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${ITEM_DOT[it.kind] || 'bg-ink-mute'}`} />
                          <p className="text-sm font-medium leading-snug">{it.title}</p>
                          {it.detail && <p className="text-xs text-ink-soft">{it.detail}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-ink-mute">No data available</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* What changed */}
          <Section id="changed" n={2} tone="teal" icon={Repeat} eyebrow="Your normal vs now" title="What changed from my baseline?" subtitle="Compared with your own learned normal, not a generic threshold.">
            {a.baseline_status === 'developing' && (
              <p className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><b>Baseline still developing.</b> HealthSense needs a few complete days to learn your normal, so these comparisons are less reliable.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {a.baseline_comparison.map((r) => {
                const Icon = METRIC_ICON[r.metric] || Activity;
                const st = STATUS[r.status] || STATUS.typical;
                return (
                  <div key={r.metric} className={`card border-t-4 p-4 ${r.status === 'changed' ? '!border-t-amber-500' : r.status === 'slight_change' ? '!border-t-amber-300' : r.status === 'typical' ? '!border-t-brand-500' : '!border-t-line'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-medium"><span className="grid h-7 w-7 place-items-center rounded-lg bg-canvas text-ink-soft"><Icon size={14} /></span> {r.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.text}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div><p className="text-[10px] text-ink-mute">Your baseline</p><p className="text-sm font-medium">{r.baseline != null ? val(r.baseline, r.unit) : '—'}</p></div>
                      <div><p className="text-[10px] text-ink-mute">Last 3 days</p><p className="text-sm font-medium">{val(r.recent, r.unit)}</p></div>
                    </div>
                    <p className={`mt-3 inline-flex rounded-lg px-2.5 py-1 text-sm font-medium ${r.status === 'changed' || r.status === 'slight_change' ? 'bg-amber-50 text-amber-800' : r.status === 'typical' ? 'bg-brand-50 text-brand-800' : 'bg-canvas text-ink-soft'}`}>{r.status === 'no_data' ? 'No data available' : r.status === 'baseline_developing' ? 'Comparison not yet reliable' : change(r)}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-ink-mute">Every body is different. HealthSense learns your baseline before interpreting change.</p>
          </Section>

          {/* Patterns */}
          <Section id="patterns" n={3} tone="amber" icon={Repeat} eyebrow="Repeated signals" title="Patterns detected" subtitle="Changes that repeated or appeared together.">
            {a.patterns.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {a.patterns.map((p) => {
                  const Icon = CAT_ICON[p.category] || Activity;
                  return (
                    <div key={p.pattern_id} className={`card flex flex-col border-l-4 p-5 ${CAT_BORDER[p.category] || 'border-l-amber-400'}`}>
                      <p className="flex items-center justify-between gap-2">
                        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${CAT_CHIP[p.category] || 'bg-amber-50 text-amber-700'}`}><Icon size={12} /> {p.category}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.status === 'repeated' ? 'bg-red-50 text-red-600' : 'bg-canvas text-ink-soft'}`}>{p.status === 'repeated' ? 'Repeated' : 'Observed once'}</span>
                      </p>
                      <p className="mt-3 text-base font-semibold leading-snug">{p.name}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><dt className="text-[10px] text-ink-mute">{p.change_percent != null ? 'Change' : 'Observed'}</dt><dd className="font-medium">{p.change_percent != null ? `${p.change_percent}%` : p.recurrence.cycles_observed ? `${p.recurrence.cycles_observed} cycles` : `${p.recurrence.days_observed} of ${p.recurrence.total_days} days`}</dd></div>
                        <div><dt className="text-[10px] text-ink-mute">Confidence</dt><dd className="font-medium">{pct(p.confidence)}</dd></div>
                      </dl>
                      <div className="mt-2 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-amber-500" style={{ width: pct(p.confidence) }} /></div>
                      {n?.pattern_descriptions?.[p.pattern_id] && <p className="mt-2 text-xs text-ink-soft">{n.pattern_descriptions[p.pattern_id]}</p>}
                      <button onClick={() => setEvidence({ pattern: p })} className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">View evidence <ArrowRight size={14} /></button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="card p-5 text-sm text-ink-soft">No repeated pattern was found in the last 3 days.</p>}
          </Section>

          {/* Why it matters */}
          <Section id="matters" n={4} tone="violet" icon={Lightbulb} eyebrow="Meaning" title="Why this matters">
            <p className="card mb-3 p-5 text-sm leading-relaxed text-ink">{n?.why_it_matters || 'Repeated changes are more informative than a single reading, but the available data cannot determine the underlying medical cause.'}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {[['Observed', 'What was measured or recorded', a.observed, Eye, 'text-brand-800', 'bg-brand-100'], ['Interpreted', 'Patterns HealthSense detected', a.interpreted, Lightbulb, 'text-amber-800', 'bg-amber-100'], ['Unknown', 'What cannot be determined', a.unknown, HelpCircle, 'text-slate-700', 'bg-slate-200']].map(([t, sub, items, Icon, cls, head]) => (
                <div key={t} className="card overflow-hidden">
                  <p className={`flex items-center gap-2 px-4 py-2.5 font-semibold ${cls} ${head}`}><Icon size={15} /> {t}</p>
                  <div className="p-4 pt-2">
                  <p className="text-[11px] text-ink-mute">{sub}</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-ink-soft">{(items.length ? items : ['Nothing to list']).map((x) => <li key={x}>• {x}</li>)}</ul>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Contributing factors */}
          {a.contributing_factors.length > 0 && (
            <Section tone="slate" icon={Info} eyebrow="Context" title="Possible contributing factors">
              <div className="card p-5">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {a.contributing_factors.map((f) => (
                    <li key={f.factor} className="rounded-xl bg-canvas px-3 py-2.5 text-sm"><span className="font-medium">{f.label}</span><span className="block text-xs text-ink-soft">{f.detail}</span></li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-mute">These observations may be related, but HealthSense cannot determine the underlying cause.</p>
              </div>
            </Section>
          )}

          {/* Cycle context (only when tracking is enabled) */}
          {a.cycle_context?.enabled && (
            <Section id="cycle" tone="rose" icon={CalendarHeart} eyebrow="Menstrual cycle" title="Cycle context">
              <div className="card p-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-canvas px-3 py-2"><p className="text-[10px] text-ink-mute">Current cycle</p><p className="text-sm font-medium">{a.cycle_context.cycle_day ? `Day ${a.cycle_context.cycle_day}` : 'Uncertain'} <span className="rounded bg-amber-50 px-1 text-[10px] font-normal text-amber-700">Estimated</span></p></div>
                  <div className="rounded-xl bg-canvas px-3 py-2"><p className="text-[10px] text-ink-mute">Period status</p><p className="text-sm font-medium">{a.cycle_context.period_label || 'Unknown'}</p></div>
                  <div className="rounded-xl bg-canvas px-3 py-2"><p className="text-[10px] text-ink-mute">Cycle confidence</p><p className="text-sm font-medium">{pct(a.cycle_context.confidence)}</p></div>
                  <div className="rounded-xl bg-canvas px-3 py-2"><p className="text-[10px] text-ink-mute">Phase (estimated)</p><p className="text-sm font-medium capitalize">{a.cycle_context.phase?.label || 'Uncertain'}</p></div>
                </div>
                {a.cycle_context.recent_cycles?.length > 0 && (
                  <ul className="mt-3 divide-y divide-line text-xs">
                    {a.cycle_context.recent_cycles.map((c) => (
                      <li key={c.start} className="flex flex-wrap justify-between gap-2 py-2"><span className="font-medium">Cycle from {new Date(c.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (days 1–3)</span><span className="text-ink-soft">pain {c.pain}/10 · fatigue {c.fatigue}/10{c.activity_drop_percent != null ? ` · activity −${Math.max(0, c.activity_drop_percent)}%` : ''}{c.sleep_hours != null ? ` · sleep ${c.sleep_hours} h` : ''}</span></li>
                    ))}
                  </ul>
                )}
                {a.cycle_context.pattern && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                    <p className="text-sm font-medium text-amber-900">Recurring cycle-associated symptom pattern detected.</p>
                    <p className="mt-1 text-xs text-amber-900/90">{a.cycle_context.pattern.summary}</p>
                    <p className="mt-1 text-[11px] text-amber-900/80">Consider discussing this recurring symptom pattern with a qualified healthcare professional.</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* What should I do now */}
          <section id="todo" className="scroll-mt-28 overflow-hidden rounded-3xl border-2 border-brand-300 bg-white shadow-lg shadow-brand-900/5">
            <div className="bg-gradient-to-br from-brand-50 to-white p-5 sm:p-7">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-700"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-[11px] text-white">5</span> Next step</p>
              <h2 className="mt-1 text-2xl font-medium">What should I do now?</h2>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-ink-mute">Recommended next step</p>
              <p className="mt-1 text-lg font-medium">{a.recommended_actions[0].text}</p>
              <p className="mt-2 text-sm text-ink-soft"><b>Reason:</b> {a.recommended_actions[0].reason}</p>
              {openQs.length ? (
                <a href="#questions" className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Answer Questions <ArrowRight size={16} /></a>
              ) : (
                <Link to="/live" className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Continue Monitoring <ArrowRight size={16} /></Link>
              )}
            </div>
          </section>

          {/* Professional evaluation */}
          <Section id="evaluation" n={6} tone="slate" icon={Stethoscope} eyebrow="Guidance" title="Professional evaluation">
            <div className={`card p-5 ${s.bg}`} style={{ borderColor: `${s.ring}55` }}>
              <p className={`text-lg font-semibold ${s.text}`}>{DOT[pe.level]} {pe.level}</p>
              <p className="mt-1 font-medium">{pe.headline}</p>
              <p className="mt-1 text-sm text-ink-soft">{pe.text}</p>
              <button onClick={() => setProOpen(!proOpen)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                Why was this recommendation made? <ChevronDown size={15} className={proOpen ? 'rotate-180' : ''} />
              </button>
              {proOpen && (
                <div className="mt-3 rounded-xl bg-white/80 p-4 text-sm">
                  <p className="text-ink-soft">{pe.reason}</p>
                  {pe.reasons?.length > 0 && <ul className="mt-2 space-y-1 text-xs text-ink-soft">{pe.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>}
                  {pe.evidence_ids?.length > 0 && <button onClick={() => setEvidence({ target: 'professional_evaluation', title: 'Evidence behind this recommendation' })} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">View the evidence <ArrowRight size={13} /></button>}
                  <p className="mt-3 text-[11px] text-ink-mute">This is not a diagnosis.</p>
                </div>
              )}
            </div>
          </Section>

          {/* Next 24-hour monitoring focus — the closed loop */}
          <Section id="next" n={7} tone="indigo" icon={Target} eyebrow="Closed loop" title="Next 24-hour monitoring focus" subtitle="What HealthSense will look for next — decided by this assessment.">
            <div className="card p-5">
              <div className="mb-5 flex flex-col items-stretch gap-2 text-center text-xs sm:flex-row sm:items-center">
                {['Past 3 days of data', '3-day assessment', 'Next monitoring strategy'].map((x, i, all) => (
                  <div key={x} className="contents">
                    <span className={`flex-1 rounded-xl px-3 py-2 font-medium ${i === 2 ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-800'}`}>{x}</span>
                    {i < all.length - 1 && <><ArrowRight size={16} className="mx-auto hidden text-indigo-400 sm:block" /><ArrowDown size={16} className="mx-auto text-indigo-400 sm:hidden" /></>}
                  </div>
                ))}
              </div>
              {a.next_24h_focus.length ? (
                <>
                  <p className="text-sm text-ink-soft">Based on the last 3 days, HealthSense will prioritise:</p>
                  <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                    {a.next_24h_focus.map((f, i) => (
                      <li key={f.metric} className="flex gap-3 rounded-xl border border-line p-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{i + 1}</span>
                        <div><p className="text-sm font-medium">{f.label}</p><p className="text-xs text-ink-soft"><b>Reason:</b> {f.reason}</p></div>
                      </li>
                    ))}
                  </ol>
                  {a.adaptive_monitoring?.night_sampling_sec && <p className="mt-3 text-xs text-ink-soft">The watch samples every {a.adaptive_monitoring.night_sampling_sec}s at night instead of 5s.</p>}
                  <p className="mt-4 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-900">This monitoring priority was generated from the previous 3-day assessment.</p>
                  {a.adaptive_monitoring?.influenced_by?.length > 0 && <p className="mt-2 text-xs text-ink-mute">Influenced by: {a.adaptive_monitoring.influenced_by.join('; ')}.</p>}
                </>
              ) : <p className="text-sm text-ink-soft">Standard monitoring continues — nothing in the last 3 days needed extra focus.</p>}
            </div>
          </Section>

          {/* Adaptive questions */}
          <Section id="questions" n={8} tone="sky" icon={HelpCircle} eyebrow="Your input" title="Questions HealthSense needs you to answer">
            {openQs.length ? (
              <div className="space-y-3">
                {openQs.map((q) => <QuestionCard key={q.id} question={q} allowUnsure onDone={() => reload()} />)}
                <p className="text-xs text-ink-mute">Your answer is saved as <b>user reported</b> information with a timestamp. The assessment, timeline and next monitoring priority update automatically.</p>
              </div>
            ) : <p className="card p-5 text-sm text-ink-soft">No questions right now. HealthSense only asks when an answer would reduce meaningful uncertainty.</p>}
          </Section>
        </>
      )}

      {/* Data quality */}
      <Section id="quality" n={9} tone="slate" icon={Database} eyebrow="Transparency" title="Data quality & confidence">
        <div className="card p-5">
          <div className="space-y-3">
            {[['measured', 'Measured', 'MEASURED', 'bg-brand-500'], ['user_reported', 'User reported', 'USER_REPORTED', 'bg-blue-500'], ['historical', 'Historical', 'HISTORICAL', 'bg-violet-500'], ['estimated', 'AI estimated', 'AI_ESTIMATED', 'bg-amber-500'], ['imported', 'Imported', 'IMPORTED', 'bg-sky-500']].filter(([k]) => k !== 'imported' || a.data_quality.imported_points > 0).map(([k, l, p, bar]) => (
              <div key={k} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0"><ProvenancePill p={p} /></span>
                <div className="h-2 flex-1 rounded-full bg-line"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, a.data_quality.percentages[k] || 0)}%`, minWidth: a.data_quality.percentages[k] > 0 ? 4 : 0 }} /></div>
                <span className="w-24 text-right text-xs text-ink-soft">{a.data_quality.percentages[k]}% <span className="text-ink-mute">({a.data_quality[`${k}_points`] ?? 0})</span></span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
            <div><p className="text-xs text-ink-mute">Assessment confidence</p><p className="text-2xl font-medium text-brand-700">{pct(a.confidence)}</p></div>
            <p className="max-w-md text-xs text-ink-soft">Confidence reflects the completeness, consistency and reliability of the information available during this assessment period. Estimated information is always labelled.</p>
          </div>
        </div>
      </Section>

      {/* Reasoning */}
      {a.sufficient && (
        <Collapsible title="How HealthSense reached this assessment" icon={Lightbulb}>
          <p className="text-sm font-medium">Main factors</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
            {(n?.reasoning?.length ? n.reasoning : a.why.map((w) => `${w.factor}: ${w.value}`)).map((r) => <li key={r}>{r}</li>)}
          </ol>
          <p className="mt-3 text-[11px] text-ink-mute">An evidence summary produced from your structured data (engine {a.engine_version}). The triage level comes from the HealthSense triage engine, not from the text generator.</p>
        </Collapsible>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <p className="flex max-w-2xl gap-2 text-xs text-ink-mute"><ShieldCheck size={15} className="mt-0.5 shrink-0" /> {SAFETY}</p>
        {!a.sample && <button onClick={() => reload({ force: true })} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink-soft hover:bg-canvas disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Recalculate</button>}
      </div>

      <EvidenceModal open={!!evidence} onClose={() => setEvidence(null)} assessment={a} pattern={evidence?.pattern} target={evidence?.target} title={evidence?.title} />
    </div>
  );
}
