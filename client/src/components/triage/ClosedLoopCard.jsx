import { ArrowRight, History, Lightbulb, Target, Moon, Radio } from 'lucide-react';

const METRIC = { resp: 'Respiration', spo2: 'SpO₂', hr: 'Heart rate', movement: 'Movement', temp: 'Temperature', steps: 'Activity' };
const FOCUS = { sleep: 'Sleep', fatigue: 'Fatigue', pain: 'Pain', cycle: 'Cycle' };
const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');

function Step({ icon: Icon, eyebrow, title, children, tint }) {
  return (
    <div className="flex-1 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tint}`}><Icon size={15} /></span>
        <div className="leading-tight">
          <p className="text-[10px] font-medium uppercase tracking-wider text-ink-mute">{eyebrow}</p>
          <p className="text-sm font-medium">{title}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-ink-soft">{children}</div>
    </div>
  );
}

const Arrow = () => <ArrowRight size={18} className="mx-auto shrink-0 rotate-90 text-ink-mute lg:rotate-0" />;

// Previous cycle → learning → next-cycle monitoring priority (spec §28 step 8: the core innovation).
export default function ClosedLoopCard({ loop }) {
  if (!loop) return null;
  const { previousCycle: prev, currentCycle: cur, next } = loop;
  const learned = prev?.learned || next;
  const applied = cur?.applied;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Closed-loop monitoring</p>
          <h2 className="mt-2 text-lg font-medium">How the last cycle changed this one</h2>
          <p className="mt-1 text-xs text-ink-mute">Each 24-hour cycle learns from the one before it and adjusts what the watch and the questions focus on.</p>
        </div>
        {next?.metrics?.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] text-indigo-700"><Radio size={12} /> Sent to your watch</span>
        )}
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        <Step icon={History} tint="bg-canvas text-ink-soft" eyebrow={prev ? `Cycle ${prev.index} · ${day(prev.start)}` : 'Previous cycle'} title="What happened">
          {prev?.findings?.length
            ? prev.findings.map((f) => <p key={f.text}>• {f.text}</p>)
            : <p>No notable findings.</p>}
        </Step>
        <Arrow />
        <Step icon={Lightbulb} tint="bg-amber-50 text-amber-600" eyebrow="Learning" title="What the system concluded">
          <p>{learned?.reason || 'No pattern requires extra attention.'}</p>
        </Step>
        <Arrow />
        <Step icon={Target} tint="bg-indigo-50 text-indigo-600" eyebrow={cur ? `Cycle ${cur.index} · ${day(cur.start)}` : 'Next cycle'} title="Monitoring priority now">
          {(applied || next)?.metrics?.length ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(applied || next).metrics.map((m) => <span key={m} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">{METRIC[m] || m}</span>)}
              </div>
              {(applied || next).nightBoost && (
                <p className="flex items-center gap-1.5"><Moon size={12} /> Sampling every {(applied || next).sampleIntervalSec}s at night (normally 5s)</p>
              )}
              {(applied || next).checkinFocus?.length > 0 && <p>Check-in focus: {(applied || next).checkinFocus.map((f) => FOCUS[f] || f).join(', ')}</p>}
            </>
          ) : <p>Standard monitoring.</p>}
        </Step>
      </div>
    </section>
  );
}
