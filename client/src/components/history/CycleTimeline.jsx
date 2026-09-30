import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from 'recharts';
import { getCycle } from '../../services/healthService.js';

const SERIES = [
  { key: 'hr', label: 'Heart rate', color: '#d94452', axis: 'l' },
  { key: 'spo2', label: 'SpO₂', color: '#1f9a86', axis: 'r' },
  { key: 'resp', label: 'Respiration', color: '#6b7fd7', axis: 'l' },
];

// Full 24-hour timeline of one cycle (hourly averages), night shaded.
export default function CycleTimeline({ id }) {
  const [data, setData] = useState(undefined);
  useEffect(() => { getCycle(id).then(setData).catch(() => setData(null)); }, [id]);

  if (data === undefined) return <p className="mt-4 text-xs text-ink-mute">Loading 24-hour timeline…</p>;
  if (!data?.hourly?.length) return <p className="mt-4 text-xs text-ink-mute">The detailed timeline is available when signed in with recorded data.</p>;

  const rows = data.hourly.map((h) => ({
    hour: new Date(h.ts).getHours(),
    label: new Date(h.ts).toLocaleTimeString('en-US', { hour: 'numeric' }),
    hr: h.hr?.v, spo2: h.spo2?.v, resp: h.resp?.v,
  }));
  const first = rows[0]?.label;
  const morning = rows.find((r) => r.hour === 7)?.label;
  const night = rows.find((r) => r.hour === 23)?.label;
  const last = rows[rows.length - 1]?.label;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-medium">24-hour timeline</p>
        <div className="flex gap-4 text-ink-mute">
          {SERIES.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="h-0.5 w-3" style={{ background: s.color }} />{s.label}</span>)}
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-indigo-100" />Night</span>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="#e4ebe9" />
            {morning && <ReferenceArea yAxisId="l" x1={first} x2={morning} fill="#6b7fd7" fillOpacity={0.07} />}
            {night && <ReferenceArea yAxisId="l" x1={night} x2={last} fill="#6b7fd7" fillOpacity={0.07} />}
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#8a9895' }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis yAxisId="l" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#8a9895' }} domain={['dataMin - 5', 'dataMax + 5']} />
            <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#8a9895' }} domain={[85, 100]} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4ebe9', fontSize: 12 }} />
            {SERIES.map((s) => <Line key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.5} dot={false} connectNulls />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
