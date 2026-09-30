import { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

// `band` = personal baseline range { lo, hi } drawn as a shaded strip behind the line.
export default function TrendChart({ data, color, unit, domain, band }) {
  const id = useId();
  const yDomain = domain || [
    (min) => Math.min(min, band?.lo ?? min) - Math.abs(min) * 0.01,
    (max) => Math.max(max, band?.hi ?? max) + Math.abs(max) * 0.01,
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e4ebe9" />
        {band && <ReferenceArea y1={band.lo} y2={band.hi} fill="#1f9a86" fillOpacity={0.07} stroke="none" ifOverflow="extendDomain" />}
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#8a9895' }} interval="preserveStartEnd" minTickGap={50} />
        <YAxis hide domain={yDomain} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4ebe9', fontSize: 12 }} formatter={(v) => [`${v} ${unit}`, '']} separator="" />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
