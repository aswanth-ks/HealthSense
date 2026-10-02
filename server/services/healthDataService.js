// Phone health-platform integration (Health Connect on Android, Apple Health / HealthKit on iPhone).
// The native HealthSense mobile bridge asks the user for permission on the phone, reads the authorised
// metrics and posts them here. The web app never pretends to have native access.
import User from '../models/User.js';
import Baseline from '../models/Baseline.js';
import HealthRecord, { HEALTH_METRICS } from '../models/HealthRecord.js';
import TimelineEvent from '../models/TimelineEvent.js';
import { httpError } from '../middleware/errorHandler.js';
import { dayKey, addDays, isDayKey, stepsSummary, compareDays, buildSeries, SOURCE_LABEL } from '../engines/stepsEngine.js';
import { updateCycles } from './cycleService.js';

export const PLATFORM_SOURCES = ['HEALTH_CONNECT', 'APPLE_HEALTH'];
const UNITS = { steps: 'steps', distance: 'm', heart_rate: 'bpm', resting_heart_rate: 'bpm', sleep: 'hours', exercise: 'minutes' };
const LIMITS = { steps: 200_000, distance: 300_000, heart_rate: 250, resting_heart_rate: 200, sleep: 24, exercise: 1440 };
export const MAX_SYNC_DAYS = 90;

const conn = (u) => u?.healthConnection || {};

/** Public connection status, including which authorised metrics actually have data. */
export async function getStatus(userId) {
  const user = await User.findById(userId).select('healthConnection').lean();
  const c = conn(user);
  const counts = await HealthRecord.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: { metric: '$metric', source: '$source' }, days: { $sum: 1 }, latest: { $max: '$date' } } },
  ]);
  const granted = c.grantedMetrics || [];
  const metrics = granted.map((m) => {
    const rows = counts.filter((x) => x._id.metric === m && x._id.source === c.source);
    return { metric: m, days: rows.reduce((a, x) => a + x.days, 0), latest: rows.map((x) => x.latest).sort().pop() || null };
  });
  return {
    source: c.source || null,
    source_label: c.source ? SOURCE_LABEL[c.source] : null,
    status: c.status || 'not_connected',
    connected: c.status === 'connected',
    demo: !!c.demo,
    granted_metrics: granted,
    metrics, // authorised metrics + how many days of data each has
    connected_at: c.connectedAt || null,
    last_sync_at: c.lastSyncAt || null,
    last_sync_status: c.lastSyncStatus || null,
    last_sync_error: c.lastSyncStatus === 'failed' ? c.lastSyncError || 'Sync failed' : null,
    last_attempt_at: c.lastAttemptAt || null,
  };
}

/**
 * Called by the mobile bridge after the phone's permission dialog.
 * granted_metrics must be what the user actually authorised; an empty list = permission denied.
 */
export async function connect(userId, { source, granted_metrics: granted = [] } = {}) {
  if (!PLATFORM_SOURCES.includes(source)) throw httpError(400, 'source must be HEALTH_CONNECT or APPLE_HEALTH');
  if (!Array.isArray(granted)) throw httpError(400, 'granted_metrics must be an array');
  const metrics = [...new Set(granted)].filter((m) => HEALTH_METRICS.includes(m));
  const denied = metrics.length === 0;
  await User.updateOne({ _id: userId }, {
    $set: {
      'healthConnection.source': source,
      'healthConnection.status': denied ? 'permission_denied' : 'connected',
      'healthConnection.grantedMetrics': metrics,
      'healthConnection.connectedAt': denied ? null : new Date(),
      'healthConnection.demo': false,
    },
  });
  if (!denied) {
    await TimelineEvent.create({ userId, kind: 'device', title: `${SOURCE_LABEL[source]} connected`, detail: `Authorised: ${metrics.join(', ')}.` });
  }
  return getStatus(userId);
}

/** Stop importing. Imported records are kept (with their provenance) unless deleteData is set. */
export async function disconnect(userId, { deleteData = false } = {}) {
  const user = await User.findById(userId).select('healthConnection').lean();
  const src = conn(user).source;
  await User.updateOne({ _id: userId }, { $set: { 'healthConnection.status': 'disconnected', 'healthConnection.grantedMetrics': [] } });
  if (deleteData && src) {
    const dates = await HealthRecord.distinct('date', { userId, source: src });
    await HealthRecord.deleteMany({ userId, source: src });
    if (dates.length) await updateCycles(userId, { dates });
  }
  return getStatus(userId);
}

/** Validate one incoming record. Returns { ok, doc } or { ok: false, reason }. */
export function validateRecord(r, { source, granted, todayKey }) {
  if (!r || typeof r !== 'object') return { ok: false, reason: 'invalid' };
  const metric = r.metric;
  if (!HEALTH_METRICS.includes(metric)) return { ok: false, reason: 'unknown_metric' };
  if (!granted.includes(metric)) return { ok: false, reason: 'not_authorised' };
  if (!isDayKey(r.date)) return { ok: false, reason: 'invalid_date' };
  if (r.date > addDays(todayKey, 1)) return { ok: false, reason: 'future_date' }; // +1 day tolerates time zones
  if (r.date < addDays(todayKey, -MAX_SYNC_DAYS)) return { ok: false, reason: 'too_old' };
  const value = Number(r.value);
  if (r.value == null || !Number.isFinite(value) || value < 0 || value > LIMITS[metric]) return { ok: false, reason: 'invalid_value' };
  if (r.source && r.source !== source) return { ok: false, reason: 'source_mismatch' };
  return {
    ok: true,
    doc: {
      metric, value, unit: UNITS[metric], date: r.date, source,
      confidence: r.confidence != null && Number.isFinite(+r.confidence) ? Math.min(1, Math.max(0, +r.confidence)) : 1,
      sourceRecordId: r.source_record_id ? String(r.source_record_id).slice(0, 200) : undefined,
    },
  };
}

