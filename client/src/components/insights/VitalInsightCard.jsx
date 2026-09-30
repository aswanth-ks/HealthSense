import { HeartPulse, Droplets, Thermometer, Activity, Wind, TrendingUp, Minus } from 'lucide-react';
import Sparkline from '../charts/Sparkline.jsx';
import RangeBar from './RangeBar.jsx';

const META = {
  hr: { icon: HeartPulse, color: '#d94452', tint: 'bg-red-50' },
  spo2: { icon: Droplets, color: '#1f9a86', tint: 'bg-brand-50' },
  temp: { icon: Thermometer, color: '#c8892f', tint: 'bg-amber-50' },
  bp: { icon: Activity, color: '#4a7fc1', tint: 'bg-blue-50' },
  resp: { icon: Wind, color: '#6b7fd7', tint: 'bg-indigo-50' },
};
const FALLBACK = { icon: Activity, color: '#5b6b68', tint: 'bg-canvas' };

export default function VitalInsightCard({ vital, avgLabel }) {
  const { icon: Icon, color, tint } = META[vital.key] || FALLBACK;
  const watch = vital.status === 'Watch';
  return (
    <section className="card flex flex-col p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`} style={{ color }}><Icon size={18} /></span>
          <h3 className="text-base font-medium">{vital.label}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${watch ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>
          {vital.status}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-medium tracking-tight">
            {vital.display ?? vital.value} <span className="text-xs font-normal text-ink-mute">{vital.unit}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-mute">
            {vital.trend === 'up' ? <TrendingUp size={13} className="text-amber-600" /> : <Minus size={13} />}
            {vital.delta} vs {avgLabel} ({vital.avg})
          </p>
        </div>
        <div className="h-10 w-28"><Sparkline data={vital.series} color={color} /></div>
      </div>

      <div className="mt-5"><RangeBar value={vital.value} range={vital.range} color={color} /></div>

      <div className="mt-5 rounded-xl bg-canvas px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-mute">What this means</p>
        <p className="mt-1 text-sm text-ink-soft">{vital.meaning}</p>
      </div>
    </section>
  );
}
