import { HeartPulse, Droplets, Thermometer, Activity, CheckCircle2, AlertCircle, User } from 'lucide-react';
import Sparkline from '../charts/Sparkline.jsx';
import SourceBadge from '../common/SourceBadge.jsx';

const META = {
  hr: { icon: HeartPulse, color: '#d94452', tint: 'bg-red-50' },
  spo2: { icon: Droplets, color: '#1f9a86', tint: 'bg-brand-50' },
  temp: { icon: Thermometer, color: '#c8892f', tint: 'bg-amber-50' },
  bp: { icon: Activity, color: '#4a7fc1', tint: 'bg-blue-50' },
};
const FALLBACK = { icon: Activity, color: '#5b6b68', tint: 'bg-canvas' };

// One vital: value, what it means *for you* (baseline), whether it's in range, and where the number came from.
export default function VitalCard({ vital }) {
  const { icon: Icon, color, tint } = META[vital.key] || FALLBACK;
  const outOfRange = vital.status === 'Out of range';
  const noData = vital.status === 'No data';
  const unusual = vital.personal && vital.personal.band !== 'typical';
  const flag = outOfRange || unusual;

  return (
    <div className={`card flex flex-col p-5 ${flag ? '!border-amber-200' : ''}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tint}`} style={{ color }}><Icon size={16} /></span>
        <p className="min-w-0 truncate text-sm text-ink-soft">{vital.label}</p>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="whitespace-nowrap text-3xl font-medium leading-none tracking-tight">
          {vital.value} <span className="text-xs font-normal text-ink-mute">{vital.unit}</span>
        </p>
        <div className="h-9 min-w-[40px] max-w-[96px] flex-1 opacity-90"><Sparkline data={vital.series} color={color} /></div>
      </div>

      <p className={`mt-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
        unusual ? 'bg-amber-50 font-medium text-amber-800' : vital.personal ? 'bg-canvas text-ink-soft' : 'bg-canvas text-ink-mute'
      }`}>
        <User size={12} className="shrink-0" /> {vital.delta}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className={`flex items-center gap-1 ${noData ? 'text-ink-mute' : outOfRange ? 'font-medium text-amber-700' : 'text-brand-700'}`}>
          {noData || outOfRange ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />} {vital.status}
        </span>
        <SourceBadge source={vital.source} confidence={vital.confidence} />
      </div>
    </div>
  );
}