/** Upserts keyed on user + metric + date + source (matches the unique index): re-syncing updates, never duplicates. */
export function buildUpserts(userId, docs, now) {
  return docs.map((d) => ({
    updateOne: {
      filter: { userId, metric: d.metric, date: d.date, source: d.source },
      update: {
        $set: { value: d.value, unit: d.unit, confidence: d.confidence, syncedAt: now, ...(d.sourceRecordId ? { sourceRecordId: d.sourceRecordId } : {}) },
        $setOnInsert: { provenance: 'IMPORTED', demo: false },
      },
      upsert: true,
    },
  }));
}

/**
 * Idempotent import from the mobile bridge. Same user + metric + date + source → updated, never duplicated.
 * body: { source, records: [{ metric, value, date, source_record_id?, confidence? }], today? }
 *   or  { source, failed: true, error } to record a sync failure seen on the phone.
 */
export async function sync(userId, body = {}) {
  const user = await User.findById(userId).select('healthConnection').lean();
  const c = conn(user);
  const now = new Date();
  if (c.status !== 'connected' || !PLATFORM_SOURCES.includes(c.source)) {
    throw httpError(409, c.status === 'permission_denied'
      ? 'Health data permission was not granted. You can enable access from your health settings.'
      : 'Health data is not connected.');
  }
  if (body.source && body.source !== c.source) throw httpError(400, `This account is connected to ${SOURCE_LABEL[c.source]}.`);

  if (body.failed) {
    await User.updateOne({ _id: userId }, { $set: { 'healthConnection.lastSyncStatus': 'failed', 'healthConnection.lastSyncError': String(body.error || 'Sync failed').slice(0, 200), 'healthConnection.lastAttemptAt': now } });
    return { ok: false, ...(await getStatus(userId)) };
  }
  if (!Array.isArray(body.records)) throw httpError(400, 'records must be an array');
  if (body.records.length > MAX_SYNC_DAYS * HEALTH_METRICS.length) throw httpError(413, 'Too many records in one sync');

  const todayKey = isDayKey(body.today) ? body.today : dayKey(now);
  const skipped = {};
  const docs = new Map(); // last value wins within one payload
  for (const r of body.records) {
    const v = validateRecord(r, { source: c.source, granted: c.grantedMetrics || [], todayKey });
    if (!v.ok) { skipped[v.reason] = (skipped[v.reason] || 0) + 1; continue; }
    docs.set(`${v.doc.metric}|${v.doc.date}`, v.doc);
  }

  let inserted = 0;
  let updated = 0;
  if (docs.size) {
    const res = await HealthRecord.bulkWrite(buildUpserts(userId, [...docs.values()], now), { ordered: false });
    inserted = res.upsertedCount || 0;
    updated = res.modifiedCount || 0;
  }

  await User.updateOne({ _id: userId }, { $set: { 'healthConnection.lastSyncAt': now, 'healthConnection.lastSyncStatus': 'ok', 'healthConnection.lastAttemptAt': now }, $unset: { 'healthConnection.lastSyncError': '' } });

  // Feed the closed loop: affected days → cycles → personal baseline → assessment / next-cycle focus.
  const stepDates = [...new Set([...docs.values()].filter((d) => d.metric === 'steps').map((d) => d.date))];
  if (stepDates.length) await updateCycles(userId, { dates: stepDates });

  return { ok: true, received: body.records.length, inserted, updated, unchanged: docs.size - inserted - updated, skipped, synced_at: now };
}

async function stepRecords(userId, todayKey, days) {
  return HealthRecord.find({ userId, metric: 'steps', date: { $gte: addDays(todayKey, -(days + 14)), $lte: todayKey } })
    .select('date value source syncedAt -_id').lean();
}

const stepsBaseline = async (userId) => (await Baseline.findOne({ userId }).lean())?.metrics?.steps || null;

/** Compact data for the Overview "Daily Steps" card. */
export async function stepsToday(userId, todayKey = dayKey(new Date())) {
  const [status, recs] = await Promise.all([getStatus(userId), stepRecords(userId, todayKey, 2)]);
  const [yesterday, today] = buildSeries(recs, todayKey, 2);
  return {
    connection: status,
    has_data: recs.length > 0,
    today,
    yesterday,
    vs_yesterday: compareDays(today.steps, yesterday.steps),
  };
}

/** Full Steps History for 7 / 14 / 30 days. */
export async function stepsHistory(userId, { todayKey = dayKey(new Date()), days = 7 } = {}) {
  const [status, recs, baseline] = await Promise.all([getStatus(userId), stepRecords(userId, todayKey, 31), stepsBaseline(userId)]);
  return { connection: status, has_data: recs.length > 0, ...stepsSummary({ records: recs, todayKey, days, baseline }) };
}
