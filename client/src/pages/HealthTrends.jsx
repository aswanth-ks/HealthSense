import { useMemo, useState } from 'react';
import { Clock, ChevronDown, TrendingUp, Minus, CheckCircle2, BarChart3, HeartPulse, Droplets, Thermometer } from 'lucide-react';
import Card from '../components/common/Card.jsx';
import LiveDot from '../components/common/LiveDot.jsx';
import TrendChart from '../components/charts/TrendChart.jsx';

const RANGES = { '24H': { n: 48, label: 'last 24 hours' }, '7D': { n: 56, label: 'last 7 days' }, '30D': { n: 60, label: 'last 30 days' } };

const VITALS = [
  { key: 'hr', label: 'Heart Rate', value: '79', unit: 'BPM', color: '#d94452', base: 78, amp: 3, domain: [60, 95] },
  { key: 'spo2', label: 'Blood Oxygen', value: '98', unit: '% SpO₂', color: '#1f9a86', base: 98, amp: 0.6, domain: [90, 100] },
  { key: 'temp', label: 'Temperature', value: '36.7', unit: '°C', color: '#b8790f', base: 36.6, amp: 0.15, domain: [35.5, 37.5] },
  { key: 'bp', label: 'Blood Pressure', value: '120 / 80', unit: 'mmHg', color: '#1f6aa5', base: 120, amp: 2.5, domain: [100, 140] },
];

const BASELINE = [
  { label: 'Heart Rate', icon: HeartPulse, now: '79 BPM', delta: '+2%', up: true, avg: '76 BPM avg' },
  { label: 'Blood Oxygen', icon: Droplets, now: '98%', delta: '0%', avg: '98% avg' },
  { label: 'Temperature', icon: Thermometer, now: '36.7°C', delta: '0%', avg: '36.7°C avg' },
];

function series(v, n, range) {
  const seed = v.key.length + n;
  return Array.from({ length: n }, (_, i) => {
    const raw = v.base + v.amp * (Math.sin(i / 5 + seed) * 0.6 + Math.cos(i / 11) * 0.4);
    const h = range === '24H' ? (i * 24) / n : null;
    const label = range === '24H'
      ? `${Math.floor(h % 12) || 12} ${h % 24 < 12 ? 'AM' : 'PM'}`
      : range === '7D' ? `D${Math.floor(i / 8) + 1}` : `Day ${Math.floor(i / 2) + 1}`;
    return { label, v: +raw.toFixed(v.key === 'temp' ? 2 : 0) };
  });
}

export default function HealthTrends() {
  const [range, setRange] = useState('24H');
  const { n, label } = RANGES[range];
  const charts = useMemo(() => VITALS.map((v) => ({ ...v, data: series(v, n, range) })), [n, range]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Clinical analytics</p>
          <h1 className="mt-3 text-4xl font-medium">Health Trends</h1>
          <p className="mt-2 text-ink-soft">Understand how your monitored readings change over time.</p>
        </div>
        <button className="card flex items-center gap-2 px-4 py-2.5 text-xs text-ink-soft">
          <Clock size={14} /> Oct 24, 2024 <ChevronDown size={14} />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-3 text-xs">
        <span className="flex items-center gap-2 text-ink-soft">
          <LiveDot /> <span className="font-medium text-ink">HealthSense Watch</span> · <span className="text-ink-mute">4 parameters available</span>
        </span>
        <div className="flex rounded-xl bg-white/60 p-1">
          {Object.keys(RANGES).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-4 py-1.5 ${range === r ? 'bg-white font-medium shadow-card' : 'text-ink-soft'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <section className="card grid gap-6 p-6 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:gap-0">
        <div className="md:pr-6">
          <p className="eyebrow">At a glance</p>
          <h2 className="mt-3 text-lg font-medium">Readings remain within configured ranges</h2>
          <p className="mt-1 text-xs text-ink-mute">All four parameters have been consistently available across the selected period.</p>
        </div>
        {[['4/4', 'Parameters stable'], ['98%', 'Average signal quality'], ['0', 'Range exceptions']].map(([v, l]) => (
          <div key={l} className="md:border-l md:border-line md:pl-6">
            <p className="text-3xl font-medium text-brand-700">{v}</p>
            <p className="mt-2 text-xs text-ink-mute">{l}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="eyebrow">Measured data</p>
            <h2 className="mt-2 text-xl font-medium">Vital Trends</h2>
          </div>
          <span className="text-xs text-brand-700/70">Showing {label}</span>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {charts.map((c) => (
            <div key={c.key} className="card p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-ink-soft">{c.label}</p>
                <span className="rounded-md bg-canvas px-2 py-1 text-[10px] text-ink-mute">{range}</span>
              </div>
              <p className="mt-1 text-3xl font-medium tracking-tight">
                {c.value} <span className="text-[11px] font-normal text-ink-mute">{c.unit}</span>
              </p>
              <div className="mt-4 h-40 border-t border-line pt-2">
                <TrendChart data={c.data} color={c.color} unit={c.unit} domain={c.domain} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card
          eyebrow="Reference view"
          title="Today vs recent baseline"
          action={<span className="rounded-md bg-canvas px-2.5 py-1 text-[11px] text-ink-soft">7-day baseline</span>}
        >
          <ul className="divide-y divide-line border-t border-line text-sm">
            {BASELINE.map(({ label: l, icon: Icon, now, delta, up, avg }) => (
              <li key={l} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center py-3">
                <span className="flex items-center gap-2 text-ink-soft"><Icon size={15} /> {l}</span>
                <span className="font-medium">{now}</span>
                <span className={`flex items-center gap-1 text-xs ${up ? 'text-red-500' : 'text-ink-mute'}`}>
                  {up ? <TrendingUp size={13} /> : <Minus size={13} />} {delta}
                </span>
                <span className="text-right text-xs text-ink-mute">{avg}</span>
              </li>
            ))}
          </ul>
        </Card>

        <section className="card p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><BarChart3 size={18} /></span>
            <div>
              <p className="eyebrow">Pattern summary</p>
              <h2 className="mt-1 text-lg font-medium">What the trend shows</h2>
            </div>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-ink-soft">
            Heart rate is tracking slightly above your recent baseline while oxygen, temperature, and blood pressure remain steady.
          </p>
          <p className="mt-5 flex items-center gap-2 text-xs text-brand-700"><CheckCircle2 size={14} /> No unusual patterns detected</p>
        </section>
      </div>
    </div>
  );
}
