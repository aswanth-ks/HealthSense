import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../common/Card.jsx';
import LiveDot from '../common/LiveDot.jsx';
import { getHeartRateSeries } from '../../services/healthService.js';

const RANGES = ['1H', '6H', '24H', '7D'];

export default function HeartRateChart() {
  const [range, setRange] = useState('24H');
  const [data, setData] = useState([]);

  useEffect(() => {
    let alive = true;
    getHeartRateSeries(range).then((d) => alive && setData(d));
    return () => { alive = false; };
  }, [range]);

  const latest = data.length ? data[data.length - 1].bpm : '--';

  return (
    <Card
      eyebrow="Continuous Measurement"
      title="Heart Rate Trend"
      className="lg:col-span-2"
      action={
        <div className="flex rounded-xl bg-canvas p-1 text-xs">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 ${range === r ? 'bg-white font-medium shadow-card' : 'text-ink-soft'}`}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      <p className="-mt-2 mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-medium tracking-tight">{latest}</span>
        <span className="text-xs text-ink-mute">BPM</span>
        {data.length > 0 && <span className="ml-2 text-xs text-ink-soft">latest in this period</span>}
      </p>
      <div className="h-64">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center rounded-xl bg-canvas text-center">
            <div className="px-6">
              <p className="text-sm font-medium">No heart-rate readings in this period</p>
              <p className="mt-1 text-xs text-ink-mute">Wear your watch to start collecting data{range !== '7D' && <>, or <button onClick={() => setRange('7D')} className="text-brand-700 hover:underline">view the last 7 days</button></>}.</p>
            </div>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d94452" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#d94452" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e4ebe9" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a9895' }} interval="preserveStartEnd" minTickGap={40} />
            <YAxis domain={[(min) => Math.floor(Math.min(min, 60) / 10) * 10, (max) => Math.ceil(Math.max(max, 90) / 10) * 10]} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a9895' }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4ebe9', fontSize: 12 }} formatter={(v) => [`${v} BPM`, 'Heart rate']} />
            <Area type="monotone" dataKey="bpm" stroke="#d94452" strokeWidth={2} fill="url(#hrFill)" />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 flex justify-between border-t border-line pt-3 text-xs text-ink-mute">
        <span className="flex items-center gap-1.5"><LiveDot className="!h-1.5 !w-1.5" /> Data from HealthSense Watch</span>
        <span>Normal range <span className="text-ink">60–100 BPM</span></span>
      </div>
    </Card>
  );
}
