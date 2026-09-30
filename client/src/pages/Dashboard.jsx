import useOverview from '../hooks/useOverview.js';
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
  if (!data) return <p className="text-ink-soft">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDate()}</p>
          <h1 className="mt-3 text-4xl font-medium">{greeting()}, {(user?.name || data.user.name).split(' ')[0]}</h1>
          <p className="mt-2 text-ink-soft">Here&apos;s your health monitoring summary for today.</p>
        </div>
        <span className="card flex items-center gap-2 px-4 py-2 text-xs text-ink-soft">
          <LiveDot /> Live data <span className="text-ink-mute">Updated {data.status.updatedAt}</span>
        </span>
      </div>

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
