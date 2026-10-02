import { useEffect, useState } from 'react';
import { Lock, ArrowLeft, ArrowRight, Plus, X, CheckCircle2 } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { Chips, inputCls } from '../input/fields.jsx';
import { saveCycleSettings } from '../../services/cycleApi.js';

export const PRIVACY = 'Cycle information is sensitive health data. It is stored with your HealthSense account, used only to interpret your own readings, never shared, and you can edit or delete it — or stop tracking — at any time.';
export const SAFETY = 'Cycle information is based on user-reported history and system estimates. It is intended for personalized health tracking and should not be treated as a medical diagnosis.';

const REG = [
  { label: 'Usually regular', value: 'regular' }, { label: 'Sometimes irregular', value: 'somewhat_irregular' },
  { label: 'Usually irregular', value: 'very_irregular' }, { label: 'Not sure', value: 'unsure' },
];
const SYMPTOMS = ['Pain/cramps', 'Fatigue', 'Sleep disturbance', 'Headache', 'Bloating', 'Mood changes', 'Reduced activity', 'Other'];
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = {
  lastStart: '', lastEnd: '', endUnknown: false,
  knowsPrevious: null, previous: [''],
  length: '', lengthUnknown: false,
  duration: '', durationUnknown: false,
  regularity: null,
  symptoms: {},
};

