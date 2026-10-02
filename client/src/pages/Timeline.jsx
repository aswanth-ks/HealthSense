import { useEffect, useState } from 'react';
import { CalendarHeart, GraduationCap, AlertTriangle, MessageCircleQuestion, MessageSquareReply, ShieldAlert, Target, ClipboardList, Watch, Info } from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Segmented from '../components/common/Segmented.jsx';
import { getTimeline } from '../services/triageService.js';
import { isDemo } from '../services/healthService.js';
import { onLive } from '../services/socket.js';
import { useInput } from '../context/InputContext.jsx';

const KIND = {
  baseline: { icon: GraduationCap, cls: 'bg-brand-50 text-brand-600', label: 'Baseline' },
  deviation: { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600', label: 'Deviation' },
  question: { icon: MessageCircleQuestion, cls: 'bg-indigo-50 text-indigo-600', label: 'Question' },
  answer: { icon: MessageSquareReply, cls: 'bg-blue-50 text-blue-600', label: 'Answer' },
  triage: { icon: ShieldAlert, cls: 'bg-red-50 text-red-500', label: 'Triage' },
  priority: { icon: Target, cls: 'bg-indigo-50 text-indigo-600', label: 'Monitoring' },
  symptom: { icon: ClipboardList, cls: 'bg-blue-50 text-blue-600', label: 'Reported' },
  device: { icon: Watch, cls: 'bg-canvas text-ink-soft', label: 'Device' },
  cycle: { icon: CalendarHeart, cls: 'bg-rose-50 text-rose-500', label: 'Cycle' },
  info: { icon: Info, cls: 'bg-canvas text-ink-soft', label: 'Info' },
};

const FILTERS = { All: null, 'Key events': ['baseline', 'deviation', 'triage', 'priority', 'cycle'], 'Questions & answers': ['question', 'answer', 'symptom'], Cycle: ['cycle'] };
const dayLabel = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const time = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// Automatically generated health timeline (spec §27-J) — shows the longitudinal story.
export default function Timeline() {
  const [events, setEvents] = useState(null);
  const [filter, setFilter] = useState('Key events');
  const { version } = useInput();

  useEffect(() => {
    const load = () => getTimeline(150).then(setEvents).catch(() => setEvents([]));
    load();
    if (isDemo()) return undefined;
    const offTriage = onLive('triage', load);
    const offQuestions = onLive('questions', load, 60_000);
    return () => { offTriage(); offQuestions(); };
  }, [version]);

  const shown = (events || []).filter((e) => !FILTERS[filter] || FILTERS[filter].includes(e.kind));
  // Oldest → newest reads as a story
  const days = [];
  for (const e of [...shown].reverse()) {
    const k = dayLabel(e.ts);
    if (!days.length || days[days.length - 1].day !== k) days.push({ day: k, items: [] });
    days[days.length - 1].items.push(e);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Longitudinal record"
        title="Health Timeline"
        subtitle="Important events, generated automatically: from your baseline, to what was detected, what you were asked, and how your triage changed."
        right={<Segmented options={Object.keys(FILTERS)} value={filter} onChange={setFilter} />}
      />

      {events === null && <p className="text-sm text-ink-soft">Loading…</p>}
      {events && !days.length && <p className="card p-6 text-sm text-ink-soft">No events yet. They appear as your watch sends data and the system learns your baseline.</p>}

      <div className="space-y-6">
        {days.map(({ day, items }) => (
          <section key={day} className="grid gap-4 md:grid-cols-[140px_1fr]">
            <div className="md:pt-4">
              <p className="text-sm font-medium">{day}</p>
              <p className="text-[11px] text-ink-mute">{items.length} event{items.length > 1 ? 's' : ''}</p>
            </div>
            <ol className="card relative divide-y divide-line">
              {items.map((e) => {
                const k = KIND[e.kind] || KIND.info;
                return (
                  <li key={e.id} className="flex gap-4 px-5 py-4">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${k.cls}`}><k.icon size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{e.title}</p>
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] text-ink-mute">{k.label}</span>
                      </div>
                      {e.detail && <p className="mt-1 text-xs leading-relaxed text-ink-soft">{e.detail}</p>}
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-mute">{time(e.ts)}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
