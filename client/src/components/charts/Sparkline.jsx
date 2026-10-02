import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';

export default function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
