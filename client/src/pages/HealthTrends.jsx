import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertCircle, BarChart3, HeartPulse, Droplets, Thermometer, Wind, Activity, GraduationCap } from 'lucide-react';
import Card from '../components/common/Card.jsx';
import LiveDot from '../components/common/LiveDot.jsx';
import TrendChart from '../components/charts/TrendChart.jsx';
import { getTrends } from '../services/healthService.js';

const RANGES = { '24H': 'last 24 hours', '7D': 'last 7 days', '30D': 'last 30 days' };
const COLORS = { hr: '#d94452', spo2: '#1f9a86', temp: '#b8790f', bp: '#1f6aa5', resp: '#6b7fd7' };
const ICONS = { hr: HeartPulse, spo2: Droplets, temp: Thermometer, bp: Activity, resp: Wind };

const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function HealthTrends() {
  const [range, setRange] = useState('24H');
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    getTrends(range).then((d) => alive && setData(d)).catch(() => {});
    return () => { alive = false; };
  }, [range]);

  const b = data?.baseline;
  const g = data?.glance;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Clinical analytics</p>
          <h1 className="mt-3 text-4xl font-medium">Health Trends</h1>
          <p className="mt-2 text-ink-soft">Understand how your monitored readings change over time.</p>
        </div>
        <span className="card flex items-center gap-2 px-4 py-2.5 text-xs text-ink-soft">
          <Clock size={14} /> {today()}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-3 text-xs">
        <span className="flex flex-wrap items-center gap-2 text-ink-soft">
          <LiveDot /> <span className="font-medium text-ink">HealthSense Watch</span> ·
          <span className="text-ink-mute">{g ? `${g.available} parameters available` : 'Loading…'}</span>
          {b && (
            <span className={`ml-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 ${b.established ? 'bg-brand-50 text-brand-900' : 'bg-amber-50 text-amber-700'}`}>
              <GraduationCap size={13} />
              {b.established ? 'Personal baseline established' : `Learning your baseline · ${b.daysUsed}/3 days`}
            </span>
          )}
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
          <h2 className="mt-3 text-lg font-medium">
            {!g ? 'Loading…' : g.exceptions === 0 ? 'Readings remain within configured ranges' : `${g.exceptions} period(s) outside configured ranges`}
          </h2>
          <p className="mt-1 text-xs text-ink-mute">
            {g && g.available === 0 ? 'No readings in this period yet.' : `Shaded bands on each chart show your personal normal range.`}
          </p>
        </div>
        {[
          [g?.stable ?? '—', 'Parameters stable'],
          [g?.avgSignal == null ? '—' : `${g.avgSignal}%`, 'Average signal quality'],
          [g?.exceptions ?? '—', 'Range exceptions'],
        ].map(([v, l]) => (
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
          <span className="text-xs text-brand-700/70">Showing {RANGES[range]}</span>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {(data?.vitals || []).map((c, i, all) => (
            <div key={c.key} className={`card p-5 ${i === all.length - 1 && all.length % 2 ? 'md:col-span-2' : ''}`}>
              <div className="flex items-start justify-between">
                <p className="text-sm text-ink-soft">{c.label}</p>
                <span className="rounded-md bg-canvas px-2 py-1 text-[10px] text-ink-mute">{range}</span>
              </div>
              <p className="mt-1 text-3xl font-medium tracking-tight">
                {c.value} <span className="text-[11px] font-normal text-ink-mute">{c.unit}</span>
              </p>
              <div className="mt-4 h-40 border-t border-line pt-2">
                {c.data.length ? (
                  <TrendChart data={c.data} color={COLORS[c.key]} unit={c.unit} band={c.band} />
                ) : (
                  <p className="grid h-full place-items-center text-xs text-ink-mute">No readings in this period</p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-mute">
                {c.band ? (
                  <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-brand-500/20" /> Your normal: {c.band.lo}–{c.band.hi}</span>
                ) : <span>Personal band not available yet</span>}
                {c.interpretation && c.interpretation.band !== 'typical' && (
                  <span className="text-amber-700">{c.interpretation.band.replace('_', ' ')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card
          eyebrow="Reference view"
          title="This period vs your baseline"
          action={<span className="rounded-md bg-canvas px-2.5 py-1 text-[11px] text-ink-soft">{b?.established ? `${b.daysUsed}-day baseline` : 'Baseline learning'}</span>}
        >
          {data?.comparison?.length ? (
            <ul className="divide-y divide-line border-t border-line text-sm">
              {data.comparison.map(({ key, label: l, now, delta, up, down, base }) => {
                const Icon = ICONS[key] || Activity;
                return (
                  <li key={l} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center py-3">
                    <span className="flex items-center gap-2 text-ink-soft"><Icon size={15} /> {l}</span>
                    <span className="font-medium">{now}</span>
                    <span className={`flex items-center gap-1 text-xs ${up ? 'text-red-500' : down ? 'text-blue-600' : 'text-ink-mute'}`}>
                      {up ? <TrendingUp size={13} /> : down ? <TrendingDown size={13} /> : <Minus size={13} />} {delta}
                    </span>
                    <span className="text-right text-xs text-ink-mute">{base}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t border-line pt-4 text-sm text-ink-soft">A comparison appears once your baseline has at least 3 complete days of data.</p>
          )}
        </Card>

        <section className="card p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><BarChart3 size={18} /></span>
            <div>
              <p className="eyebrow">Pattern summary</p>
              <h2 className="mt-1 text-lg font-medium">What the trend shows</h2>
            </div>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-ink-soft">{data?.summary || 'Loading…'}</p>
          {data && (
            data.unusual
              ? <p className="mt-5 flex items-center gap-2 text-xs text-amber-700"><AlertCircle size={14} /> Deviation from your personal baseline</p>
              : <p className="mt-5 flex items-center gap-2 text-xs text-brand-700"><CheckCircle2 size={14} /> No unusual patterns detected</p>
          )}
        </section>
      </div>
    </div>
  );
}
