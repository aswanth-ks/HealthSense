import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessSleepRisk } from '../modules/sleepRisk.js';
import { assessEndoSymptoms } from '../modules/endoSymptoms.js';
import { triage, nextCyclePriority, levelChange, DISCLAIMER } from '../engines/triageEngine.js';

const night = (dips, pauses, minSpo2 = 91) => ({ events: { spo2Dips: dips, respPauses: pauses, nightSamples: 96 }, completeness: 0.95, aggregates: { spo2: { min: minSpo2 } }, sleep: { hours: 7 } });
const quiet = () => night(0, 0, 96);
const baseline = { metrics: { sleep: { mean: 7.2 } } };

function run(answers = {}, symptoms = [], cycles = [night(5, 6), night(4, 3), night(3, 2), quiet(), quiet()]) {
  const modules = [assessSleepRisk({ cycles, symptoms, answers, baseline }), assessEndoSymptoms({ symptoms, cycles: [], user: {}, answers })];
  return { modules, result: triage(modules) };
}

test('normal nights → LOW with an explanation and confidence', () => {
  const { result } = run({}, [], [quiet(), quiet(), quiet()]);
  assert.equal(result.level, 'LOW');
  assert.ok(result.reasons.some((r) => /No repeated abnormal patterns/.test(r)));
  assert.match(result.reasons.at(-1), /Data confidence: \d+%/);
  assert.equal(result.disclaimer, DISCLAIMER);
});

test('repeated disturbed nights alone → MONITOR, explained with counts (spec §27-H format)', () => {
  const { result } = run();
  assert.equal(result.level, 'MONITOR');
  assert.ok(result.reasons.includes('11 repeated nighttime respiratory abnormalities'));
  assert.ok(result.reasons.includes('12 associated SpO₂ deviations'));
  assert.ok(result.reasons.includes('Pattern observed across 3 nights'));
});

test('user answers change the triage level (closed-loop step 6: recalculate)', () => {
  const before = run().result;
  const after = run({ 'sleep.wake_sudden': true, 'sleep.daytime_fatigue': 7 }).result;
  assert.equal(levelChange(before.level, after.level), 'increased');
  assert.equal(after.level, 'MODERATE');
  assert.ok(after.reasons.includes('User reported daytime fatigue'));
  assert.ok(after.confidence > before.confidence, 'answers raise confidence');
});

test('HIGH requires well-supported evidence', () => {
  const answers = { 'sleep.wake_sudden': true, 'sleep.daytime_fatigue': 8, 'sleep.snoring': true };
  const full = run(answers, [], [night(6, 6, 86), night(5, 5, 87), night(5, 4, 88), night(4, 4, 88)]).result;
  assert.equal(full.level, 'HIGH');
  // Same pattern on low-completeness data is capped at MODERATE
  const sparse = [night(6, 6, 86), night(5, 5, 87), night(5, 4, 88), night(4, 4, 88)].map((c) => ({ ...c, completeness: 0.4 }));
  assert.equal(run(answers, [], sparse).result.level, 'MODERATE');
});

test('answers without a measured pattern do not raise risk', () => {
  const { result } = run({ 'sleep.wake_sudden': true, 'sleep.daytime_fatigue': 9 }, [], [quiet(), quiet(), quiet()]);
  assert.equal(result.level, 'LOW');
});

test('closed loop: sleep pattern → next cycle prioritises respiration/SpO2 at night with faster sampling', () => {
  const { modules, result } = run({ 'sleep.wake_sudden': true, 'sleep.daytime_fatigue': 7 });
  const p = nextCyclePriority(result, modules);
  assert.deepEqual(p.metrics.slice(0, 2), ['resp', 'spo2']);
  assert.equal(p.nightBoost, true);
  assert.ok(p.sampleIntervalSec < 5);
  const normal = run({}, [], [quiet(), quiet()]);
  assert.deepEqual(nextCyclePriority(normal.result, normal.modules).metrics, []);
});

test('endometriosis-associated module: recurring strong pain around menstruation', () => {
  const period = new Date(Date.now() - 2 * 86400000);
  const d = (n) => new Date(period.getTime() + n * 86400000);
  const symptoms = [
    { type: 'cramp', severity: 8, ts: d(0) }, { type: 'pain', severity: 7, ts: d(1) }, { type: 'cramp', severity: 7, ts: d(2) },
    { type: 'fatigue', severity: 7, ts: d(1) }, { type: 'fatigue', severity: 6, ts: d(2) },
  ];
  const m = assessEndoSymptoms({ symptoms, cycles: [], user: { cycle: { lastPeriodStart: period, avgLengthDays: 28 } }, answers: { 'endo.activity_impact': true } });
  assert.equal(m.active, true);
  assert.ok(m.evidence.some((e) => e.code === 'cyclic'));
  const r = triage([m]);
  assert.ok(['MODERATE', 'HIGH'].includes(r.level), r.level);
  assert.ok(nextCyclePriority(r, [m]).checkinFocus.includes('pain'));
});
