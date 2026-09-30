import mongoose from 'mongoose';
import Reading from '../models/Reading.js';
import Cycle from '../models/Cycle.js';
import Baseline from '../models/Baseline.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import { interpret } from '../engines/baselineEngine.js';
import { round } from '../engines/stats.js';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const VITALS = [
  { key: 'hr', metric: 'hr', label: 'Heart Rate', unit: 'BPM', dp: 0 },
  { key: 'spo2', metric: 'spo2', label: 'Blood Oxygen', unit: '% SpO₂', dp: 0 },
  { key: 'temp', metric: 'temp', label: 'Temperature', unit: '°C', dp: 1 },
  { key: 'bp', metric: 'bp_sys', label: 'Blood Pressure', unit: 'mmHg', dp: 0 },
  { key: 'resp', metric: 'resp', label: 'Respiration', unit: 'br/min', dp: 1 },
];

const RANGES = {
  '24H': { hours: 24, unit: 'hour', binSize: 1, fmt: { hour: 'numeric' } },
  '7D': { hours: 168, unit: 'hour', binSize: 6, fmt: { weekday: 'short', hour: 'numeric' } },
  '30D': { hours: 720, unit: 'day', binSize: 1, fmt: { month: 'short', day: 'numeric' } },
};

const baselineObj = (b) => {
  if (!b) return { established: false, daysUsed: 0, establishedAt: null, metrics: {} };
  const metrics = b.metrics instanceof Map ? Object.fromEntries(b.metrics) : b.metrics || {};
  return { established: b.established, daysUsed: b.daysUsed, establishedAt: b.establishedAt, metrics };
};

/** GET /api/me/baseline */
export const getBaseline = asyncHandler(async (req, res) => {
  res.json(baselineObj(await Baseline.findOne({ userId: req.user._id }).lean()));
});

/** GET /api/me/trends?range=24H|7D|30D — Health Trends page */
export const getTrends = asyncHandler(async (req, res) => {
  const range = RANGES[req.query.range] ? req.query.range : '24H';
  const cfg = RANGES[range];
  const userId = req.user._id;
  const since = new Date(Date.now() - cfg.hours * 3600_000);
  const baseline = baselineObj(await Baseline.findOne({ userId }).lean());

  const binned = await Reading.aggregate([
    { $match: { userId, ts: { $gte: since }, metric: { $in: VITALS.map((v) => v.metric).concat('bp_dia') } } },
    {
      $group: {
        _id: { m: '$metric', t: { $dateTrunc: { date: '$ts', unit: cfg.unit, binSize: cfg.binSize, timezone: TZ } } },
        v: { $avg: '$value' }, conf: { $avg: '$confidence' }, n: { $sum: 1 },
      },
    },
    { $sort: { '_id.t': 1 } },
  ]);

  const series = {};
  for (const b of binned) (series[b._id.m] ||= []).push(b);

  const fmt = (d) => d.toLocaleString('en-US', { ...cfg.fmt, timeZone: TZ });
  const r = req.user.ranges;
  const inRange = { hr: (v) => v >= r.hrMin && v <= r.hrMax, spo2: (v) => v >= r.spo2Min, temp: (v) => v >= r.tempMin && v <= r.tempMax, bp_sys: (v) => v >= 90 && v <= 130, resp: (v) => v >= 10 && v <= 22 };

  let exceptions = 0;
  let confSum = 0;
  let confN = 0;
  const vitals = VITALS.map((v) => {
    const rows = series[v.metric] || [];
    const avg = rows.length ? rows.reduce((a, x) => a + x.v * x.n, 0) / rows.reduce((a, x) => a + x.n, 0) : null;
    rows.forEach((x) => { confSum += x.conf; confN += 1; if (!inRange[v.metric](x.v)) exceptions += 1; });
    const stat = baseline.metrics[v.metric];
    const dia = v.key === 'bp' ? series.bp_dia || [] : null;
    const diaAvg = dia?.length ? dia.reduce((a, x) => a + x.v, 0) / dia.length : null;
    return {
      key: v.key,
      label: v.label,
      unit: v.unit,
      value: avg == null ? '--' : v.key === 'bp' ? `${Math.round(avg)} / ${Math.round(diaAvg ?? 0)}` : String(round(avg, v.dp)),
      data: rows.map((x) => ({ label: fmt(x._id.t), v: round(x.v, v.dp === 0 ? 0 : 2) })),
      band: stat && baseline.established ? { lo: round(stat.mean - 2 * stat.sd, 2), hi: round(stat.mean + 2 * stat.sd, 2), mean: stat.mean } : null,
      interpretation: avg != null && stat && baseline.established ? interpret(v.metric, round(avg, v.dp), stat, v.label) : null,
      average: avg,
    };
  });

  const available = vitals.filter((v) => v.data.length).length;
  const comparison = vitals
    .filter((v) => v.average != null && baseline.metrics[VITALS.find((x) => x.key === v.key).metric])
    .map((v) => {
      const base = baseline.metrics[VITALS.find((x) => x.key === v.key).metric].mean;
      const pct = ((v.average - base) / base) * 100;
      return { key: v.key, label: v.label, now: `${v.value} ${v.unit}`, base: `${round(base, 1)} ${v.unit} avg`, delta: `${pct >= 0 ? '+' : ''}${round(pct, 0)}%`, up: pct >= 2, down: pct <= -2 };
    });

  const flagged = vitals.filter((v) => v.interpretation && ['above', 'below'].includes(v.interpretation.band));
  const soft = vitals.filter((v) => v.interpretation && ['slightly_above', 'slightly_below'].includes(v.interpretation.band));
  const summary = !baseline.established
    ? `Your personal baseline is still being learned (${baseline.daysUsed}/3 complete days). Until then, readings are compared with standard ranges.`
    : flagged.length
      ? `${flagged.map((v) => v.label).join(', ')} ${flagged.length > 1 ? 'are' : 'is'} outside your usual range for this period.`
      : soft.length
        ? `${soft.map((v) => v.label).join(', ')} ${soft.length > 1 ? 'are' : 'is'} running slightly away from your baseline while other readings remain steady.`
        : 'All readings are within your personal baseline for this period.';

  res.json({
    range,
    baseline,
    vitals: vitals.map(({ average, ...v }) => v),
    glance: {
      stable: `${vitals.filter((v) => v.data.length && !(v.interpretation && ['above', 'below'].includes(v.interpretation.band))).length}/${vitals.length}`,
      available,
      avgSignal: confN ? Math.round((confSum / confN) * 100) : null,
      exceptions,
    },
    comparison,
    summary,
    unusual: flagged.length > 0,
  });
});