function Step({ title, hint, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const Check = ({ checked, onChange, children }) => (
  <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}</label>
);

// "Understand Your Cycle" — progressive, one question per step. Nothing is required except the most recent
// period start (needed for any estimate); unknown answers are stored as unknown, never filled in.
export default function CycleSetupModal({ open, onClose, onDone, initial }) {
  const [f, setF] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep(0); setError(''); setResult(null);
    setF({
      ...EMPTY,
      length: initial?.avgLengthDays && !initial?.lengthUnknown ? String(initial.avgLengthDays) : '',
      lengthUnknown: !!initial?.lengthUnknown,
      duration: initial?.typicalPeriodLength ? String(initial.typicalPeriodLength) : '',
      regularity: initial?.regularity || null,
    });
    // Reset only when the dialog opens — not when the parent re-renders with a new settings object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const steps = ['recent', 'end', 'previous', 'length', 'duration', 'regularity', 'symptoms'];
  const cur = steps[step];

  const validate = () => {
    if (cur === 'recent' && f.lastStart && f.lastStart > today()) return 'The start date cannot be in the future.';
    if (cur === 'end' && f.lastEnd && !f.endUnknown) {
      if (f.lastEnd < f.lastStart) return 'The end date cannot be before the start date.';
      if (f.lastEnd > today()) return 'The end date cannot be in the future.';
    }
    if (cur === 'previous' && f.knowsPrevious) {
      const ds = f.previous.filter(Boolean);
      if (ds.some((d) => d >= f.lastStart)) return 'Previous period starts must be before your most recent period.';
      if (new Set(ds).size !== ds.length) return 'The same date was entered twice.';
    }
    if (cur === 'length' && !f.lengthUnknown && f.length && (Number(f.length) < 15 || Number(f.length) > 90)) return 'Please enter a cycle length between 15 and 90 days, or choose "I don\'t know".';
    if (cur === 'duration' && !f.durationUnknown && f.duration && (Number(f.duration) < 1 || Number(f.duration) > 15)) return 'Please enter between 1 and 15 days, or choose "I don\'t know".';
    return '';
  };

  const next = () => {
    const e = validate();
    if (e) return setError(e);
    setError('');
    // Without a most recent period there is nothing to estimate from — skip the date-dependent steps
    if (cur === 'recent' && !f.lastStart) return setStep(steps.indexOf('length'));
    return setStep((s) => s + 1);
  };
  const back = () => { setError(''); setStep((s) => (cur === 'length' && !f.lastStart ? 0 : Math.max(0, s - 1))); };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await saveCycleSettings({
        tracking: true,
        lastPeriodStart: f.lastStart || undefined,
        lastPeriodEnd: f.lastStart && f.lastEnd && !f.endUnknown ? f.lastEnd : null,
        previousStarts: f.knowsPrevious ? f.previous.filter(Boolean) : [],
        previousUnknown: f.knowsPrevious === false,
        lengthUnknown: f.lengthUnknown || !f.length,
        avgLengthDays: f.lengthUnknown || !f.length ? null : Number(f.length),
        typicalPeriodLength: f.durationUnknown || !f.duration ? null : Number(f.duration),
        regularity: f.regularity || 'unsure',
        reportedSymptoms: Object.entries(f.symptoms).map(([symptom, v]) => ({ symptom, present: v.present, severity: v.severity })),
      });
      setResult(res.context || {});
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save. Setting up cycle tracking needs a connection.');
    } finally {
      setBusy(false);
    }
  };

  const last = step === steps.length - 1;
  const footer = result ? (
    <button onClick={() => { onDone?.(); }} className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white">Done</button>
  ) : (
    <div className="flex w-full items-center justify-between gap-2">
      <button onClick={step === 0 ? onClose : back} className="flex items-center gap-1 rounded-xl border border-line px-4 py-2.5 text-xs text-ink-soft hover:bg-canvas">
        {step === 0 ? 'Cancel' : <><ArrowLeft size={13} /> Back</>}
      </button>
      <span className="text-[11px] text-ink-mute">Step {step + 1} of {steps.length}</span>
      {last
        ? <button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white disabled:opacity-60">{busy ? 'Saving…' : 'Finish'}</button>
        : <button onClick={next} className="flex items-center gap-1 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white">Next <ArrowRight size={13} /></button>}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} eyebrow="Understand your cycle" title={result ? 'Cycle tracking is set up' : 'A few details about your previous cycles'} footer={footer}>
      {!result && <div className="mb-5 h-1 rounded-full bg-line"><div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>}

      {result ? (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-brand-700"><CheckCircle2 size={18} /> Your cycle history was saved as reported information.</p>
          {result.cycleDay ? (
            <p className="rounded-xl bg-canvas px-3 py-2.5">Current cycle estimated as <b>Day {result.cycleDay}</b> · {Math.round((result.confidence || 0) * 100)}% confidence <span className="text-ink-mute">(system estimate)</span></p>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-amber-900">Cycle estimation is unavailable until your most recent period start is known. You can add it any time on the Cycle &amp; Health page.</p>
          )}
          <p className="text-xs text-ink-mute">Every new period you report improves HealthSense's understanding of your cycle.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {cur === 'recent' && (
            <Step title="When did your most recent period start?" hint="Needed to estimate your current cycle. HealthSense never guesses this date.">
              <input type="date" max={today()} className={`${inputCls} sm:w-60`} value={f.lastStart} onChange={set('lastStart')} />
              <p className="text-xs text-ink-mute">Leave it empty if you don't know — cycle estimation will stay unavailable until you add it.</p>
            </Step>
          )}
          {cur === 'end' && (
            <Step title="When did your most recent period end?">
              <input type="date" min={f.lastStart} max={today()} disabled={f.endUnknown} className={`${inputCls} sm:w-60`} value={f.lastEnd} onChange={set('lastEnd')} />
              <Check checked={f.endUnknown} onChange={(v) => setF((x) => ({ ...x, endUnknown: v, lastEnd: v ? '' : x.lastEnd }))}>I don't remember / it hasn't ended yet</Check>
            </Step>
          )}
          {cur === 'previous' && (
            <Step title="Do you know when the period before that started?" hint="Previous starts let HealthSense learn your own cycle length. Up to 3 is plenty — one is fine.">
              <Chips options={[{ label: 'Yes', value: true }, { label: "No / I don't remember", value: false }]} value={f.knowsPrevious} onChange={(v) => setF((x) => ({ ...x, knowsPrevious: v }))} />
              {f.knowsPrevious && (
                <div className="space-y-2">
                  {f.previous.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs text-ink-soft">{i === 0 ? 'Previous start' : `Earlier start ${i}`}</span>
                      <input type="date" max={f.lastStart || today()} className={`${inputCls} sm:w-56`} value={d} onChange={(e) => setF((x) => ({ ...x, previous: x.previous.map((p, j) => (j === i ? e.target.value : p)) }))} />
                      {i > 0 && <button onClick={() => setF((x) => ({ ...x, previous: x.previous.filter((_, j) => j !== i) }))} aria-label="Remove" className="rounded-lg p-1.5 text-ink-mute hover:bg-canvas"><X size={14} /></button>}
                    </div>
                  ))}
                  {f.previous.length < 3 && f.previous[f.previous.length - 1] && (
                    <button onClick={() => setF((x) => ({ ...x, previous: [...x.previous, ''] }))} className="flex items-center gap-1 text-xs font-medium text-brand-700"><Plus size={13} /> Add an earlier period</button>
                  )}
                </div>
              )}
            </Step>
          )}
          {cur === 'length' && (
            <Step title="How long is your menstrual cycle usually?" hint="From the first day of one period to the first day of the next (usually 21–40 days).">
              <div className="flex items-center gap-3">
                <input type="number" min="15" max="90" disabled={f.lengthUnknown} placeholder="e.g. 29" className={`${inputCls} w-28`} value={f.length} onChange={set('length')} />
                <span className="text-xs text-ink-mute">days</span>
              </div>
              <Chips options={[21, 25, 28, 30, 35].map((n) => ({ label: `${n}`, value: String(n) }))} value={f.lengthUnknown ? null : f.length} onChange={(v) => setF((x) => ({ ...x, length: v || '', lengthUnknown: false }))} />
              <Check checked={f.lengthUnknown} onChange={(v) => setF((x) => ({ ...x, lengthUnknown: v, length: v ? '' : x.length }))}>I don't know</Check>
            </Step>
          )}
          {cur === 'duration' && (
            <Step title="How many days does your period usually last?" hint="Usually 2–10 days. Helps HealthSense tell whether a period is likely ongoing.">
              <div className="flex items-center gap-3">
                <input type="number" min="1" max="15" disabled={f.durationUnknown} placeholder="e.g. 5" className={`${inputCls} w-28`} value={f.duration} onChange={set('duration')} />
                <span className="text-xs text-ink-mute">days</span>
              </div>
              <Check checked={f.durationUnknown} onChange={(v) => setF((x) => ({ ...x, durationUnknown: v, duration: v ? '' : x.duration }))}>I don't know</Check>
            </Step>
          )}
          {cur === 'regularity' && (
            <Step title="How regular are your cycles?" hint="Just your own impression — irregular cycles are common and not a diagnosis.">
              <Chips options={REG} value={f.regularity} onChange={set('regularity')} />
            </Step>
          )}
          {cur === 'symptoms' && (
            <Step title="During previous cycles, did you experience any of these?" hint="Optional — skip anything you're unsure about.">
              <ul className="space-y-2">
                {SYMPTOMS.map((sym) => {
                  const v = f.symptoms[sym] || {};
                  const setV = (patch) => setF((x) => ({ ...x, symptoms: { ...x.symptoms, [sym]: { ...v, ...patch } } }));
                  return (
                    <li key={sym} className="rounded-xl border border-line px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">{sym}</span>
                        <Chips options={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'Not sure', value: 'not_sure' }]} value={v.present || null} onChange={(p) => setV({ present: p })} />
                      </div>
                      {v.present === 'yes' && (
                        <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">Severity
                          <input type="range" min="1" max="10" value={v.severity || 5} onChange={(e) => setV({ severity: Number(e.target.value) })} className="flex-1 accent-rose-500" />
                          <b className="w-8 text-right">{v.severity || 5}/10</b>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Step>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          {step === 0 && <p className="flex gap-2 rounded-xl bg-canvas px-3 py-2.5 text-[11px] leading-relaxed text-ink-soft"><Lock size={13} className="mt-0.5 shrink-0" /> {PRIVACY}</p>}
        </div>
      )}
    </Modal>
  );
}
