import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCycle, cycleWindow } from '../engines/cycleEngine.js';
import { buildBaseline, interpret } from '../engines/baselineEngine.js';
import { sample, DEFAULT_PERSONA } from '../sim/generator.js';

// Build one day of 5-minute readings for a persona, optionally dropping metrics.
function day(start, persona, { drop = [] } = {}) {
  const out = [];
  for (let t = start.getTime(); t < start.getTime() + 24 * 3600_000; t += 300_000) {
    for (const r of sample(new Date(t), persona, 'normal', { intervalSec: 300 }).readings) {
      if (!drop.includes(r.metric)) out.push({ metric: r.metric, value: r.value, ts: new Date(t), source: 'measured', confidence: r.quality });
    }
  }
  return out;
}

const pastDay = (n) => cycleWindow(new Date(Date.now() - n * 24 * 3600_000)).start;

function cyclesFor(persona, days = 5) {
  return Array.from({ length: days }, (_, i) => {
    const start = pastDay(i + 1);
    const end = new Date(start.getTime() + 24 * 3600_000);
    return { start, ...summarizeCycle(day(start, persona), start, end) };
  });
}

test('complete day → high completeness, no missing sensor fields, sleep estimated', () => {
  const start = pastDay(1);
  const c = summarizeCycle(day(start, DEFAULT_PERSONA), start, new Date(start.getTime() + 24 * 3600_000));
  assert.ok(c.completeness >= 0.95, `completeness ${c.completeness}`);
  assert.equal(c.missing.length, 0);
  assert.equal(c.sleep.source, 'estimated');
  assert.ok(c.sleep.hours > 4 && c.sleep.hours <= 8, `sleep ${c.sleep.hours}`);
  assert.equal(c.activity.source, 'measured');
});

test('missing SpO2 sensor → lower completeness and spo2 listed as missing', () => {
  const start = pastDay(1);
  const c = summarizeCycle(day(start, DEFAULT_PERSONA, { drop: ['spo2'] }), start, new Date(start.getTime() + 24 * 3600_000));
  assert.ok(c.completeness <= 0.81);
  assert.ok(c.missing.some((m) => m.field === 'spo2'));
});

test('reported sleep overrides the estimate', () => {
  const start = pastDay(1);
  const c = summarizeCycle(day(start, DEFAULT_PERSONA), start, new Date(start.getTime() + 24 * 3600_000), { sleepHours: 5.5 });
  assert.deepEqual([c.sleep.hours, c.sleep.source, c.sleep.confidence], [5.5, 'reported', 1]);
});

test('baseline needs 3 complete days', () => {
  assert.equal(buildBaseline(cyclesFor(DEFAULT_PERSONA, 2)).established, false);
  const b = buildBaseline(cyclesFor(DEFAULT_PERSONA, 3));
  assert.equal(b.established, true);
  for (const m of ['hr', 'spo2', 'temp', 'resp', 'steps', 'sleep']) assert.ok(b.metrics[m], `baseline for ${m}`);
});

test('same heart rate is interpreted differently for two users (spec §27-D)', () => {
  const athlete = buildBaseline(cyclesFor({ ...DEFAULT_PERSONA, hrBase: 58 }));
  const typical = buildBaseline(cyclesFor({ ...DEFAULT_PERSONA, hrBase: 80 }));
  const hr = Math.round((athlete.metrics.hr.mean + typical.metrics.hr.mean) / 2 + 6);
  const a = interpret('hr', hr, athlete.metrics.hr, 'Heart rate');
  const t = interpret('hr', hr, typical.metrics.hr, 'Heart rate');
  assert.notEqual(a.band, t.band, `${hr} BPM: athlete=${a.band} typical=${t.band}`);
  assert.ok(a.z > t.z);
});
