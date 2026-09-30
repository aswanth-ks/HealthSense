import { useState } from 'react';
import { CheckCircle2, BellRing } from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Segmented from '../components/common/Segmented.jsx';
import Toggle from '../components/common/Toggle.jsx';

const INITIAL_RULES = [
  { key: 'hr', label: 'Heart Rate', range: '60 – 100 BPM', on: true },
  { key: 'spo2', label: 'Blood Oxygen', range: '≥ 95 %', on: true },
  { key: 'temp', label: 'Temperature', range: '36.0 – 37.5 °C', on: true },
  { key: 'bp', label: 'Blood Pressure', range: '90/60 – 130/85 mmHg', on: true },
];

export default function Alerts() {
  const [tab, setTab] = useState('Active');
  const [rules, setRules] = useState(INITIAL_RULES);
  const toggle = (key, on) => setRules((r) => r.map((x) => (x.key === key ? { ...x, on } : x)));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Safety monitoring"
        title="Alerts"
        subtitle="Be notified when a reading moves outside its configured range."
        right={<Segmented options={['Active', 'Resolved']} value={tab} onChange={setTab} />}
      />

      <section className="card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600"><CheckCircle2 size={28} /></span>
        <h2 className="mt-5 text-lg font-medium">{tab === 'Active' ? "You're all caught up" : 'No resolved alerts'}</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">
          {tab === 'Active'
            ? 'No new monitoring alerts. All measurements are within the configured ranges.'
            : 'Alerts that have been resolved will appear here.'}
        </p>
      </section>

      <Card eyebrow="Configuration" title="Alert Rules" action={<BellRing size={18} className="text-ink-soft" />}>
        <ul className="divide-y divide-line border-t border-line">
          {rules.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium">{r.label}</p>
                <p className="mt-1 text-xs text-ink-mute">Alert outside {r.range}</p>
              </div>
              <Toggle checked={r.on} onChange={(v) => toggle(r.key, v)} label={`${r.label} alerts`} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
