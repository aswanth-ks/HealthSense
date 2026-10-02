import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSeries, compareDays, average, trend, insights, baselineComparison, stepsSummary, addDays,
} from '../engines/stepsEngine.js';
import { summarizeCycle, cycleWindow } from '../engines/cycleEngine.js';
import { buildBaseline } from '../engines/baselineEngine.js';
import { buildAssessment } from '../engines/assessmentEngine.js';
import { validateRecord, buildUpserts } from '../services/healthDataService.js';

const TODAY = '2026-10-02';
const rec = (daysAgo, value, source = 'HEALTH_CONNECT', syncedAt = '2026-10-02T08:30:00Z') => ({ date: addDays(TODAY, -daysAgo), value, source, syncedAt });
const series = (vals) => vals.map((steps, i) => ({ date: addDays(TODAY, i - vals.length + 1), steps }));

// ---------- Calculations ----------
test('today vs yesterday: positive change and percentage increase', () => {
  const c = compareDays(6842, 5602);
  assert.equal(c.available, true);
  assert.equal(c.diff, 1240);
  assert.equal(c.percent, 22.1);
  assert.equal(c.direction, 'up');
});

test('negative change and percentage decrease', () => {
  const c = compareDays(5602, 6452);
  assert.equal(c.diff, -850);
  assert.equal(c.percent, -13.2);
  assert.equal(c.direction, 'down');
});

test('zero previous-day steps → no misleading percentage', () => {
  const c = compareDays(4000, 0);
  assert.equal(c.available, false);
  assert.equal(c.percent, null);
  assert.equal(c.reason, 'previous_zero');
});

test('missing previous-day data → comparison unavailable (not treated as 0)', () => {
  const c = compareDays(4000, null);
  assert.equal(c.available, false);
  assert.equal(c.diff, null);
  assert.equal(c.reason, 'no_previous');
});

test('7-, 14- and 30-day averages use valid days only; missing days are excluded, not zero', () => {
  const vals = Array.from({ length: 30 }, (_, i) => 5000 + i * 100);
  vals[27] = null; // missing 3 days ago
  const s = series(vals);
  const a7 = average(s, 7);
  const expected7 = Math.round([7300, 7400, 7500, 7600, 7800, 7900].reduce((a, b) => a + b) / 6);
  assert.equal(a7.value, expected7);
  assert.equal(a7.valid_days, 6);
  assert.equal(a7.total_days, 7);
  assert.equal(average(s, 14).valid_days, 13);
  const all = vals.filter((v) => v != null);
  assert.equal(average(s, 30).value, Math.round(all.reduce((a, b) => a + b) / all.length));
  assert.equal(average(series([null, null]), 2).value, null);
});

test('baseline comparison: ready vs developing (never invented)', () => {
  const b = baselineComparison(6842, { mean: 5980, sd: 900, n: 7 });
  assert.equal(b.status, 'ready');
  assert.equal(b.diff, 862);
  assert.equal(b.percent, 14.4);
  assert.equal(b.direction, 'above');
  assert.equal(baselineComparison(6842, { mean: 5980, n: 2 }).status, 'developing');
  assert.equal(baselineComparison(6842, null).message, 'Your activity baseline is still developing.');
});

test('deterministic trend: increasing, decreasing, stable, insufficient', () => {
  assert.equal(trend(series([4000, 4500, 5000, 5500, 6000, 6500, 7000])).direction, 'increasing');
  assert.equal(trend(series([7000, 6500, 6000, 5500, 5000, 4500, 4000])).direction, 'decreasing');
  assert.equal(trend(series([6000, 6100, 5950, 6050, 6000, 5980, 6020])).direction, 'stable');
  const few = trend(series([6000, null, null, 7000, null, null, null]));
  assert.equal(few.direction, 'insufficient');
  assert.match(few.summary, /Not enough activity data/);
});