const cycleOut = (c) => ({
  id: c._id,
  index: c.index,
  start: c.start,
  end: c.end,
  status: c.status,
  completeness: c.completeness,
  confidence: c.confidence,
  aggregates: c.aggregates,
  activity: c.activity,
  sleep: c.sleep,
  missing: c.missing,
  findings: c.findings,
  priority: c.priority,
  priorityReason: c.priorityReason,
  triage: c.triage,
});

/** GET /api/me/cycles?limit=14 */
export const getCycles = asyncHandler(async (req, res) => {
  const limit = Math.min(60, Number(req.query.limit) || 14);
  const cycles = await Cycle.find({ userId: req.user._id }).sort({ start: -1 }).limit(limit).lean();
  res.json(cycles.map(cycleOut));
});

/** GET /api/me/cycles/:id — full 24-hour timeline (hourly) for one cycle */
export const getCycle = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid id');
  const c = await Cycle.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!c) throw httpError(404, 'Cycle not found');
  const hourly = await Reading.aggregate([
    { $match: { userId: req.user._id, ts: { $gte: c.start, $lt: c.end } } },
    { $group: { _id: { m: '$metric', h: { $dateTrunc: { date: '$ts', unit: 'hour', timezone: TZ } } }, v: { $avg: '$value' }, conf: { $avg: '$confidence' } } },
    { $sort: { '_id.h': 1 } },
  ]);
  const hours = {};
  for (const h of hourly) {
    const k = h._id.h.toISOString();
    (hours[k] ||= { ts: h._id.h })[h._id.m] = { v: round(h.v, 2), conf: round(h.conf, 2) };
  }
  res.json({ ...cycleOut(c), hourly: Object.values(hours) });
});

const METRIC_LABEL = { hr: 'Heart Rate', spo2: 'Blood Oxygen', temp: 'Temperature', resp: 'Respiration', bp_sys: 'Blood Pressure (sys)', bp_dia: 'Blood Pressure (dia)', movement: 'Movement', steps: 'Steps', sleep: 'Sleep', position: 'Position' };
const METRIC_UNIT = { hr: 'BPM', spo2: '% SpO₂', temp: '°C', resp: 'br/min', bp_sys: 'mmHg', bp_dia: 'mmHg', movement: 'g', steps: 'steps', sleep: 'h', position: '' };

/** GET /api/me/readings?metric=hr&page=0&limit=10 — History page log */
export const getReadings = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 10);
  const page = Math.max(0, Number(req.query.page) || 0);
  const metrics = req.query.metric ? [req.query.metric] : ['hr', 'spo2', 'temp', 'bp_sys', 'resp'];
  const q = { userId: req.user._id, metric: { $in: metrics } };
  const [items, total] = await Promise.all([
    Reading.find(q).sort({ ts: -1 }).skip(page * limit).limit(limit).lean(),
    Reading.countDocuments(q),
  ]);
  const r = req.user.ranges;
  const ok = { hr: (v) => v >= r.hrMin && v <= r.hrMax, spo2: (v) => v >= r.spo2Min, temp: (v) => v >= r.tempMin && v <= r.tempMax, bp_sys: (v) => v >= 90 && v <= 130, resp: (v) => v >= 10 && v <= 22 };
  res.json({
    total,
    items: items.map((x) => ({
      id: x._id, metric: x.metric, name: METRIC_LABEL[x.metric], unit: METRIC_UNIT[x.metric],
      value: x.value, ts: x.ts, source: x.source, confidence: x.confidence, deviceId: x.deviceId,
      inRange: ok[x.metric] ? ok[x.metric](x.value) : true,
    })),
  });
});
