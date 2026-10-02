import { useState } from 'react';
import Section from '../components/common/Section.jsx';
import { CheckCircle2, BellRing, MessageCircleQuestion, ClipboardCheck } from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Segmented from '../components/common/Segmented.jsx';
import Toggle from '../components/common/Toggle.jsx';
import QuestionCard from '../components/questions/QuestionCard.jsx';
import useQuestions from '../hooks/useQuestions.js';
import { useInput } from '../context/InputContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

const rulesFor = (r = {}) => [
  { key: 'hr', label: 'Heart Rate', text: `Below ${r.hrMin ?? 60} or above ${r.hrMax ?? 100} BPM`, on: true },
  { key: 'spo2', label: 'Blood Oxygen', text: `Below ${r.spo2Min ?? 95}%`, on: true },
  { key: 'temp', label: 'Temperature', text: `Below ${r.tempMin ?? 36} or above ${r.tempMax ?? 37.5} °C`, on: true },
  { key: 'bp', label: 'Blood Pressure', text: 'Systolic below 90 or above 130 mmHg', on: true },
];

const answerText = (q) => (typeof q.answer === 'boolean' ? (q.answer ? 'Yes' : 'No') : `${q.answer}${q.unit ? ` ${q.unit}` : ''}`);
const when = (d) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

export default function Alerts() {
  const [tab, setTab] = useState('Open');
  const { user } = useAuth();
  const [rules, setRules] = useState(() => rulesFor(user?.ranges));
  const open = useQuestions('open');
  const answered = useQuestions('answered');
  const { openCheckin } = useInput();
  const toggle = (key, on) => setRules((r) => r.map((x) => (x.key === key ? { ...x, on } : x)));
  const refresh = () => { open.reload(); answered.reload(); };

  const list = tab === 'Open' ? open.questions : answered.questions;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Safety monitoring"
        title="Alerts & Questions"
        subtitle="Questions the system needs answered to understand your readings, and alerts when something moves outside its range."
        right={<Segmented options={['Open', 'Answered']} value={tab} onChange={setTab} />}
      />

      <Section tone="amber">
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Adaptive questions</p>
              <h2 className="mt-2 text-xl font-medium">{tab === 'Open' ? 'Waiting for your answer' : 'Your previous answers'}</h2>
            </div>
            <button onClick={() => openCheckin()} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink-soft hover:bg-brand-50/60">
              <ClipboardCheck size={14} /> Daily check-in
            </button>
          </div>

          {list === null && <p className="text-sm text-ink-soft">Loading…</p>}

          {list?.length === 0 && (
            <section className="card flex flex-col items-center px-6 py-12 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
                {tab === 'Open' ? <CheckCircle2 size={28} /> : <MessageCircleQuestion size={26} />}
              </span>
              <h2 className="mt-5 text-lg font-medium">{tab === 'Open' ? "You're all caught up" : 'No answers yet'}</h2>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">
                {tab === 'Open'
                  ? 'No questions right now. The system will ask when it needs information your watch cannot measure.'
                  : 'Questions you answer will appear here.'}
              </p>
            </section>
          )}

          {tab === 'Open' && list?.length > 0 && (
            <div className="space-y-4">{list.map((q) => <QuestionCard key={q.id} question={q} onDone={refresh} />)}</div>
          )}

          {tab === 'Answered' && list?.length > 0 && (
            <ul className="card divide-y divide-line">
              {list.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-4 text-sm">
                  <span className="min-w-0 flex-1">{q.text}</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{answerText(q)}</span>
                  <span className="w-32 text-right text-xs text-ink-mute">{when(q.answeredAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Section>

      <Section tone="slate" className="!p-2 sm:!p-3">
        <Card eyebrow="Configuration" title="Alert rules" action={<Link to="/settings" className="flex items-center gap-1.5 text-xs text-brand-700 hover:underline"><BellRing size={14} /> Edit ranges</Link>}>
          <ul className="divide-y divide-line border-t border-line">
            {rules.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="mt-1 text-xs text-ink-mute">Alert when {r.text.charAt(0).toLowerCase() + r.text.slice(1)}</p>
                </div>
                <Toggle checked={r.on} onChange={(v) => toggle(r.key, v)} label={`${r.label} alerts`} />
              </li>
            ))}
          </ul>
        </Card>
      </Section>
    </div>
  );
}
