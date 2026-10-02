import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import useOverview from '../hooks/useOverview.js';
import useQuestions from '../hooks/useQuestions.js';
import useTriage from '../hooks/useTriage.js';
import { useInput } from '../context/InputContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, greeting } from '../utils/format.js';
import LiveDot from '../components/common/LiveDot.jsx';
import QuestionCard from '../components/questions/QuestionCard.jsx';
import MonitoringStatus from '../components/dashboard/MonitoringStatus.jsx';
import TodayCard from '../components/dashboard/TodayCard.jsx';
import VitalCard from '../components/dashboard/VitalCard.jsx';
import HeartRateChart from '../components/charts/HeartRateChart.jsx';
import FocusCard from '../components/dashboard/FocusCard.jsx';
import RecentEvents from '../components/dashboard/RecentEvents.jsx';
import WearableCard from '../components/dashboard/WearableCard.jsx';
import CycleHealthCard from '../components/cycle/CycleHealthCard.jsx';
import useCycle from '../hooks/useCycle.js';
import ConnectionUnavailable from '../components/common/ConnectionUnavailable.jsx';

// Overview reads top → bottom as: how am I? → what do you need from me? → my numbers → what's being watched → what happened.
export default function Dashboard() {
  const data = useOverview();
  const tri = useTriage();
  const { data: cycle } = useCycle();
  const { user } = useAuth();
  const { openCheckin } = useInput();
  const { questions, reload } = useQuestions('open');
  const [params, setParams] = useSearchParams();

  // Home-screen shortcut "Daily check-in" opens /?checkin=1
  useEffect(() => {
    if (params.get('checkin') === '1') { openCheckin(); params.delete('checkin'); setParams(params, { replace: true }); }
  }, [params, setParams, openCheckin]);
  if (!data) return <p className="text-ink-soft">Loading…</p>;
  if (data.error) {
    // Offline: no health data is shown, but entering a check-in still works (saved as "pending sync").
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{formatDate()}</p>
            <h1 className="mt-3 text-3xl font-medium sm:text-4xl">{greeting()}, {(user?.name || '').split(' ')[0]}</h1>
          </div>
          <button onClick={() => openCheckin()} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700">
            <ClipboardCheck size={14} /> Daily check-in
          </button>
        </div>
        <ConnectionUnavailable />
        <p className="text-center text-xs text-ink-mute">You can still add a daily check-in or log a symptom. It is kept on this device as <b>pending sync</b> and uploaded when you are back online.</p>
      </div>
    );
  }

  const triage = tri?.current || data.triage;
  const focus = tri?.loop?.next || data.focus;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDate()}</p>
          <h1 className="mt-3 text-3xl font-medium sm:text-4xl">{greeting()}, {(user?.name || data.user.name).split(' ')[0]}</h1>
          <p className="mt-2 text-ink-soft">Here&apos;s your health monitoring summary for today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="card flex items-center gap-2 px-4 py-2 text-xs text-ink-soft">
            <LiveDot className={data.device.connected ? '' : '!bg-ink-mute'} /> {data.device.connected ? 'Live' : 'Offline'}
            <span className="text-ink-mute">· {data.status.updatedAt}</span>
          </span>
          <button onClick={() => openCheckin()} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700">
            <ClipboardCheck size={14} /> Daily check-in
          </button>
        </div>
      </div>

      {/* 1. How am I doing? */}
      <div className="grid gap-5 lg:grid-cols-3">
        <MonitoringStatus status={data.status} triage={triage} changed={tri?.current?.changed} />
        <TodayCard today={data.today} baseline={data.baseline} lastCycle={data.lastCycle} />
      </div>

      {/* 2. What do you need from me? */}
      {questions?.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">Needs your input</p>
              <h2 className="mt-2 text-xl font-medium">{questions.length === 1 ? 'One question for you' : `${questions.length} questions for you`}</h2>
            </div>
            {questions.length > 2 && <Link to="/alerts" className="text-xs text-brand-700 hover:underline">See all →</Link>}
          </div>
          <div className={`grid gap-4 ${questions.length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {questions.slice(0, 2).map((q) => <QuestionCard key={q.id} question={q} compact={questions.length > 1} onDone={reload} />)}
          </div>
        </section>
      )}

      {/* Cycle context (only when the user enabled menstrual cycle tracking) */}
      {cycle?.tracking && <CycleHealthCard cycle={cycle} />}

      {/* 3. My numbers, compared with my own baseline */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow">Measured data</p>
            <h2 className="mt-2 text-xl font-medium">Current measurements</h2>
          </div>
          <span className="text-xs text-ink-mute">
            {data.baseline?.established ? 'Compared with your personal baseline' : 'Compared with standard ranges until your baseline is learned'}
          </span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {data.vitals.map((v) => <VitalCard key={v.key} vital={v} />)}
        </div>
      </section>

      {/* 4. What is being watched */}
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <HeartRateChart />
        <div className="space-y-5">
          <FocusCard focus={focus} />
          <WearableCard device={data.device} />
        </div>
      </div>

      {/* 5. What happened */}
      <RecentEvents />
    </div>
  );
}
