import { useState } from 'react';
import { MessageCircleQuestion, Moon, Activity, Database, CheckCircle2, Info } from 'lucide-react';
import { Chips, Slider, inputCls } from '../input/fields.jsx';
import { answerQuestion, dismissQuestion } from '../../services/inputService.js';

const MODULE = {
  sleepRisk: { icon: Moon, label: 'Sleep monitoring', cls: 'bg-indigo-50 text-indigo-600' },
  endoSymptoms: { icon: Activity, label: 'Symptom pattern', cls: 'bg-red-50 text-red-500' },
  missing: { icon: Database, label: 'Missing data', cls: 'bg-amber-50 text-amber-600' },
};

// One adaptive question from the closed-loop engine (spec §28 step 5).
export default function QuestionCard({ question: q, onDone, compact = false }) {
  const [value, setValue] = useState(q.kind === 'number' ? (q.suggested ?? '') : q.kind === 'scale' ? 5 : null);
  const [state, setState] = useState('idle');
  const [why, setWhy] = useState(!compact);
  const m = MODULE[q.module] || { icon: MessageCircleQuestion, label: 'Question', cls: 'bg-brand-50 text-brand-600' };

  const submit = async (answer) => {
    setState('saving');
    try {
      await answerQuestion(q.id, answer);
      setState('done');
      setTimeout(() => onDone?.(), 900);
    } catch {
      setState('error');
    }
  };
  const skip = async () => {
    await dismissQuestion(q.id).catch(() => {});
    onDone?.();
  };

  if (state === 'done') {
    return (
      <div className="card flex items-center gap-3 p-5 text-sm text-brand-700">
        <CheckCircle2 size={18} /> Thanks — your answer is being used to update your assessment.
      </div>
    );
  }

  const busy = state === 'saving';
  return (
    <section className="card border-brand-100 p-5">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.cls}`}><m.icon size={17} /></span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{m.label} · Question for you</p>
          <p className="mt-1.5 text-[15px] font-medium leading-snug">{q.text}</p>
          {q.reason && (
            why
              ? <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-ink-soft"><Info size={13} className="mt-0.5 shrink-0" /> {q.reason}</p>
              : <button onClick={() => setWhy(true)} className="mt-1.5 text-xs text-brand-700 hover:underline">Why am I asked this?</button>
          )}
        </div>
      </div>

      <div className="mt-4 pl-12">
        {q.kind === 'yesno' && (
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => submit(true)} className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">Yes</button>
            <button disabled={busy} onClick={() => submit(false)} className="rounded-xl border border-line bg-white px-5 py-2 text-xs font-medium hover:bg-canvas disabled:opacity-60">No</button>
          </div>
        )}
        {q.kind === 'choice' && (
          <div className="space-y-3">
            <Chips options={q.options || []} value={value} onChange={setValue} />
            <button disabled={busy || !value} onClick={() => submit(value)} className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Submit</button>
          </div>
        )}
        {q.kind === 'scale' && (
          <div className="space-y-3">
            <Slider value={value} onChange={setValue} min={q.min ?? 0} max={q.max ?? 10} low="Not at all" high="Extremely" />
            <button disabled={busy} onClick={() => submit(value)} className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">Submit</button>
          </div>
        )}
        {q.kind === 'number' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number" min={q.min} max={q.max} step={q.step || 1} value={value}
              onChange={(e) => setValue(e.target.value)} className={`${inputCls} w-28`}
            />
            {q.unit && <span className="text-xs text-ink-mute">{q.unit}</span>}
            <button disabled={busy || value === ''} onClick={() => submit(Number(value))} className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Submit</button>
          </div>
        )}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-mute">
          <button onClick={skip} className="hover:text-ink">Skip</button>
          {state === 'error' && <span className="text-red-600">Could not save — try again.</span>}
        </div>
      </div>
    </section>
  );
}
