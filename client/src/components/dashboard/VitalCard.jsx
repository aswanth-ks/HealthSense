import { HeartPulse, Droplets, Thermometer, Activity, CheckCircle2 } from 'lucide-react';
import Sparkline from '../charts/Sparkline.jsx';
import LiveDot from '../common/LiveDot.jsx';

const META = {
  hr: { icon: HeartPulse, color: '#d94452', tint: 'bg-red-50', top: 'border-t-red-300' },
  spo2: { icon: Droplets, color: '#1f9a86', tint: 'bg-brand-50', top: 'border-t-transparent' },
  temp: { icon: Thermometer, color: '#c8892f', tint: 'bg-amber-50', top: 'border-t-transparent' },
  bp: { icon: Activity, color: '#4a7fc1', tint: 'bg-blue-50', top: 'border-t-transparent' },
};

export default function VitalCard({ vital }) {
  const { icon: Icon, color, tint, top } = META[vital.key];
  return (
    <div className={`card relative flex h-48 flex-col overflow-hidden border-t-2 p-6 ${top}`}>
      <div className="flex items-start justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`} style={{ color }}>
          <Icon size={18} />
        </span>
        <LiveDot />
      </div>
      <p className="mt-4 text-sm text-ink-soft">{vital.label}</p>
      <p className="mt-1 text-3xl font-medium tracking-tight">
        {vital.value} <span className="text-xs font-normal text-ink-mute">{vital.unit}</span>
      </p>
      <div className="mt-auto flex items-end justify-between text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-brand-600" /> {vital.status}</span>
        <span className="z-10 text-ink-mute">{vital.delta}</span>
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0 h-14 w-2/3 opacity-90">
        <Sparkline data={vital.series} color={color} />
      </div>
    </div>
  );
}