test('insights: average, highest, lowest, valid days', () => {
  const i = insights(series([6120, 5840, null, 4980, 8920, 7020, 3842]));
  assert.equal(i.highest.steps, 8920);
  assert.equal(i.lowest.steps, 3842);
  assert.equal(i.valid_days, 6);
  assert.equal(i.total_days, 7);
});

test('series keeps missing days as null and prefers real platform data over demo', () => {
  const s = buildSeries([rec(0, 6842), rec(0, 1000, 'DEMO'), rec(2, 6452)], TODAY, 3);
  assert.deepEqual(s.map((d) => d.steps), [6452, null, 6842]);
  assert.equal(s[2].source, 'HEALTH_CONNECT');
});

test('stepsSummary: dynamic today summary, per-day changes, partial data', () => {
  const recs = [rec(0, 6842), rec(1, 5602), rec(2, 6452), rec(3, 5600)];
  const s = stepsSummary({ records: recs, todayKey: TODAY, days: 7, baseline: { mean: 5980, sd: 800, n: 5 } });
  assert.equal(s.today.steps, 6842);
  assert.equal(s.vs_yesterday.diff, 1240);
  assert.equal(s.vs_yesterday.percent, 22.1);
  assert.equal(s.series.length, 7);
  assert.equal(s.series[6].change.percent, 22.1);
  assert.equal(s.series[5].change.percent, -13.2);
  assert.equal(s.series[4].change.percent, 15.2);
  assert.equal(s.series[3].change.available, false); // previous day missing
  assert.equal(s.series[0].steps, null);
  assert.equal(s.insights.valid_days, 4);
  assert.equal(s.trend.direction, 'increasing'); // fitted +14% over the 4 valid days
  assert.equal(s.baseline.diff, 862);
});

test('no data at all → nothing fabricated', () => {
  const s = stepsSummary({ records: [], todayKey: TODAY, days: 7 });
  assert.equal(s.today.steps, null);
  assert.equal(s.vs_yesterday.available, false);
  assert.equal(s.averages.d7.value, null);
  assert.equal(s.insights.average, null);
  assert.equal(s.trend.direction, 'insufficient');
  assert.equal(s.baseline.status, 'developing');
});

// ---------- Data import ----------
const ctx = { source: 'HEALTH_CONNECT', granted: ['steps'], todayKey: TODAY };

test('Health Connect import: valid record keeps metric, unit, date and source', () => {
  const v = validateRecord({ metric: 'steps', value: 6842, date: TODAY, source_record_id: 'hc-1' }, ctx);
  assert.equal(v.ok, true);
  assert.deepEqual({ ...v.doc }, { metric: 'steps', value: 6842, unit: 'steps', date: TODAY, source: 'HEALTH_CONNECT', confidence: 1, sourceRecordId: 'hc-1' });
});

test('Apple Health import interface: same contract, APPLE_HEALTH source', () => {
  const v = validateRecord({ metric: 'steps', value: 4200, date: TODAY }, { ...ctx, source: 'APPLE_HEALTH' });
  assert.equal(v.ok, true);
  assert.equal(v.doc.source, 'APPLE_HEALTH');
  assert.equal(validateRecord({ metric: 'steps', value: 1, date: TODAY, source: 'HEALTH_CONNECT' }, { ...ctx, source: 'APPLE_HEALTH' }).reason, 'source_mismatch');
});

test('records for metrics the user did not authorise are rejected (permission respected)', () => {
  assert.equal(validateRecord({ metric: 'heart_rate', value: 70, date: TODAY }, ctx).reason, 'not_authorised');
  assert.equal(validateRecord({ metric: 'steps', value: 10, date: TODAY }, { ...ctx, granted: [] }).reason, 'not_authorised');
});

test('invalid values / dates are rejected, never coerced to 0', () => {
  assert.equal(validateRecord({ metric: 'steps', value: null, date: TODAY }, ctx).reason, 'invalid_value');
  assert.equal(validateRecord({ metric: 'steps', value: -5, date: TODAY }, ctx).reason, 'invalid_value');
  assert.equal(validateRecord({ metric: 'steps', value: 'abc', date: TODAY }, ctx).reason, 'invalid_value');
  assert.equal(validateRecord({ metric: 'steps', value: 100, date: '02/10/2026' }, ctx).reason, 'invalid_date');
  assert.equal(validateRecord({ metric: 'steps', value: 100, date: addDays(TODAY, 3) }, ctx).reason, 'future_date');
});

