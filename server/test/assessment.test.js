import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAssessment } from '../engines/assessmentEngine.js';
import { narrate } from '../engines/assessmentNarrative.js';

const DAY = 86400000;
const dayStart = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); return new Date(d.getTime() - n * DAY); };
const day = (n, o = {}) => ({
  start: dayStart(n), completeness: 0.95, confidence: 0.9,
  aggregates: { hr: { mean: 74, nightMean: 61, source: 'measured', confidence: 0.95 }, spo2: { mean: 97.8, min: 96, source: 'measured', confidence: 0.94 }, resp: { mean: 15, source: 'measured', confidence: 0.9 }, temp: { mean: 36.6, source: 'measured', confidence: 0.97 } },
  sleep: { hours: 7.2, source: 'estimated', confidence: 0.8 }, activity: { steps: 6500, source: 'measured', confidence: 0.9 },
  events: { respPauses: 0, spo2Dips: 0, nightSamples: 96 }, missing: [], ...o,
});
const baseline = { established: true, daysUsed: 5, metrics: { hr: { mean: 74, sd: 2 }, spo2: { mean: 97.9, sd: 0.5 }, resp: { mean: 15, sd: 0.8 }, temp: { mean: 36.6, sd: 0.1 }, steps: { mean: 6500, sd: 800 }, sleep: { mean: 7.2, sd: 0.4 } } };
const history = [1, 2, 3, 4, 5].map((n) => day(n + 3));
const triage = { level: 'MODERATE', confidence: 0.85, reasons: ['x', 'Data confidence: 85%'] };
const priority = { metrics: ['resp', 'spo2', 'hr', 'movement'], checkinFocus: ['sleep', 'fatigue'], reason: 'r', influencedBy: ['Night-time breathing/SpO₂ pattern across 2 nights'], nightBoost: true, sampleIntervalSec: 2 };

const sleepPattern = {
  days: [
    day(2, { sleep: { hours: 5.9, source: 'reported', confidence: 1 } }),
    day(1, { events: { respPauses: 6, spo2Dips: 5, nightSamples: 96 }, aggregates: { ...day(1).aggregates, spo2: { mean: 97, min: 89, source: 'measured', confidence: 0.9 } } }),
    day(0, { events: { respPauses: 5, spo2Dips: 4, nightSamples: 84 }, sleep: { hours: 6.3, source: 'estimated', confidence: 0.8 } }),
  ],
  history, baseline, triage, priority,
  symptoms: [{ id: 's1', ts: new Date(dayStart(2).getTime() + 15 * 3600e3), type: 'fatigue', severity: 5, source: 'reported' }, { id: 's2', ts: new Date(dayStart(0).getTime() + 10 * 3600e3), type: 'fatigue', severity: 6, source: 'reported' }],
  questions: [{ id: 'q1', code: 'sleep.wake_sudden', text: 'Did you wake suddenly during sleep?', status: 'open' }],
  timeline: [], menstrual: null, counts: { measured: 2000, user_reported: 4, historical: 10, estimated: 3 },
};

test('3-day sleep pattern: triage from engine, patterns with evidence, baseline comparison, closed loop', () => {
  const a = buildAssessment(sleepPattern);
  assert.equal(a.sufficient, true);
  assert.equal(a.triage_level, 'MODERATE');
  const resp = a.patterns.find((p) => p.pattern_id === 'sleep_resp');
  assert.deepEqual([resp.recurrence.days_observed, resp.recurrence.total_days, resp.status], [2, 3, 'repeated']);
  assert.ok(resp.evidence_ids.length === 2);
  for (const p of a.patterns) for (const id of p.evidence_ids) assert.ok(a.evidence.some((e) => e.id === id), `evidence ${id} exists`);
  assert.ok(a.patterns.some((p) => p.pattern_id === 'fatigue_sleep' && p.name.includes('reduced sleep')));
  const sleep = a.baseline_comparison.find((r) => r.metric === 'sleep_duration');
  assert.equal(sleep.baseline, 7.2);
  assert.ok(sleep.deviation < 0);
  assert.ok(a.evidence.every((e) => ['MEASURED', 'USER_REPORTED', 'HISTORICAL', 'AI_ESTIMATED'].includes(e.provenance)));
  assert.equal(a.next_24h_focus[0].metric, 'resp');
  assert.equal(a.adaptive_monitoring.generated_from, 'previous 3-day assessment');
  assert.equal(a.recommended_actions[0].type, 'question');
  assert.equal(a.cycle_context.enabled, false, 'no menstrual section when tracking is off');
  assert.ok(a.data_quality.percentages.measured > 90);
});

test('insufficient data → flagged, never filled with invented values', () => {
  const a = buildAssessment({ ...sleepPattern, days: [day(0, { completeness: 0.1 })], symptoms: [] });
  assert.equal(a.sufficient, false);
  assert.match(a.insufficient_reason, /Insufficient data/);
  assert.equal(narrate(a).headline, 'Not enough data yet');
});

test('baseline still developing → comparisons marked, no fake baseline values', () => {
  const a = buildAssessment({ ...sleepPattern, baseline: { established: false, daysUsed: 1, metrics: {} }, history: [] });
  assert.equal(a.baseline_status, 'developing');
  for (const r of a.baseline_comparison.filter((x) => x.recent != null)) {
    assert.equal(r.status, 'baseline_developing');
    assert.equal(r.baseline, undefined);
  }
});

test('narrative only restates findings and never diagnoses', () => {
  const a = buildAssessment(sleepPattern);
  const n = narrate(a);
  const text = JSON.stringify(n).toLowerCase();
  for (const bad of ['apnea', 'apnoea', 'endometriosis', 'diagnos', 'medication', 'you have ']) assert.ok(!text.includes(bad), bad);
  assert.match(n.summary, /breathing irregularities appeared on 2 nights/);
  assert.equal(n.headline, 'Moderate change detected');
});

test('no changes → calm low assessment', () => {
  const a = buildAssessment({ ...sleepPattern, days: [day(2), day(1), day(0)], symptoms: [], questions: [], triage: { level: 'LOW', confidence: 0.9, reasons: [] }, priority: null });
  assert.equal(a.patterns.length, 0);
  assert.equal(a.professional_evaluation.recommendation, 'none');
  assert.equal(a.recommended_actions[0].type, 'monitor');
  assert.match(narrate(a).summary, /close to your personal baseline/);
});
