// Missing-data & confidence engine (spec §27-F). Pure functions.
//
// For every missing field in a cycle:
//   1. Can it be obtained from sensors?   → device online + sensor for it  → 'awaiting_sensor'
//   2. Can it be safely estimated?        → estimate with confidence ≥ 0.7 → 'estimated'
//   3. Otherwise                          → ask the user                   → 'asked'
import { round } from './stats.js';

export const MIN_ESTIMATE_CONFIDENCE = 0.7;

// Fields a wrist sensor can provide
const SENSOR_FIELDS = new Set(['hr', 'spo2', 'resp', 'temp', 'movement', 'steps']);
// Clinically important fields that must never be guessed (spec: "if the system cannot safely estimate… request input")
const NEVER_ESTIMATE = new Set(['spo2', 'resp']);

const LABEL = { hr: 'heart rate', spo2: 'blood oxygen', resp: 'breathing', temp: 'temperature', movement: 'movement', steps: 'activity', sleep: 'sleep' };

/**
 * ctx: {
 *   deviceOnline: boolean,          // data received in the last 30 min
 *   baseline: { metrics: { sleep: {mean, sd, n}, steps: {...}, ... }, established },
 *   coverage: { movement: 0-1, ... } // hourly coverage of this cycle
 *   isOpen: boolean,                // cycle still in progress
 *   hoursElapsed: number,
 * }
 * returns [{ field, resolution, estimate?: { value, confidence, method }, question?: {...} }]
 */
export function resolveMissing(missing, ctx) {
  return missing.map(({ field }) => {
    // 1. Sensor
    if (SENSOR_FIELDS.has(field) && ctx.deviceOnline && ctx.isOpen) {
      return { field, resolution: 'awaiting_sensor', reason: `Your watch is online; ${LABEL[field]} data is still arriving.` };
    }

    // 2. Estimate
    const est = estimate(field, ctx);
    if (est && est.confidence >= MIN_ESTIMATE_CONFIDENCE) {
      return { field, resolution: 'estimated', estimate: est, reason: `Estimated from ${est.method} (${Math.round(est.confidence * 100)}% confidence).` };
    }

    // 3. Ask
    const question = questionFor(field, est);
    if (question) return { field, resolution: 'asked', question, reason: question.reason };
    return { field, resolution: 'unresolved', reason: `No safe way to fill ${LABEL[field] || field} yet.` };
  });
}

/** Best estimate we can make for a field, or null. Confidence may be below the threshold. */
export function estimate(field, ctx) {
  if (NEVER_ESTIMATE.has(field)) return null;
  const b = ctx.baseline?.metrics?.[field];

  if (field === 'sleep') {
    if (!b || !ctx.baseline.established) return null;
    // Only history available: confidence grows with days of history, penalised by variability
    const variability = b.mean ? b.sd / b.mean : 1;
    const conf = round(Math.min(0.85, 0.45 + 0.04 * (b.n || 0)) - variability, 2);
    return { value: round(b.mean, 1), confidence: Math.max(0, conf), method: `your ${b.n}-day sleep history` };
  }

  if (field === 'steps') {
    // With movement data we can estimate activity well; without it only from history (weak)
    const mov = ctx.coverage?.movement ?? 0;
    if (mov >= 0.5 && ctx.movementSteps != null) {
      return { value: Math.round(ctx.movementSteps), confidence: round(0.6 + 0.3 * mov, 2), method: 'movement sensor data' };
    }
    if (b && ctx.baseline.established) {
      const conf = round(0.5 + 0.02 * (b.n || 0), 2);
      return { value: Math.round(b.mean * (ctx.isOpen ? Math.min(1, (ctx.hoursElapsed || 24) / 24) : 1)), confidence: conf, method: 'your activity history' };
    }
    return null;
  }

  if ((field === 'hr' || field === 'temp') && b && ctx.baseline.established) {
    // Physiological values are only estimated for a closed cycle, and weakly
    return { value: b.mean, confidence: 0.6, method: 'your baseline' };
  }
  return null;
}

/** Question template for a field that could not be filled. */
export function questionFor(field, est) {
  switch (field) {
    case 'sleep':
      return {
        code: 'missing.sleep', field, kind: 'number', unit: 'hours', min: 0, max: 16, step: 0.5, suggested: est?.value ?? null,
        text: 'How many hours did you sleep last night?',
        reason: est ? `We could only guess about ${est.value} h (${Math.round(est.confidence * 100)}% confidence), which is too uncertain to use.` : 'Your watch did not record enough of last night to estimate your sleep.',
      };
    case 'steps':
      return {
        code: 'missing.steps', field, kind: 'choice', options: ['Mostly resting', 'Light activity', 'Moderately active', 'Very active'],
        text: 'How active were you today?',
        reason: 'Activity data is missing and could not be estimated reliably.',
      };
    case 'spo2':
    case 'resp':
      return {
        code: 'missing.wear', field, kind: 'yesno',
        text: 'Were you wearing your watch last night?',
        reason: `No ${LABEL[field]} readings were recorded. Breathing and oxygen are never guessed, so we need to know why they are missing.`,
      };
    default:
      return null;
  }
}

/** Convert a choice answer for steps into a reported step count. */
export const ACTIVITY_STEPS = { 'Mostly resting': 2500, 'Light activity': 5500, 'Moderately active': 8500, 'Very active': 12000 };
