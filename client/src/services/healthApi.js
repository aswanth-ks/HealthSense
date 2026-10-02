// Phone health data (Health Connect / Apple Health). Signed-in users only ever see real imported data;
// sample-data mode (no account) gets a clearly labelled demo series. Failures surface as errors — never fake values.
import api from './api.js';
import { isDemo } from './healthService.js';
import { PLATFORM, bridgePlatform, requestPermissions, readDaily, REQUESTED_METRICS } from './healthBridge.js';
import { stepsSummary, compareDays, buildSeries, addDays, dayKey } from './stepsCalc.js';

export const todayKey = () => dayKey(new Date());

// ---- Sample (no-account demo) ----
const DEMO_VALUES = [7480, 6950, 8120, 7310, 6640, 8920, 7050, 6380, 7720, 6910, 5980, 7240, 6510, 7830, 6200, 3842, 6720, 7150, 6890, 7400, 6030, 7600, 6470, 6120, 5840, 7210, 4980, 6430, 7020, 6842];
function sampleRecords() {
  const t = todayKey();
  const synced = new Date(new Date().setHours(8, 30, 0, 0)).toISOString();
  return DEMO_VALUES.map((v, i) => ({ date: addDays(t, i - (DEMO_VALUES.length - 1)), value: v, source: 'DEMO', syncedAt: synced }))
    .filter((r) => r.date !== addDays(t, -12));
}
const sampleConnection = () => ({
  source: 'DEMO', source_label: 'Demo data', status: 'connected', connected: true, demo: true, sample: true,
  granted_metrics: ['steps'], metrics: [{ metric: 'steps', days: 29 }], last_sync_at: sampleRecords()[0].syncedAt, last_sync_status: 'ok',
});
const sampleBaseline = { mean: 6880, sd: 900, n: 7 };

export async function getHealthStatus() {
  if (isDemo()) return sampleConnection();
  return (await api.get('/health/status')).data;
}

export async function getStepsToday() {
  if (isDemo()) {
    const [yesterday, today] = buildSeries(sampleRecords(), todayKey(), 2);
    return { connection: sampleConnection(), has_data: true, today, yesterday, vs_yesterday: compareDays(today.steps, yesterday.steps) };
  }
  return (await api.get('/health/steps', { params: { today: todayKey() } })).data;
}

export async function getStepsHistory(days = 7) {
  if (isDemo()) return { connection: sampleConnection(), has_data: true, ...stepsSummary({ records: sampleRecords(), todayKey: todayKey(), days, baseline: sampleBaseline }) };
  return (await api.get('/health/steps/history', { params: { days, today: todayKey() } })).data;
}

/** Ask the phone for permission via the native bridge, then register what was actually granted. */
export async function connectHealth() {
  const platform = await bridgePlatform();
  const source = PLATFORM[platform]?.source;
  if (!source) throw Object.assign(new Error('unsupported_platform'), { code: 'unsupported_platform' });
  const { granted } = await requestPermissions(REQUESTED_METRICS);
  const { data } = await api.post('/health/connect', { source, granted_metrics: granted });
  if (data.status === 'permission_denied') throw Object.assign(new Error('permission_denied'), { code: 'permission_denied', status: data });
  return data;
}

/** Read the last `days` days of daily totals from the phone and upload them (idempotent on the server). */
export async function syncNow(status, days = 30) {
  const to = todayKey();
  const from = addDays(to, -(days - 1));
  let records;
  try {
    const rows = await readDaily('steps', from, to);
    records = rows.map((r) => ({ metric: 'steps', value: r.value, date: r.date, source_record_id: r.source_record_id, source: status.source }));
  } catch (e) {
    // Tell the server the phone-side read failed so "Last sync" stays honest.
    await api.post('/health/sync', { source: status.source, failed: true, error: String(e?.message || e) }).catch(() => {});
    throw Object.assign(new Error('sync_failed'), { code: 'sync_failed' });
  }
  try {
    return (await api.post('/health/sync', { source: status.source, records, today: to }, { timeout: 60_000 })).data;
  } catch (e) {
    throw Object.assign(new Error('sync_failed'), { code: 'sync_failed', cause: e });
  }
}

export async function disconnectHealth(deleteData = false) {
  return (await api.post('/health/disconnect', { delete_data: deleteData })).data;
}
