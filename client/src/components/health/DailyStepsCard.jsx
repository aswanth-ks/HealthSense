import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Footprints, History, Link2, RefreshCw } from 'lucide-react';
import { getStepsToday } from '../../services/healthApi.js';
import { useInput } from '../../context/InputContext.jsx';
import { fmtSteps, Change, SourceChip } from './stepsUi.jsx';

// Overview "Daily Steps": latest imported daily total, change vs yesterday, source, History.
// Never shows a value that wasn't imported.
export default function DailyStepsCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const { version } = useInput();
  const load = () => { setError(false); getStepsToday().then(setData).catch(() => setError(true)); };
  useEffect(load, [version]);

  const c = data?.connection;
  const today = data?.today;
  const showHistory = data?.has_data;

  return (
    <section className="card flex flex-col p-5" aria-label="Daily steps">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700"><Footprints size={16} /></span>
          <p className="text-sm font-medium">Daily Steps</p>
        </div>
        {showHistory && (
          <Link to="/insights/steps-history" className="flex min-h-[36px] items-center gap-1 rounded-lg border border-line px-2.5 text-[11px] font-medium text-ink-soft hover:bg-canvas">
            <History size={13} /> History
          </Link>
        )}
      </div>

      <div className="mt-4 flex-1">
        {error ? (
          <div className="text-sm text-ink-soft">
            <p>Step data couldn&apos;t be loaded.</p>
            <button onClick={load} className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><RefreshCw size={12} /> Try again</button>
          </div>
        ) : !data ? (
          <div className="space-y-2" aria-busy="true"><div className="h-8 w-28 animate-pulse rounded-lg bg-line" /><div className="h-3 w-36 animate-pulse rounded bg-line" /></div>
        ) : today?.steps != null ? (
          <>
            <p className="text-3xl font-semibold tracking-tight">{fmtSteps(today.steps)}</p>
            <p className="text-xs text-ink-mute">steps today</p>
            <Change change={data.vs_yesterday} className="mt-2" showPercent={false} />
          </>
        ) : c?.status === 'permission_denied' ? (
          <p className="text-sm text-ink-soft">Health data permission was not granted. You can enable access from your health settings.</p>
        ) : c?.connected ? (
          <p className="text-sm text-ink-soft">Waiting for today&apos;s activity data.</p>
        ) : data.has_data ? (
          <p className="text-sm text-ink-soft">No step data for today. Health data is not currently connected.</p>
        ) : (
          <p className="text-sm text-ink-soft">No step data connected yet. Connect Health Data to automatically track your daily steps.</p>
        )}
      </div>

      {data && !error && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {today?.source ? <SourceChip source={today.source} /> : c?.connected ? <SourceChip source={c.source} /> : <span />}
          {!c?.connected && (
            <Link to="/settings#health-data" className="flex min-h-[36px] items-center gap-1 rounded-lg bg-brand-600 px-3 text-[11px] font-medium text-white hover:bg-brand-700">
              <Link2 size={12} /> Connect
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
