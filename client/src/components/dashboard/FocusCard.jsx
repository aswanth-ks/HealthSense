import { Target, Moon, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../common/Card.jsx';

const METRIC = { resp: 'Respiration', spo2: 'SpO₂', hr: 'Heart rate', movement: 'Movement', temp: 'Temperature', steps: 'Activity' };

// What the watch is prioritising right now, and why (compact closed-loop view).
export default function FocusCard({ focus }) {
  const active = focus?.metrics?.length > 0;
  return (
    <Card eyebrow="Adaptive monitoring" title="Monitoring focus" action={<Target size={18} className={active ? 'text-indigo-600' : 'text-ink-soft'} />}>
      {active ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {focus.metrics.map((m) => <span key={m} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">{METRIC[m] || m}</span>)}
          </div>
          {focus.nightBoost && (
            <p className="flex items-center gap-2 text-xs text-ink-soft"><Moon size={14} className="text-indigo-600" /> Sampling every {focus.sampleIntervalSec}s at night (normally 5s)</p>
          )}
          <p className="text-xs leading-relaxed text-ink-soft">{focus.reason}</p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Standard monitoring. If a pattern appears, the watch will automatically focus on the most relevant sensors.</p>
      )}
      <Link to="/insights" className="mt-5 inline-flex items-center gap-1.5 text-xs text-brand-700 hover:underline">How the loop works <ArrowRight size={13} /></Link>
    </Card>
  );
}
