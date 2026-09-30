// Realistic physiological signal generator shared by the simulator (and later the demo engine).
// Produces one sample set for a given timestamp, persona and profile.

export const PROFILES = ['normal', 'apnea', 'endo'];

const rand = (a, b) => a + Math.random() * (b - a);
const gauss = (sd = 1) => {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
};
const round = (v, d = 0) => +v.toFixed(d);

export function isAsleep(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  return h >= 23 || h < 7;
}

/**
 * persona: { hrBase, spo2Base, tempBase, respBase, sysBase, diaBase, stepsPerMin }
 * profile: 'normal' | 'apnea' | 'endo'
 * opts: { dayIndex, intervalSec, abnormal } — `abnormal` switches the profile's pattern on (e.g. only on later nights)
 */
export function sample(date, persona, profile = 'normal', opts = {}) {
  const { intervalSec = 5, abnormal = profile !== 'normal', dayIndex = 0 } = opts;
  const h = date.getHours() + date.getMinutes() / 60;
  const asleep = isAsleep(date);
  const circ = Math.sin(((h - 11) / 24) * 2 * Math.PI); // peaks ~17:00

  // Endometriosis-associated flare: first 3 days of every 28-day cycle
  const flare = profile === 'endo' && abnormal && dayIndex % 28 < 3;

  // Activity
  const activeBurst = !asleep && Math.random() < 0.18;
  // ~10% of the night is spent awake / restless (brief awakenings, falling asleep)
  const nightWake = asleep && Math.random() < 0.1;
  let movement = asleep ? (nightWake ? rand(0.15, 0.4) : Math.abs(gauss(0.03))) : activeBurst ? rand(0.5, 1) : rand(0.05, 0.35);
  if (flare) movement *= asleep ? 2.2 : 0.55; // restless nights, less daytime activity
  const stepsPerMin = asleep ? 0 : activeBurst ? persona.stepsPerMin * rand(3, 6) : persona.stepsPerMin * rand(0, 1.2);
  const steps = Math.round(stepsPerMin * (intervalSec / 60) * (flare ? 0.5 : 1));

  // Heart rate
  let hr = persona.hrBase + 4 * circ + (asleep ? -14 : 0) + movement * 25 + gauss(2);
  if (flare) hr += 6;

  // Respiration & SpO2
  let resp = persona.respBase + (asleep ? -2 : 0) + movement * 4 + gauss(0.6);
  let spo2 = persona.spo2Base + gauss(0.5);

  // Obstructive-apnea-like event at night: breathing pause then desaturation + HR surge
  let apneaEvent = false;
  if (profile === 'apnea' && abnormal && asleep && Math.random() < 0.12) {
    apneaEvent = true;
    resp = rand(2, 6);
    spo2 = persona.spo2Base - rand(4, 9);
    hr += rand(6, 14);
    movement += rand(0.1, 0.3); // arousal
  }

  const temp = persona.tempBase + 0.25 * circ + (asleep ? -0.2 : 0) + (flare ? 0.25 : 0) + gauss(0.05);
  const sys = persona.sysBase + (asleep ? -8 : 0) + movement * 10 + gauss(2.5);
  const dia = persona.diaBase + (asleep ? -5 : 0) + movement * 5 + gauss(1.8);

  // Position: 0 upright, 1 supine, 2 left, 3 right, 4 prone
  const position = asleep ? [1, 1, 2, 3, 4][Math.floor(Math.random() * 5)] : 0;

  // Sensor quality drops with motion
  const q = (base) => round(Math.max(0.5, Math.min(0.99, base - movement * 0.25 + gauss(0.02))), 2);

  return {
    apneaEvent,
    readings: [
      { metric: 'hr', value: round(Math.max(40, hr)), quality: q(0.97) },
      { metric: 'spo2', value: round(Math.min(100, spo2)), quality: q(0.95) },
      { metric: 'resp', value: round(Math.max(0, resp), 1), quality: q(0.9) },
      { metric: 'temp', value: round(temp, 2), quality: q(0.98) },
      { metric: 'bp_sys', value: round(sys), quality: q(0.9) },
      { metric: 'bp_dia', value: round(dia), quality: q(0.9) },
      { metric: 'movement', value: round(movement, 3), quality: 0.99 },
      { metric: 'position', value: position, quality: 0.99 },
      { metric: 'steps', value: steps, quality: q(0.92) },
    ],
  };
}

// stepsPerMin 5 ≈ 6,000–8,000 steps/day with the activity bursts above
export const DEFAULT_PERSONA = { hrBase: 74, spo2Base: 98, tempBase: 36.6, respBase: 15, sysBase: 120, diaBase: 80, stepsPerMin: 5 };
