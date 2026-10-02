import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleContext, cycleBaselines, recurringPattern, dayContext } from '../engines/menstrualEngine.js';
import { cycleQuestions } from '../engines/questionEngine.js';
import { assessEndoSymptoms } from '../modules/endoSymptoms.js';
import { triage, nextCyclePriority } from '../engines/triageEngine.js';

const DAY = 86400000;
const at = (daysAgo, h = 12) => { const d = new Date(); d.setHours(h, 0, 0, 0); return new Date(d.getTime() - daysAgo * DAY); };
const start = (daysAgo) => { const d = at(daysAgo); d.setHours(0, 0, 0, 0); return d; };

// Three 28-day cycles; current period started 1 day ago
const cycles = [
  { _id: 'c1', startDate: start(57), cycleLength: 28, periodLength: 5, source: 'user_reported' },
  { _id: 'c2', startDate: start(29), cycleLength: 28, periodLength: 5, source: 'user_reported' },
  { _id: 'c3', startDate: start(1), source: 'user_reported' },
];
const settings = { tracking: true, avgLengthDays: 28, regularity: 'regular' };

test('tracking off → no cycle context at all', () => {
  assert.deepEqual(cycleContext({ tracking: false }, cycles), { tracking: false });
});

test('cycle context: observed day, historical length, estimated next period clearly labelled', () => {
  const c = cycleContext(settings, cycles);
  assert.equal(c.cycleDay, 2);
  assert.equal(c.length.source, 'historical');
  assert.equal(c.length.days, 28);
  assert.equal(c.period.status, 'on_period');
  assert.equal(c.nextPeriod.source, 'historical');
  assert.ok(c.nextPeriod.confidence < 1, 'an expected date is never presented as certain');
});

test('unknown length → population default labelled AI-estimated with low confidence', () => {
  const c = cycleContext({ tracking: true, lengthUnknown: true }, [{ startDate: start(10), source: 'user_reported' }]);
  assert.equal(c.length.source, 'ai_estimated');
  assert.ok(c.length.confidence <= 0.4);
});

test('overdue period → cycle day withheld and a targeted question is asked', () => {
  const c = cycleContext(settings, [{ startDate: start(40), source: 'user_reported' }]);
  assert.equal(c.cycleDay, null);
  const q = cycleQuestions({ context: c, pattern: { detected: false }, answered: new Set() });
  assert.equal(q[0].code, 'cycle.period_started');
});

// Symptoms + daily data: pain 7–8 and reduced activity on days 1–3 of every cycle
const symptoms = [];
const days = [];
for (const c of cycles) {
  for (let d = 0; d < 28; d += 1) {
    const t = new Date(c.startDate.getTime() + d * DAY + 12 * 3600_000);
    if (t > new Date()) break;
    const period = d < 3;
    days.push({ start: new Date(c.startDate.getTime() + d * DAY), completeness: 0.95, aggregates: { hr: { mean: period ? 80 : 74 }, temp: { mean: 36.6 } }, activity: { steps: period ? 3500 : 7000 }, sleep: { hours: period ? 6.2 : 7.3 } });
    if (period) symptoms.push({ ts: t, type: 'pain', severity: 7 + (d % 2) }, { ts: t, type: 'fatigue', severity: 6 });
  }
}

test('recurring cycle-associated pattern detected across cycles — neutral wording, no diagnosis', () => {
  const p = recurringPattern({ cycles, symptoms, days });
  assert.equal(p.detected, true);
  assert.ok(p.cyclesMatched >= 2);
  assert.match(p.summary, /first 3 days/);
  assert.doesNotMatch(`${p.summary} ${p.statement}`, /endometriosis|diagnos(is|ed) with/i);
  assert.match(p.statement, /Consider discussing this pattern with a qualified healthcare professional/);
});

test('cycle-aware baseline: HR on cycle days 1–3 learned separately from outside the period', () => {
  const b = cycleBaselines(days, cycles);
  const inP = b.find((x) => x.cycleContext === 'period_days_1_3' && x.metric === 'hr');
  const out = b.find((x) => x.cycleContext === 'outside_period' && x.metric === 'hr');
  assert.ok(inP && out, 'both contexts learned');
  assert.ok(inP.baselineValue > out.baselineValue, `${inP.baselineValue} vs ${out.baselineValue}`);
  assert.ok(inP.confidence > 0 && inP.confidence < 1);
  // 80 BPM on day 2 is typical for THIS person in this context
  assert.ok(80 >= inP.range.lo && 80 <= inP.range.hi);
});

test('not enough history → no cycle-specific baseline', () => {
  assert.equal(cycleBaselines(days.slice(-3), cycles.slice(-1)).length, 0);
});

test('day context maps calendar days to cycle days', () => {
  assert.equal(dayContext(at(1), cycles).day, 1);
  assert.equal(dayContext(at(1), cycles).context, 'period_days_1_3');
  assert.equal(dayContext(at(20), cycles).context, 'outside_period');
});

test('pattern → adaptive questions (one at a time) → triage & next-cycle priority change', () => {
  const pattern = recurringPattern({ cycles, symptoms, days });
  const ctx = cycleContext(settings, cycles);
  const q1 = cycleQuestions({ context: ctx, pattern, answered: new Set() });
  assert.equal(q1.length, 1);
  assert.equal(q1[0].code, 'cycle.pain_duration');
  const q2 = cycleQuestions({ context: ctx, pattern, answered: new Set(['cycle.pain_duration']) });
  assert.equal(q2[0].code, 'endo.activity_impact');

  const before = assessEndoSymptoms({ symptoms: [], cycles: [], user: { cycle: settings }, answers: {} });
  const after = assessEndoSymptoms({ symptoms, cycles: [], user: { cycle: settings }, answers: { 'cycle.pain_duration': '3 or more days', 'endo.activity_impact': true }, cyclePattern: pattern });
  assert.equal(before.active, false);
  assert.equal(after.active, true);
  assert.ok(after.evidence[0].text.includes('first 3 days'));
  const r = triage([after]);
  const p = nextCyclePriority(r, [{ module: 'sleepRisk', active: false }, after]);
  for (const f of ['pain', 'activity', 'sleep']) assert.ok(p.checkinFocus.includes(f), f);
  for (const m of ['hr', 'temp']) assert.ok(p.metrics.includes(m), m);
  assert.match(p.reason, /cycle-associated/);
});
