import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import useOverview from '../hooks/useOverview.js';
import useQuestions from '../hooks/useQuestions.js';
import { useInput } from '../context/InputContext.jsx';
import QuestionCard from '../components/questions/QuestionCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, greeting } from '../utils/format.js';
import LiveDot from '../components/common/LiveDot.jsx';
import MonitoringStatus from '../components/dashboard/MonitoringStatus.jsx';
import WearableCard from '../components/dashboard/WearableCard.jsx';
import VitalCard from '../components/dashboard/VitalCard.jsx';
import HeartRateChart from '../components/charts/HeartRateChart.jsx';
import MonitoringSummary from '../components/dashboard/MonitoringSummary.jsx';
import InsightCard from '../components/dashboard/InsightCard.jsx';
import AlertsCard from '../components/dashboard/AlertsCard.jsx';

export default function Dashboard() {
  const data = useOverview();
  const { user } = useAuth();
  const { openCheckin } = useInput();
  const { questions, reload } = useQuestions('open');
  if (!data) return <p className="text-ink-soft">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDate()}</p>
          <h1 className="mt-3 text-4xl font-medium">{greeting()}, {(user?.name || data.user.name).split(' ')[0]}</h1>
          <p className="mt-2 text-ink-soft">Here&apos;s your health monitoring summary for today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="card flex items-center gap-2 px-4 py-2 text-xs text-ink-soft">
            <LiveDot /> Live data <span className="text-ink-mute">Updated {data.status.updatedAt}</span>
          </span>
          <button onClick={() => openCheckin()} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700">
            <ClipboardCheck size={14} /> Daily check-in
          </button>
        </div>
      </div>

      {questions?.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">Needs your input</p>
              <h2 className="mt-2 text-xl font-medium">{questions.length === 1 ? 'One question for you' : `${questions.length} questions for you`}</h2>
            </div>
            {questions.length > 2 && <Link to="/alerts" className="text-xs text-brand-700 hover:underline">See all →</Link>}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {questions.slice(0, 2).map((q) => <QuestionCard key={q.id} question={q} compact onDone={reload} />)}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <MonitoringStatus status={data.status} source={data.device.name} />
        <WearableCard device={data.device} />
      </div>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="eyebrow">Measured Data</p>
            <h2 className="mt-2 text-xl font-medium">Current Measurements</h2>
          </div>
          <span className="flex items-center gap-2 text-xs text-ink-soft"><LiveDot /> Readings are live</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {data.vitals.map((v) => <VitalCard key={v.key} vital={v} />)}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <HeartRateChart />
        <MonitoringSummary summary={data.summary} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <InsightCard text={data.insight} />
        <AlertsCard />
      </div>
    </div>
  );
}
