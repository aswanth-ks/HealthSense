import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMissing, MIN_ESTIMATE_CONFIDENCE } from '../engines/missingDataEngine.js';
import { patternQuestions } from '../engines/questionEngine.js';
import { summarizeCycle, cycleWindow } from '../engines/cycleEngine.js';

const baseline = (n = 7, sleepSd = 0.4) => ({
  established: true,
  metrics: { sleep: { mean: 7.2, sd: sleepSd, n }, steps: { mean: 7000, sd: 900, n }, hr: { mean: 70, sd: 3, n } },
});

test('sensor field while device is online and cycle is open → awaiting sensor', () => {
  const [r] = resolveMissing([{ field: 'spo2' }], { deviceOnline: true, isOpen: true, baseline: baseline() });
  assert.equal(r.resolution, 'awaiting_sensor');
});

test('SpO2 / respiration are never estimated → user is asked', () => {
  for (const field of ['spo2', 'resp']) {
    const [r] = resolveMissing([{ field }], { deviceOnline: false, isOpen: false, baseline: baseline() });
    assert.equal(r.resolution, 'asked', field);
    assert.equal(r.question.code, 'missing.wear');
  }
});

test('steps with good movement coverage → estimated with confidence ≥ threshold', () => {
  const [r] = resolveMissing([{ field: 'steps' }], { deviceOnline: false, isOpen: false, baseline: baseline(), coverage: { movement: 0.9 }, movementSteps: 6400 });
  assert.equal(r.resolution, 'estimated');
  assert.ok(r.estimate.confidence >= MIN_ESTIMATE_CONFIDENCE);
});

test('sleep from long, stable history → estimated; from short/variable history → asked', () => {
  const good = resolveMissing([{ field: 'sleep' }], { isOpen: false, baseline: baseline(10, 0.3) })[0];
  assert.equal(good.resolution, 'estimated', JSON.stringify(good));
  const weak = resolveMissing([{ field: 'sleep' }], { isOpen: false, baseline: baseline(3, 1.5) })[0];
  assert.equal(weak.resolution, 'asked');
  assert.equal(weak.question.code, 'missing.sleep');
  assert.ok(weak.question.suggested > 0, 'suggests the weak estimate as a default');
});

test('no baseline → sleep is asked', () => {
  const [r] = resolveMissing([{ field: 'sleep' }], { isOpen: false, baseline: { established: false, metrics: {} } });
  assert.equal(r.resolution, 'asked');
});

test('night events are counted from SpO2 dips and breathing pauses', () => {
  const { start, end } = cycleWindow(new Date(Date.now() - 86400000));
  const night = (h, metric, value) => ({ metric, value, ts: new Date(start.getTime() + h * 3600_000), source: 'measured', confidence: 0.9 });
  const readings = [night(2, 'spo2', 89), night(3, 'spo2', 91), night(3, 'resp', 4), night(14, 'spo2', 88), night(4, 'spo2', 97)];
  const c = summarizeCycle(readings, start, end);
  assert.deepEqual([c.events.spo2Dips, c.events.respPauses], [2, 1]); // the 14:00 dip is daytime
});

test('repeated disturbed nights → "did you wake suddenly" question, then follow-ups', () => {
  const cycles = [{ events: { spo2Dips: 4, respPauses: 2 } }, { events: { spo2Dips: 3, respPauses: 1 } }, { events: { spo2Dips: 0, respPauses: 0 } }];
  const q1 = patternQuestions({ cycles, symptoms: [], answered: new Set(), user: {} });
  assert.equal(q1[0].code, 'sleep.wake_sudden');
  assert.match(q1[0].text, /Did you wake suddenly during sleep/);
  const q2 = patternQuestions({ cycles, symptoms: [], answered: new Set(['sleep.wake_sudden']), user: {} });
  assert.equal(q2[0].code, 'sleep.daytime_fatigue');
});

test('one disturbed night is not enough to ask', () => {
  const q = patternQuestions({ cycles: [{ events: { spo2Dips: 5, respPauses: 3 } }, { events: {} }], symptoms: [], answered: new Set(), user: {} });
  assert.equal(q.length, 0);
});

test('strong pain on 2+ days → activity-impact question; no menstrual question when cycle tracking is off', () => {
  const d = (n) => new Date(Date.now() - n * 86400000);
  const symptoms = [{ type: 'cramp', severity: 7, ts: d(0) }, { type: 'pain', severity: 8, ts: d(1) }];
  const q = patternQuestions({ cycles: [], symptoms, answered: new Set(), user: { cycle: { tracking: false } } });
  assert.equal(q[0].code, 'endo.activity_impact');
  assert.ok(!q.some((x) => x.code === 'endo.period'));
});