test('duplicate sync prevention: upserts keyed on user + metric + date + source, provenance set on insert', () => {
  const now = new Date('2026-10-02T08:30:00Z');
  const doc = validateRecord({ metric: 'steps', value: 6842, date: TODAY }, ctx).doc;
  const [op] = buildUpserts('u1', [doc], now);
  assert.deepEqual(op.updateOne.filter, { userId: 'u1', metric: 'steps', date: TODAY, source: 'HEALTH_CONNECT' });
  assert.equal(op.updateOne.upsert, true);
  assert.equal(op.updateOne.update.$set.syncedAt, now);
  assert.deepEqual(op.updateOne.update.$setOnInsert, { provenance: 'IMPORTED', demo: false });
  // Same day synced twice → identical filter, so the second sync updates the same record.
  const [op2] = buildUpserts('u1', [{ ...doc, value: 7000 }], now);
  assert.deepEqual(op2.updateOne.filter, op.updateOne.filter);
});

// ---------- Closed loop ----------
const start = cycleWindow(new Date(Date.now() - 2 * 86400000)).start;
const end = new Date(start.getTime() + 86400000);

test('imported steps become the cycle activity with IMPORTED provenance and origin', () => {
  const sensor = [{ metric: 'steps', value: 300, ts: new Date(start.getTime() + 3600_000), source: 'measured', confidence: 1 }];
  const c = summarizeCycle(sensor, start, end, {}, { steps: { value: 6842, source: 'HEALTH_CONNECT', confidence: 1 } });
  assert.deepEqual(c.activity, { steps: 6842, source: 'imported', origin: 'HEALTH_CONNECT', confidence: 1 });
  assert.ok(!c.missing.some((m) => m.field === 'steps'));
  // a user correction still wins
  assert.equal(summarizeCycle([], start, end, { steps: 5000 }, { steps: { value: 6842, source: 'HEALTH_CONNECT' } }).activity.source, 'reported');
});

test('imported step days build the steps baseline even without watch data', () => {
  const cycles = [7000, 7200, 6800].map((steps, i) => ({ start: new Date(start - i * 86400000), completeness: 0, activity: { steps, source: 'imported' } }));
  const b = buildBaseline(cycles);
  assert.equal(b.metrics.steps.mean, 7000);
  assert.equal(b.metrics.steps.n, 3);
  assert.equal(b.established, false); // sensor baseline unaffected
});

test('reduced activity vs baseline becomes IMPORTED evidence in the 3-day assessment (no diagnosis)', () => {
  const days = [0, 1, 2].map((i) => ({
    start: new Date(start.getTime() - (2 - i) * 86400000), completeness: 0.9, aggregates: {}, events: {},
    activity: { steps: 4200, source: 'imported', origin: 'HEALTH_CONNECT', confidence: 1 }, sleep: {},
  }));
  const a = buildAssessment({ days, baseline: { established: false, daysUsed: 0, metrics: { steps: { mean: 7000, sd: 900, n: 7 } } }, counts: { imported: 3 } });
  const row = a.baseline_comparison.find((r) => r.metric === 'activity');
  assert.equal(row.baseline, 7000);
  assert.equal(row.deviation_percent, -40);
  const ev = a.evidence.find((e) => e.metric === 'activity');
  assert.equal(ev.provenance, 'IMPORTED');
  assert.equal(ev.source, 'HEALTH_CONNECT');
  assert.equal(ev.deviation_percent, -40);
  assert.ok(a.day_events.some((d) => d.items.some((x) => x.title === 'Activity was lower than your recent baseline' && x.provenance === 'IMPORTED')));
  assert.ok(!JSON.stringify(a).match(/diagnos(is|ed) (of|with)/i));
});
