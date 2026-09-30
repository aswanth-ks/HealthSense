import Reading from '../models/Reading.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { deviceStatus } from './deviceController.js';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const LIVE_METRICS = ['hr', 'spo2', 'temp', 'resp', 'bp_sys', 'bp_dia', 'movement', 'position', 'steps'];

async function latestByMetric(userId, metrics) {
  const rows = await Reading.aggregate([
    { $match: { userId, metric: { $in: metrics } } },
    { $sort: { ts: -1 } },
    { $group: { _id: '$metric', value: { $first: '$value' }, ts: { $first: '$ts' }, source: { $first: '$source' }, confidence: { $first: '$confidence' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, { value: r.value, ts: r.ts, source: r.source, confidence: r.confidence }]));
}

async function recentSeries(userId, metric, since, limit = 200) {
  const rows = await Reading.find({ userId, metric, ts: { $gte: since } }).sort({ ts: -1 }).limit(limit).select('value ts -_id').lean();
  return rows.reverse();
}

/** GET /api/me/live — snapshot for the Live Monitoring page; updates then arrive over Socket.IO. */
export const getLive = asyncHandler(async (req, res) => {
  const latest = await latestByMetric(req.user._id, LIVE_METRICS);
  const hrSeries = await recentSeries(req.user._id, 'hr', new Date(Date.now() - 10 * 60_000), 40);
  res.json({ latest, hrSeries, device: deviceStatus(req.user) });
});

const round = (v, d = 0) => (v == null ? null : +v.toFixed(d));

/** GET /api/me/overview — Overview dashboard (24-hour window). */
export const getOverview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const since = new Date(Date.now() - 24 * 3600_000);
  const latest = await latestByMetric(userId, ['hr', 'spo2', 'temp', 'bp_sys', 'bp_dia']);

  const stats = await Reading.aggregate([
    { $match: { userId, ts: { $gte: since }, metric: { $in: ['hr', 'spo2', 'temp', 'bp_sys'] } } },
    { $group: { _id: '$metric', avg: { $avg: '$value' }, n: { $sum: 1 } } },
  ]);
  const avg = Object.fromEntries(stats.map((s) => [s._id, s]));

  // 7 hourly points for sparklines
  const spark = async (metric) => {
    const rows = await Reading.aggregate([
      { $match: { userId, metric, ts: { $gte: new Date(Date.now() - 7 * 3600_000) } } },
      { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'hour', timezone: TZ } }, v: { $avg: '$value' } } },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => r.v);
  };

  const r = req.user.ranges;
  const inRange = {
    hr: (v) => v >= r.hrMin && v <= r.hrMax,
    spo2: (v) => v >= r.spo2Min,
    temp: (v) => v >= r.tempMin && v <= r.tempMax,
    bp: (v) => v >= 90 && v <= 130,
  };
  const delta = (m) => {
    const cur = latest[m]?.value;
    const a = avg[m]?.avg;
    if (cur == null || !a) return '—';
    const pct = ((cur - a) / a) * 100;
    return Math.abs(pct) < 1 ? 'Stable' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs 24h avg`;
  };
  const vital = (key, label, unit, m, value, check, series) => {
    const cur = latest[m];
    const ok = cur ? check(cur.value) : null;
    return {
      key, label, unit, value: cur ? value : '--',
      status: cur == null ? 'No data' : ok ? 'Normal' : 'Out of range',
      delta: delta(m),
      series: series.length > 1 ? series : [0, 0],
      source: cur?.source || null,
      confidence: cur?.confidence ?? null,
      ts: cur?.ts || null,
    };
  };

  const [sHr, sSpo2, sTemp, sBp] = await Promise.all(['hr', 'spo2', 'temp', 'bp_sys'].map(spark));
  const vitals = [
    vital('hr', 'Heart Rate', 'BPM', 'hr', String(round(latest.hr?.value)), inRange.hr, sHr),
    vital('spo2', 'Blood Oxygen', '% SpO₂', 'spo2', String(round(latest.spo2?.value)), inRange.spo2, sSpo2),
    vital('temp', 'Temperature', '°C', 'temp', String(round(latest.temp?.value, 1)), inRange.temp, sTemp),
    vital('bp', 'Blood Pressure', 'mmHg', 'bp_sys', `${round(latest.bp_sys?.value)} / ${round(latest.bp_dia?.value)}`, inRange.bp, sBp),
  ];

  const available = vitals.filter((v) => v.value !== '--').length;
  const outOfRange = vitals.filter((v) => v.status === 'Out of range').length;
  const newest = Object.values(latest).reduce((m, x) => (x.ts > m ? x.ts : m), null);
  const conf = vitals.filter((v) => v.confidence != null);

  res.json({
    user: { name: req.user.name },
    device: deviceStatus(req.user),
    status: {
      label: available === 0 ? 'No data' : outOfRange ? 'Attention' : 'Stable',
      note: available === 0 ? 'Waiting for readings' : outOfRange ? `${outOfRange} reading(s) out of range` : 'All readings in range',
      updatedAt: newest ? new Date(newest).toLocaleTimeString('en-US') : '—',
      confidence: conf.length ? conf.reduce((s, v) => s + v.confidence, 0) / conf.length : null,
    },
    vitals,
    summary: { parameters: 4, available, alerts: outOfRange },
    insight: available === 0
      ? 'Connect your watch or start the simulator to begin building your personal baseline.'
      : avg.hr && latest.hr && latest.hr.value > avg.hr.avg * 1.05
        ? 'Your current heart rate is higher than your 24-hour average.'
        : 'Your readings are close to your 24-hour averages.',
  });
});

/** GET /api/me/heart-rate?range=1H|6H|24H|7D — Overview heart-rate chart. */
export const getHeartRate = asyncHandler(async (req, res) => {
  const cfg = { '1H': [1, 'minute', 5], '6H': [6, 'minute', 15], '24H': [24, 'hour', 1], '7D': [168, 'hour', 6] }[req.query.range] || [24, 'hour', 1];
  const [hours, unit, binSize] = cfg;
  const rows = await Reading.aggregate([
    { $match: { userId: req.user._id, metric: 'hr', ts: { $gte: new Date(Date.now() - hours * 3600_000) } } },
    { $group: { _id: { $dateTrunc: { date: '$ts', unit, binSize, timezone: TZ } }, v: { $avg: '$value' } } },
    { $sort: { _id: 1 } },
  ]);
  const fmt = (d) => (hours > 24
    ? d.toLocaleDateString('en-US', { weekday: 'short' })
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  res.json(rows.map((r) => ({ label: fmt(r._id), bpm: Math.round(r.v) })));
});
