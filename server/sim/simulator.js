#!/usr/bin/env node
// HealthSense sensor simulator — posts the exact same payload as the ESP32 firmware.
//
// Usage (from server/):
//   node sim/simulator.js --email you@x.com --password secret [options]
//   node sim/simulator.js --key <deviceKey> [options]
//
// Options:
//   --api <url>          API base (default http://localhost:5000/api)
//   --profile <p>        normal | apnea | endo            (default normal)
//   --backfill <days>    first upload N days of history (5-min resolution)
//   --abnormal-from <d>  in backfill, profile pattern starts on day d (0 = oldest; default: last 2 days)
//   --live               then stream live readings (default on unless --no-live)
//   --no-live            only backfill
//   --interval <sec>     live upload interval (default 5)
//   --gap <0-1>          probability of dropping each reading (missing data)
//   --drop <m1,m2>       never send these metrics (e.g. steps,spo2)
//   --hr-base <bpm>      persona resting HR (default 74) — use different values for different users
//   --device <id>        device id (default HS-SIM-001)

import { sample, isAsleep, PROFILES, DEFAULT_PERSONA } from './generator.js';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const next = args[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
};

const API = flag('api', 'http://localhost:5000/api');
const profile = flag('profile', 'normal');
const backfillDays = Number(flag('backfill', 0));
const live = !args.includes('--no-live');
const intervalSec = Number(flag('interval', 5));
const gap = Number(flag('gap', 0));
const drop = String(flag('drop', '')).split(',').filter(Boolean);
const deviceId = flag('device', 'HS-SIM-001');
const persona = { ...DEFAULT_PERSONA, hrBase: Number(flag('hr-base', DEFAULT_PERSONA.hrBase)) };
const abnormalFrom = Number(flag('abnormal-from', Math.max(0, backfillDays - 2)));

if (!PROFILES.includes(profile)) {
  console.error(`Unknown profile "${profile}". Use one of: ${PROFILES.join(', ')}`);
  process.exit(1);
}

async function getDeviceKey() {
  const key = flag('key');
  if (key) return key;
  const email = flag('email');
  const password = flag('password');
  if (!email || !password) {
    console.error('Provide --key <deviceKey> or --email and --password');
    process.exit(1);
  }
  const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`Login failed: ${(await login.json()).message}`);
  const { token } = await login.json();
  const res = await fetch(`${API}/users/me/device-key`, { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()).deviceKey;
}

let battery = 100;

async function post(key, readings) {
  const res = await fetch(`${API}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-key': key },
    body: JSON.stringify({ deviceId, firmware: 'sim-1.0', battery: Math.round(battery), mode: 'simulation', readings }),
  });
  if (!res.ok) throw new Error(`Ingest failed ${res.status}: ${await res.text()}`);
  return res.json();
}

const keep = (r) => !drop.includes(r.metric) && Math.random() >= gap;

async function backfill(key) {
  const step = 5 * 60_000;
  const end = Date.now() - 60_000;
  const start = end - backfillDays * 24 * 3600_000;
  let batch = [];
  let sent = 0;
  let apnea = 0;
  for (let t = start; t < end; t += step) {
    const date = new Date(t);
    const dayIndex = Math.floor((t - start) / (24 * 3600_000));
    const s = sample(date, persona, profile, { dayIndex, intervalSec: 300, abnormal: profile !== 'normal' && dayIndex >= abnormalFrom });
    if (s.apneaEvent) apnea += 1;
    for (const r of s.readings.filter(keep)) batch.push({ ...r, ts: t });
    if (batch.length >= 4000) {
      sent += (await post(key, batch)).accepted;
      batch = [];
      process.stdout.write(`\r  backfill: ${sent} readings`);
    }
  }
  if (batch.length) sent += (await post(key, batch)).accepted;
  console.log(`\r  backfill: ${sent} readings over ${backfillDays} day(s)${profile === 'apnea' ? `, ${apnea} simulated night events` : ''}`);
}

// Closed loop on the device side: poll the server's monitoring priority and adapt sampling.
let config = { sampleIntervalSec: intervalSec, priority: [], nightBoost: false, reason: 'Standard monitoring' };
async function pollConfig(key) {
  try {
    const res = await fetch(`${API}/device/config`, { headers: { 'x-device-key': key } });
    if (!res.ok) return;
    const next = await res.json();
    if (next.reason !== config.reason) console.log(`
  [config] ${next.priority.length ? `priority: ${next.priority.join(', ')} · every ${next.sampleIntervalSec}s${next.nightBoost ? ' at night' : ''}` : 'standard monitoring'} — ${next.reason}`);
    config = next;
  } catch { /* offline: keep the last config */ }
}

function currentInterval() {
  // Priority sampling applies at night when nightBoost is set, otherwise all day
  const boosted = config.priority.length && (!config.nightBoost || isAsleep(new Date()));
  return boosted ? Math.min(intervalSec, config.sampleIntervalSec) : intervalSec;
}

async function stream(key) {
  console.log(`  live: every ${intervalSec}s (Ctrl+C to stop)`);
  await pollConfig(key);
  setInterval(() => pollConfig(key), 30_000);
  const dayIndex = backfillDays;
  const tick = async () => {
    const every = currentInterval();
    battery = Math.max(5, battery - 0.002 * every);
    const s = sample(new Date(), persona, profile, { dayIndex, intervalSec: every });
    const readings = s.readings.filter(keep);
    try {
      await post(key, readings);
      process.stdout.write(`  live: HR ${s.readings[0].value}  SpO2 ${s.readings[1].value}  resp ${s.readings[2].value}  (${every}s)${s.apneaEvent ? '  [night event]' : '              '}`);
    } catch (e) {
      console.error(`
  ${e.message}`);
    }
    setTimeout(tick, every * 1000);
  };
  await tick();
}

(async () => {
  try {
    const key = await getDeviceKey();
    console.log(`HealthSense simulator → ${API}  profile=${profile}  hrBase=${persona.hrBase}${gap ? `  gap=${gap}` : ''}${drop.length ? `  drop=${drop}` : ''}`);
    if (backfillDays > 0) await backfill(key);
    if (live) await stream(key);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
