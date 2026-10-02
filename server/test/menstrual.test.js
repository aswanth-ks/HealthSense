import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleContext, cycleBaselines, recurringPattern, dayContext, recomputeLengths, validatePeriod, cycleBaselineStats } from '../engines/menstrualEngine.js';
import { buildAssessment } from '../engines/assessmentEngine.js';
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

test('overdue period → cycle day withheld and a targeted question is asked', () => {
  const c = cycleContext(settings, [{ startDate: start(40), source: 'user_reported' }]);
  assert.equal(c.cycleDay, null);
  const q = cycleQuestions({ context: c, pattern: { detected: false }, answered: new Set() });
  assert.ok(q.some((x) => x.code === 'cycle.period_started'));
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

// ---------------- Cycle history & current-cycle calculation (spec tests 1–12) ----------------
const onlyStart = (daysAgo, extra = {}) => ({ _id: `c${daysAgo}`, startDate: start(daysAgo), source: 'user_reported', ...extra });

test('1 · one known period start → current cycle day calculated (estimate, lower confidence)', () => {
  const c = cycleContext({ tracking: true }, [onlyStart(22)]);
  assert.equal(c.cycleDay, 23);
  assert.equal(c.cycleDaySource, 'ai_estimated');
  assert.equal(c.status, 'needs_more');
  assert.ok(c.missing.includes('previous_period_start'));
});

test('2 · two historical starts → historical cycle length calculated', () => {
  const cs = recomputeLengths([onlyStart(50), onlyStart(22)]);
  assert.equal(cs[0].cycleLength, 28);
  const c = cycleContext({ tracking: true }, [onlyStart(50), onlyStart(22)]);
  assert.deepEqual([c.length.days, c.length.source, c.status], [28, 'historical', 'ready']);
});

test('3 · three or more cycles → median cycle length used', () => {
  const b = cycleBaselineStats([onlyStart(100), onlyStart(72), onlyStart(40), onlyStart(12)]); // lengths 28, 32, 28
  assert.equal(b.median_cycle_length, 28);
  assert.equal(b.cycles_used, 3);
  assert.deepEqual([b.min_cycle_length, b.max_cycle_length], [28, 32]);
});

test('4 · irregular history → confidence decreases', () => {
  const regular = cycleContext({ tracking: true }, [onlyStart(112), onlyStart(84), onlyStart(56), onlyStart(28), onlyStart(5)]);
  const irregular = cycleContext({ tracking: true }, [onlyStart(120), onlyStart(98), onlyStart(58), onlyStart(33), onlyStart(5)]);
  assert.ok(irregular.confidence < regular.confidence, `${irregular.confidence} < ${regular.confidence}`);
  assert.equal(irregular.baseline.regularity, 'usually_irregular');
});

test('5 · no previous history → still estimated from latest period, with lower confidence', () => {
  const one = cycleContext({ tracking: true }, [onlyStart(10)]);
  const many = cycleContext({ tracking: true }, [onlyStart(66), onlyStart(38), onlyStart(10)]);
  assert.equal(one.cycleDay, 11);
  assert.ok(one.confidence < many.confidence);
});

test('6 · no latest period → no current cycle estimate', () => {
  const c = cycleContext({ tracking: true, avgLengthDays: 28 }, []);
  assert.equal(c.known, false);
  assert.equal(c.status, 'needs_setup');
  assert.equal(c.cycleDay, undefined);
});

test('7 · period end before start → validation error', () => {
  assert.ok(validatePeriod({ start: start(5), end: start(8) }).some((e) => /before the start/.test(e)));
  assert.ok(validatePeriod({ start: new Date(Date.now() + 3 * DAY) }).some((e) => /future/.test(e)));
  assert.equal(validatePeriod({ start: start(8), end: start(4) }).length, 0);
});

test('8 · new period reported → new cycle, previous closed, current day recalculated', () => {
  const before = cycleContext({ tracking: true }, [onlyStart(56), onlyStart(28)]);
  assert.equal(before.cycleDay, 29);
  const after = cycleContext({ tracking: true }, [onlyStart(56), onlyStart(28), onlyStart(0)]);
  assert.equal(after.cycleDay, 1);
  assert.equal(recomputeLengths([onlyStart(56), onlyStart(28), onlyStart(0)])[1].cycleLength, 28);
  assert.equal(after.history, 2);
});

test('9 · historical cycle edited → statistics and current estimate update', () => {
  const a = cycleBaselineStats([onlyStart(84), onlyStart(56), onlyStart(28), onlyStart(1)]);
  const edited = cycleBaselineStats([onlyStart(90), onlyStart(56), onlyStart(28), onlyStart(1)]);
  assert.notDeepEqual([a.average_cycle_length, a.max_cycle_length], [edited.average_cycle_length, edited.max_cycle_length]);
  assert.equal(edited.max_cycle_length, 34);
});

test('10 · tracking disabled → no menstrual information in the 3-day assessment', () => {
  const a = buildAssessment({ days: [], menstrual: null, counts: {} });
  assert.equal(a.cycle_context, null);
  assert.deepEqual(cycleContext({ tracking: false }, [onlyStart(3)]), { tracking: false });
});

test('11 · symptoms repeat across cycles → recurring cycle-associated pattern', () => {
  const p = recurringPattern({ cycles, symptoms, days });
  assert.equal(p.detected, true);
  assert.doesNotMatch(JSON.stringify(p), /endometriosis/i);
});

test('12 · real user with nothing reported → no fabricated values', () => {
  const c = cycleContext({ tracking: true, lengthUnknown: true }, []);
  assert.equal(c.length.days, null, 'no default 28-day cycle presented as personal');
  assert.equal(c.nextPeriod, undefined);
  assert.equal(c.periodLength.days, null);
  const c2 = cycleContext({ tracking: true, lengthUnknown: true }, [onlyStart(4)]);
  assert.equal(c2.nextPeriod, null, 'no expected period date without a known length');
  assert.equal(c2.period.status, 'unknown', 'period status not invented without a duration');
  assert.equal(c2.phase.name, 'uncertain');
});

test('a gap of more than 45 days is flagged as a possible missing cycle, not used as a cycle length', () => {
  const cs = recomputeLengths([onlyStart(78), onlyStart(22)]);
  assert.equal(cs[0].possibleGap, true);
  assert.equal(cycleBaselineStats([onlyStart(78), onlyStart(22)]).cycles_used, 0);
  assert.equal(cycleContext({ tracking: true, lengthUnknown: true }, [onlyStart(78), onlyStart(22)]).length.days, null);
});
