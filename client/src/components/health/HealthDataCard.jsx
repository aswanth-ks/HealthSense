import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, HeartPulse, Loader2, RefreshCw, ShieldCheck, Smartphone, Unplug, AlertTriangle, Info } from 'lucide-react';
import Card from '../common/Card.jsx';
import { getHealthStatus, connectHealth, syncNow, disconnectHealth } from '../../services/healthApi.js';
import { PLATFORM, detectPlatform, hasBridge, bridgeAvailability, openHealthSettings } from '../../services/healthBridge.js';
import { isDemo } from '../../services/healthService.js';
import { useInput } from '../../context/InputContext.jsx';
import { syncedLabel, SourceChip } from './stepsUi.jsx';

const METRIC_LABEL = { steps: 'Steps', distance: 'Distance', heart_rate: 'Heart rate', resting_heart_rate: 'Resting heart rate', sleep: 'Sleep', exercise: 'Exercise / activity' };
const DENIED = 'Health data permission was not granted. You can enable access from your health settings.';
const PRIVACY = "You control which health data HealthSense can access. You can change these permissions from your phone's health settings.";

// Settings → Data Sources → Health Data. All buttons are type="button" (this lives inside the Settings form).
export default function HealthDataCard() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const [avail, setAvail] = useState(null);
  const { bump } = useInput();
  const platform = detectPlatform();
  const p = PLATFORM[platform];

  const load = useCallback(() => { setError(false); getHealthStatus().then(setStatus).catch(() => setError(true)); }, []);
  useEffect(() => { load(); bridgeAvailability().then(setAvail); }, [load]);

  const run = async (kind, fn) => {
    setBusy(kind); setMsg({ ok: '', err: '' });
    try { await fn(); } finally { setBusy(''); }
  };

  const connect = () => run('connect', async () => {
    try {
      const s = await connectHealth();
      setStatus(s);
      setMsg({ ok: 'Connected. Importing your recent activity…', err: '' });
      try { await syncNow(s); setMsg({ ok: 'Connected and synced.', err: '' }); } catch { setMsg({ ok: '', err: "Connected, but we couldn't sync your health data right now. Try again." }); }
      load(); bump?.();
    } catch (e) {
      if (e.code === 'permission_denied') { setStatus(e.status); setMsg({ ok: '', err: DENIED }); } else setMsg({ ok: '', err: 'Could not connect to your health data. Try again.' });
    }
  });
  const sync = () => run('sync', async () => {
    try { const r = await syncNow(status); setMsg({ ok: `Synced · ${r.inserted} new, ${r.updated} updated day(s).`, err: '' }); bump?.(); } catch { setMsg({ ok: '', err: "We couldn't sync your health data right now. Try again." }); }
    load();
  });
  const disconnect = () => run('disconnect', async () => {
    if (!window.confirm('Stop importing health data? Already imported days are kept, labelled with their source.')) return;
    try { setStatus(await disconnectHealth(false)); bump?.(); } catch { setMsg({ ok: '', err: 'Could not disconnect. Try again.' }); }
  });

  const bridge = hasBridge() && avail?.available;
  const connected = status?.connected;
  const btn = 'flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium disabled:opacity-60';

  return (
    <Card eyebrow="Data sources" title="Health Data">
      <p className="text-sm text-ink-soft">Connect your phone&apos;s health data to automatically import activity and other supported health metrics into HealthSense.</p>

      {error ? (
        <p className="mt-4 text-sm text-amber-700">Health data status couldn&apos;t be loaded. <button type="button" onClick={load} className="font-medium underline">Try again</button></p>
      ) : !status ? (
        <div className="mt-4 h-20 animate-pulse rounded-xl bg-line" />
      ) : connected ? (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-800"><CheckCircle2 size={16} /> Health Data Connected ✓</p>
              <p className="mt-1 text-sm">{status.source_label}{status.demo && <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">demo data</span>}</p>
              <p className="text-xs text-ink-soft">Last synced: {syncedLabel(status.last_sync_at)}</p>
              <p className="mt-0.5 text-xs">Sync status: {status.last_sync_status === 'failed'
                ? <span className="text-amber-700">Last attempt failed{status.last_attempt_at ? ` (${syncedLabel(status.last_attempt_at)})` : ''}</span>
                : status.last_sync_at ? <span className="text-brand-700">Up to date</span> : <span className="text-ink-mute">Waiting for first sync</span>}</p>
            </div>
            <SourceChip source={status.source} />
          </div>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-ink-mute">Metrics available</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {status.metrics.map((m) => (
              <li key={m.metric} className="rounded-full bg-white px-2.5 py-1 text-xs">
                {METRIC_LABEL[m.metric] || m.metric} <span className="text-ink-mute">· {m.days ? `${m.days} day${m.days === 1 ? '' : 's'}` : 'no data yet'}</span>
              </li>
            ))}
          </ul>
          {!status.demo && (
            <div className="mt-4 flex flex-wrap gap-2">
              {bridge
                ? <button type="button" onClick={sync} disabled={!!busy} className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}>{busy === 'sync' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {busy === 'sync' ? 'Syncing…' : 'Sync Now'}</button>
                : <p className="w-full text-xs text-ink-soft">Open HealthSense on your phone to sync new data.</p>}
              <button type="button" onClick={disconnect} disabled={!!busy} className={`${btn} border border-line bg-white text-ink-soft hover:bg-canvas`}><Unplug size={15} /> Disconnect</button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {status.status === 'permission_denied' && (
            <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {DENIED}</p>
          )}
          {bridge ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={connect} disabled={!!busy} className={`${btn} w-full bg-brand-600 text-white hover:bg-brand-700 sm:w-auto`}>
                {busy === 'connect' ? <Loader2 size={15} className="animate-spin" /> : <HeartPulse size={15} />} {busy === 'connect' ? 'Waiting for permission…' : p.button}
              </button>
              {status.status === 'permission_denied' && <button type="button" onClick={openHealthSettings} className={`${btn} border border-line bg-white text-ink-soft`}>Open health settings</button>}
            </div>
          ) : (
            <>
              <button type="button" disabled className={`${btn} w-full cursor-not-allowed bg-brand-600/50 text-white sm:w-auto`}><HeartPulse size={15} /> {p.button}</button>
              <p className="flex gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs text-ink-soft">
                <Smartphone size={14} className="mt-0.5 shrink-0" />
                {isDemo()
                  ? 'Sample mode shows demo step data. Sign in on the HealthSense mobile app to connect real health data.'
                  : avail?.reason === 'not_installed'
                    ? `${p.name} isn't available on this phone. Install or update it, then try again.`
                    : platform === 'other'
                      ? 'Health Connect (Android) and Apple Health (iPhone) can only be read by the HealthSense mobile app. Open HealthSense on your phone to connect.'
                      : `A browser can't read ${p.name}. Open HealthSense in the mobile app on this phone to connect — it will ask for your permission first.`}
              </p>
            </>
          )}
        </div>
      )}

      {msg.err && <p className="mt-3 text-sm text-red-600">{msg.err}</p>}
      {msg.ok && <p className="mt-3 text-sm text-brand-700">{msg.ok}</p>}
      <p className="mt-4 flex gap-1.5 text-[11px] text-ink-mute"><ShieldCheck size={12} className="mt-0.5 shrink-0" /> {PRIVACY}</p>
      <p className="mt-1 flex gap-1.5 text-[11px] text-ink-mute"><Info size={12} className="mt-0.5 shrink-0" /> HealthSense only requests the metrics it currently uses (steps). Imported data is labelled with its source.</p>
    </Card>
  );
}
