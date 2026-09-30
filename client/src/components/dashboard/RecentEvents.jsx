import { useEffect, useState } from 'react';
import { ArrowRight, GraduationCap, AlertTriangle, MessageCircleQuestion, MessageSquareReply, ShieldAlert, Target, ClipboardList, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../common/Card.jsx';
import { getTimeline } from '../../services/triageService.js';
import { useInput } from '../../context/InputContext.jsx';

const ICON = {
  baseline: [GraduationCap, 'bg-brand-50 text-brand-600'], deviation: [AlertTriangle, 'bg-amber-50 text-amber-600'],
  question: [MessageCircleQuestion, 'bg-indigo-50 text-indigo-600'], answer: [MessageSquareReply, 'bg-blue-50 text-blue-600'],
  triage: [ShieldAlert, 'bg-red-50 text-red-500'], priority: [Target, 'bg-indigo-50 text-indigo-600'], symptom: [ClipboardList, 'bg-blue-50 text-blue-600'],
};
const when = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function RecentEvents({ className = '' }) {
  const [events, setEvents] = useState(null);
  const { version } = useInput();
  useEffect(() => { getTimeline(5).then((e) => setEvents(e.slice(0, 5))).catch(() => setEvents([])); }, [version]);

  return (
    <Card
      eyebrow="Health timeline"
      title="Recent events"
      className={className}
      action={<Link to="/timeline" className="flex items-center gap-1 text-xs text-brand-700 hover:underline">View all <ArrowRight size={13} /></Link>}
    >
      {events === null && <p className="text-sm text-ink-soft">Loading…</p>}
      {events?.length === 0 && <p className="text-sm text-ink-soft">Events appear here as the system learns your baseline and detects changes.</p>}
      <ul className="divide-y divide-line">
        {(events || []).map((e) => {
          const [Icon, cls] = ICON[e.kind] || [Info, 'bg-canvas text-ink-soft'];
          return (
            <li key={e.id} className="flex items-start gap-3 py-3">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${cls}`}><Icon size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.title}</p>
                {e.detail && <p className="mt-0.5 truncate text-xs text-ink-soft">{e.detail}</p>}
              </div>
              <span className="shrink-0 text-[11px] text-ink-mute">{when(e.ts)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
