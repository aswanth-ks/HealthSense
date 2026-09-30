import { useState } from 'react';
import { ChevronDown, AlertCircle, CheckCircle2, HeartPulse, Droplets, Thermometer, Wind, Footprints, Moon } from 'lucide-react';
import SourceBadge from '../common/SourceBadge.jsx';
import CycleTimeline from './CycleTimeline.jsx';
import { useInput } from '../../context/InputContext.jsx';

const RESOLUTION = { estimated: 'estimated', asked: 'asked you', awaiting_sensor: 'waiting for watch', resolved: 'resolved' };
const FIELD_LABEL = { hr: 'Heart rate', spo2: 'SpO₂', resp: 'Respiration', temp: 'Temperature', movement: 'Movement', sleep: 'Sleep', steps: 'Activity' };

const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;
const day = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function Metric({ icon: Icon, label, value, unit, source, confidence, onCorrect }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-ink-mute"><Icon size={12} /> {label}</p>
      <p className="mt-1 text-sm font-medium">{value == null ? '—' : value} {value != null && <span className="text-[10px] font-normal text-ink-mute">{unit}</span>}</p>
      {source && <SourceBadge source={source} confidence={confidence} className="mt-1" />}
      {onCorrect && (source === 'estimated' || value == null) && (
        <button onClick={onCorrect} className="mt-1 block text-[10px] text-brand-700 hover:underline">{value == null ? 'Add value' : 'Correct this'}</button>
      )}
    </div>
  );
}

export default function CycleCard({ cycle }) {
  const [open, setOpen] = useState(false);
  const { openCheckin } = useInput();
  const correct = (reason) => () => openCheckin({ date: cycle.start, reason, values: { sleepHours: cycle.sleep?.hours ?? '' } });
  const a = cycle.aggregates || {};
  const good = (cycle.completeness ?? 0) >= 0.7;
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

  return (
    <section className="card p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-4 text-left">
        <div className="min-w-[140px]">
          <p className="text-[11px] uppercase tracking-wider text-ink-mute">Cycle {cycle.index}</p>
          <p className="mt-0.5 font-medium">{day(cycle.start)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] ${cycle.status === 'open' ? 'bg-blue-50 text-blue-700' : 'bg-canvas text-ink-soft'}`}>
          {cycle.status === 'open' ? 'In progress' : 'Complete'}
        </span>
        <div className="flex min-w-[180px] flex-1 items-center gap-3 text-xs">
          <span className="text-ink-mute">Data completeness</span>
          <div className="h-1.5 flex-1 rounded-full bg-line">
            <div className={`h-full rounded-full ${good ? 'bg-brand-500' : 'bg-amber-400'}`} style={{ width: pct(cycle.completeness) }} />
          </div>
          <span className="w-9 font-medium">{pct(cycle.completeness)}</span>
        </div>
        <span className="text-xs text-ink-soft">Confidence <span className="font-medium text-ink">{pct(cycle.confidence)}</span></span>
        <ChevronDown size={18} className={`text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric icon={HeartPulse} label="Avg heart rate" value={r1(a.hr?.mean)} unit="BPM" source={a.hr?.source} confidence={a.hr?.confidence} />
        <Metric icon={Droplets} label="Avg SpO₂" value={r1(a.spo2?.mean)} unit="%" source={a.spo2?.source} confidence={a.spo2?.confidence} />
        <Metric icon={Thermometer} label="Avg temp" value={r1(a.temp?.mean)} unit="°C" source={a.temp?.source} confidence={a.temp?.confidence} />
        <Metric icon={Wind} label="Avg respiration" value={r1(a.resp?.mean)} unit="br/min" source={a.resp?.source} confidence={a.resp?.confidence} />
        <Metric icon={Footprints} label="Activity" value={cycle.activity?.steps?.toLocaleString()} unit="steps" source={cycle.activity?.source} confidence={cycle.activity?.confidence} />
        <Metric icon={Moon} label="Sleep" value={cycle.sleep?.hours} unit="h" source={cycle.sleep?.source} confidence={cycle.sleep?.confidence} onCorrect={correct(cycle.sleep?.source === 'estimated' ? `Sleep for this day was estimated (${Math.round((cycle.sleep.confidence || 0) * 100)}% confidence). Enter the real value to replace it.` : 'Sleep is missing for this day.')} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {cycle.missing?.length ? (
          <>
            <span className="flex items-center gap-1.5 text-amber-700"><AlertCircle size={13} /> Missing:</span>
            {cycle.missing.map((m) => (
              <span key={m.field} className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                {FIELD_LABEL[m.field] || m.field}{RESOLUTION[m.resolution] ? ` · ${RESOLUTION[m.resolution]}` : ''}
              </span>
            ))}
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-brand-700"><CheckCircle2 size={13} /> All required data collected</span>
        )}
      </div>

      {open && <CycleTimeline id={cycle.id} />}
    </section>
  );
}
