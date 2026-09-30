import { CheckCircle2 } from 'lucide-react';
import Card from '../common/Card.jsx';

export default function MonitoringSummary({ summary }) {
  const rows = [
    ['Parameters monitored', summary.parameters],
    ['Currently available', summary.available],
    ['Active alerts', summary.alerts],
  ];
  return (
    <Card eyebrow="System Snapshot" title="Monitoring Summary">
      <ul>
        {rows.map(([label, n]) => (
          <li key={label} className="flex items-center gap-5 border-b border-line py-5 first:pt-2">
            <span className="w-6 text-2xl font-medium text-brand-700">{n}</span>
            <span className="text-sm text-ink-soft">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-center gap-2 text-xs text-ink-soft">
        <CheckCircle2 size={15} className="text-brand-600" /> Everything is operating normally
      </p>
    </Card>
  );
}
