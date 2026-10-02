import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { ArrowLeft, Footprints, TrendingUp, Lightbulb, CalendarDays, Link2, RefreshCw, Loader2, Info } from 'lucide-react';
import Section from '../components/common/Section.jsx';
import ConnectionUnavailable from '../components/common/ConnectionUnavailable.jsx';
import { getStepsHistory, syncNow } from '../services/healthApi.js';
import { hasBridge } from '../services/healthBridge.js';
import { useInput } from '../context/InputContext.jsx';
import { fmtSteps, dayLabel, shortDay, syncedLabel, Change, SourceChip } from '../components/health/stepsUi.jsx';

const RANGES = [7, 14, 30];

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-medium">{shortDay(d.date)}</p>
      <p className="text-ink-soft">{d.steps != null ? `${fmtSteps(d.steps)} steps` : 'No data available'}</p>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="min-w-0 rounded-xl bg-canvas px-3 py-2.5">
      <p className="text-[11px] text-ink-mute">{label}</p>
      <p className="mt-0.5 truncate text-base font-semibold">{value}</p>
      {sub && <div className="mt-0.5 text-[11px] text-ink-mute">{sub}</div>}
    </div>
  );
}

export default function StepsHistory() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [sync, setSync] = useState({ busy: false, msg: '', err: '' });
  const { version, bump } = useInput();

  const load = useCallback(() => {
    setError(false);
    getStepsHistory(days).then(setData).catch(() => setError(true));
  }, [days]);
  useEffect(load, [load, version]);

  const c = data?.connection;
  const canSync = c?.connected && !c.demo && hasBridge();
  const doSync = async () => {
    setSync({ busy: true, msg: '', err: '' });
    try { await syncNow(c); setSync({ busy: false, msg: 'Synced.', err: '' }); bump?.(); load(); }
    catch { setSync({ busy: false, msg: '', err: "We couldn't sync your health data right now. Try again." }); }
  };

  const back = (
    <Link to="/" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-1 text-sm text-ink-soft hover:text-ink">
      <ArrowLeft size={16} /> Overview
    </Link>
  );
  const header = (
    <div>
      {back}
      <p className="eyebrow mt-2">Activity</p>
      <h1 className="mt-2 text-3xl font-medium sm:text-4xl">Steps History</h1>
      <p className="mt-2 text-ink-soft">Your daily activity over time</p>
    </div>
  );

  if (error) return <div className="space-y-6">{header}<ConnectionUnavailable onRetry={load} compact /></div>;
  if (!data) {
    return (
      <div className="space-y-6" aria-busy="true">
        {header}
        <div className="h-40 animate-pulse rounded-3xl bg-line/60" />
        <div className="h-64 animate-pulse rounded-3xl bg-line/60" />
      </div>
    );
  }

  if (!data.has_data) {
    return (
      <div className="space-y-6">
        {header}
        <section className="card flex flex-col items-center px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700"><Footprints size={22} /></span>
          <h2 className="mt-4 text-base font-medium">{c?.status === 'permission_denied' ? 'Permission not granted' : 'No step data is available yet.'}</h2>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">
            {c?.status === 'permission_denied'
              ? 'Health data permission was not granted. You can enable access from your health settings.'
              : c?.connected ? 'Your health data is connected. Step history will appear after the first successful sync.' : 'No step data connected yet. Connect your phone\'s health data to automatically track your daily steps.'}
          </p>
          {!c?.connected && (
            <Link to="/settings#health-data" className="mt-5 flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"><Link2 size={15} /> Connect Health Data</Link>
          )}
        </section>
      </div>
    );
  }

  const { today, vs_yesterday: vsY, averages, trend, insights, baseline, series, week_change: wk } = data;
  const avgFor = { 7: averages.d7, 14: averages.d14, 30: averages.d30 }[days];
  const newestFirst = [...series].reverse();

  return (
    <div className="space-y-6">
      {header}

      {/* Today's summary */}
      <Section tone="teal" icon={Footprints} eyebrow="Today's summary" title={dayLabel(today.date, { weekday: 'long', month: 'long', day: 'numeric' })}>
        <div className="card p-5">
          {today.steps != null ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tracking-tight">{fmtSteps(today.steps)} <span className="text-base font-normal text-ink-mute">steps</span></p>
                <Change change={vsY} className="mt-2 !text-sm" />
              </div>
              <SourceChip source={today.source} />
            </div>
          ) : (
            <p className="text-sm text-ink-soft">{c?.connected ? 'Waiting for today\'s activity data.' : 'No step data for today.'}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs text-ink-soft">
            <span>
              Source: <b className="font-medium text-ink">{c?.source_label || '—'}</b>
              {c?.demo && <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">demo data</span>}
              <span className="mx-1.5 text-ink-mute">·</span>Last synced: {syncedLabel(c?.last_sync_at)}
            </span>
            {canSync && (
              <button onClick={doSync} disabled={sync.busy} className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-line bg-white px-3 font-medium hover:bg-canvas disabled:opacity-60">
                {sync.busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {sync.busy ? 'Syncing…' : 'Sync Now'}
              </button>
            )}
          </div>
          {c?.last_sync_status === 'failed' && !sync.msg && <p className="mt-2 text-xs text-amber-700">The last sync attempt failed. Showing data from the last successful sync.</p>}
          {sync.err && <p className="mt-2 text-xs text-red-600">{sync.err}</p>}
          {sync.msg && <p className="mt-2 text-xs text-brand-700">{sync.msg}</p>}
        </div>
      </Section>

      {/* Trend chart */}
      <Section
        tone="indigo" icon={TrendingUp} eyebrow="Trend" title={`Last ${days} days`}
        action={(
          <div role="tablist" aria-label="Date range" className="flex shrink-0 rounded-xl bg-white/70 p-1 text-xs">
            {RANGES.map((r) => (
              <button key={r} role="tab" aria-selected={days === r} onClick={() => setDays(r)} className={`min-h-[36px] rounded-lg px-2.5 sm:px-3 ${days === r ? 'bg-white font-medium shadow-card' : 'text-ink-soft'}`}>
                {r}<span className="hidden sm:inline"> Days</span><span className="sm:hidden">d</span>
              </button>
            ))}
          </div>
        )}
      >
        <div className="card p-3 sm:p-5">
          <div className="h-60 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e8ecef" />
                <XAxis dataKey="date" tickFormatter={(k) => `${+k.slice(5, 7)}/${+k.slice(8)}`} tick={{ fontSize: 10, fill: '#7a8794' }} tickLine={false} axisLine={false} interval={days === 30 ? 4 : days === 14 ? 1 : 0} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} tick={{ fontSize: 10, fill: '#7a8794' }} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                {baseline.status === 'ready' && <ReferenceLine y={baseline.baseline} stroke="#0d9488" strokeDasharray="4 4" label={{ value: 'Your usual', position: 'insideTopRight', fontSize: 10, fill: '#0f766e' }} />}
                <Bar dataKey="steps" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {series.map((d) => <Cell key={d.date} fill={d.date === today.date ? '#4f46e5' : '#a5b4fc'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 flex gap-2 rounded-xl bg-indigo-50/60 px-3 py-2.5 text-sm text-indigo-950"><Info size={15} className="mt-0.5 shrink-0 text-indigo-600" /> {trend.summary}</p>
          {series.some((d) => d.steps == null) && <p className="mt-2 text-[11px] text-ink-mute">Days without data are left empty, not counted as zero.</p>}
        </div>
      </Section>

      {/* Insights */}
      <Section tone="violet" icon={Lightbulb} eyebrow="Activity insights" title="What your steps show">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="card grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            <Stat label="Average" value={avgFor.value != null ? `${fmtSteps(avgFor.value)}` : '—'} sub={avgFor.value != null ? 'steps/day' : 'No valid days'} />
            <Stat label="Highest" value={fmtSteps(insights.highest?.steps)} sub={insights.highest ? shortDay(insights.highest.date) : null} />
            <Stat label="Lowest" value={fmtSteps(insights.lowest?.steps)} sub={insights.lowest ? shortDay(insights.lowest.date) : null} />
            <Stat label="Valid days" value={`${insights.valid_days} / ${insights.total_days}`} />
            <Stat label="Today vs yesterday" value={vsY.percent != null ? `${vsY.percent > 0 ? '+' : ''}${vsY.percent}%` : '—'} sub={vsY.percent == null ? 'Comparison unavailable' : null} />
            <Stat label="7-day change" value={wk.percent != null ? `${wk.percent > 0 ? '+' : ''}${wk.percent}%` : '—'} sub={wk.percent != null ? 'avg vs previous 7 days' : 'Comparison unavailable'} />
          </div>

          <div className="card p-5">
            <p className="text-sm font-semibold">Compared with your usual activity</p>
            {baseline.status === 'ready' ? (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <Stat label="Today" value={fmtSteps(baseline.value)} sub="steps" />
                  <Stat label="Your recent average" value={fmtSteps(baseline.baseline)} sub={`personal baseline · ${baseline.days_used} days`} />
                </dl>
                <p className={`mt-3 text-sm font-medium ${baseline.diff >= 0 ? 'text-brand-700' : 'text-amber-700'}`}>
                  {baseline.diff >= 0 ? '+' : '−'}{fmtSteps(Math.abs(baseline.diff))} steps · {baseline.percent > 0 ? '+' : ''}{baseline.percent}% {baseline.diff >= 0 ? 'above' : 'below'} your average
                </p>
              </>
            ) : baseline.status === 'no_value' ? (
              <p className="mt-2 text-sm text-ink-soft">Your recent average is <b>{fmtSteps(baseline.baseline)}</b> steps/day. Today&apos;s steps aren&apos;t available yet.</p>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">Your activity baseline is still developing.</p>
            )}
            <p className="mt-3 text-[11px] text-ink-mute">Steps describe activity only. Changes are observations, not a diagnosis.</p>
          </div>
        </div>
      </Section>

      {/* Day by day */}
      <Section tone="slate" icon={CalendarDays} eyebrow="Daily history" title="Day by day">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {newestFirst.map((d) => (
            <li key={d.date} className="card flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-soft">{dayLabel(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                {d.steps != null ? (
                  <>
                    <p className="mt-0.5 text-lg font-semibold">{fmtSteps(d.steps)} <span className="text-xs font-normal text-ink-mute">steps</span></p>
                    <Change change={d.change} vs={d.change?.available ? 'vs previous day' : null} className="mt-1" />
                  </>
                ) : (
                  <p className="mt-0.5 text-sm text-ink-mute">No data available</p>
                )}
              </div>
              {d.source && <SourceChip source={d.source} />}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
