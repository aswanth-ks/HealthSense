import { Moon, Activity } from 'lucide-react';

const META = {
  sleepRisk: { icon: Moon, tint: 'bg-indigo-50 text-indigo-600', bar: 'bg-indigo-500', inputs: 'Respiration · SpO₂ · Heart rate · Movement · Sleep', idle: 'No repeated night-time breathing or oxygen pattern detected.' },
  endoSymptoms: { icon: Activity, tint: 'bg-red-50 text-red-500', bar: 'bg-red-400', inputs: 'Pain / cramps · Activity · Sleep · Fatigue · Cycle', idle: 'No recurring strong pain pattern. Log pain or cramps with the daily check-in so patterns can be detected.' },
};

// One demonstration module (spec §27-G). Shows its evidence; never presented as a diagnosis.
export default function ModuleCard({ module: m }) {
  const meta = META[m.module] || META.sleepRisk;
  const Icon = meta.icon;
  return (
    <section className="card flex flex-col p-6">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.tint}`}><Icon size={18} /></span>
        <div className="min-w-[160px] flex-1">
          <p className="eyebrow">Risk module</p>
          <h3 className="mt-1 text-base font-medium">{m.title}</h3>
          <p className="mt-0.5 text-[11px] text-ink-mute">{meta.inputs}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] ${m.active ? 'bg-amber-50 text-amber-700' : 'bg-canvas text-ink-soft'}`}>{m.active ? 'Pattern detected' : 'No pattern'}</span>
      </div>

      <div className="mt-5 flex items-center gap-3 text-xs">
        <span className="w-24 text-ink-mute">Evidence score</span>
        <div className="h-1.5 flex-1 rounded-full bg-line"><div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${m.score}%` }} /></div>
        <span className="w-8 text-right font-medium">{m.score}</span>
      </div>
      {m.confidence > 0 && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className="w-24 text-ink-mute">Confidence</span>
          <div className="h-1.5 flex-1 rounded-full bg-line"><div className="h-full rounded-full bg-brand-500" style={{ width: `${m.confidence * 100}%` }} /></div>
          <span className="w-8 text-right font-medium">{Math.round(m.confidence * 100)}%</span>
        </div>
      )}

      <div className="mt-5 flex-1 rounded-xl bg-canvas px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-mute">Evidence</p>
        {m.evidence?.length
          ? <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">{m.evidence.map((e) => <li key={e.text}>• {e.text}</li>)}</ul>
          : <p className="mt-1.5 text-sm text-ink-soft">{meta.idle}</p>}
      </div>
    </section>
  );
}
