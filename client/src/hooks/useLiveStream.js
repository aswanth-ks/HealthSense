import { useEffect, useRef, useState } from 'react';
import { getLiveSnapshot, isDemo } from '../services/healthService.js';
import { onLive } from '../services/socket.js';

const WAVE_LEN = 24;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const jitter = (v, amt, lo, hi) => clamp(v + (Math.random() - 0.5) * amt, lo, hi);
const toWave = (hr, prev) => [...prev.slice(1), clamp((hr - 50) / 50, 0.2, 1)];

const METRIC_KEYS = { hr: 'hr', spo2: 'spo2', temp: 'temp', resp: 'resp', bp_sys: 'sys', bp_dia: 'dia', movement: 'movement' };
const SIGNAL_KEYS = { hr: 'hr', spo2: 'spo2', temp: 'temp', bp_sys: 'bp', resp: 'resp', movement: 'movement' };

const EMPTY = {
  hr: null, spo2: null, temp: null, sys: null, dia: null, resp: null, movement: null,
  wave: Array(WAVE_LEN).fill(0.2),
  packets: 0, latency: null, uptime: 0, lastPacket: null, battery: null, deviceId: '—',
  signal: {}, sources: {}, connected: false, mode: '', live: true,
};

function applyReadings(s, readings, device) {
  const next = { ...s, signal: { ...s.signal }, sources: { ...s.sources } };
  for (const r of readings) {
    const k = METRIC_KEYS[r.metric];
    if (k) next[k] = r.value;
    if (SIGNAL_KEYS[r.metric]) next.signal[SIGNAL_KEYS[r.metric]] = Math.round((r.confidence ?? 0) * 100);
    next.sources[r.metric] = { source: r.source, confidence: r.confidence };
    if (r.metric === 'hr') next.wave = toWave(r.value, next.wave);
    const ts = new Date(r.ts);
    if (!next.lastPacket || ts > next.lastPacket) next.lastPacket = ts;
  }
  if (device) {
    next.packets = device.packets;
    next.latency = device.latencyMs;
    next.uptime = device.uptimeSec;
    next.battery = device.battery;
    next.deviceId = device.id;
    next.connected = device.connected;
    next.mode = device.mode;
  }
  return next;
}

// Demo mode: local simulation (unchanged behaviour when no backend / not signed in).
function useSimulated() {
  const [state, setState] = useState(() => ({
    ...EMPTY, hr: 79, spo2: 98, temp: 36.7, sys: 120, dia: 80, resp: 15, movement: 0.2,
    wave: Array.from({ length: WAVE_LEN }, () => 0.3 + Math.random() * 0.7),
    packets: 1248, latency: 42, uptime: 6 * 3600 + 18 * 60, lastPacket: new Date(), battery: 84, deviceId: 'HS-WATCH-001',
    signal: { hr: 99, spo2: 98, temp: 97, bp: 99, resp: 95, movement: 99 }, connected: true, mode: 'simulation', demo: true,
  }));
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => ({
        ...s,
        hr: Math.round(jitter(s.hr, 3, 68, 92)),
        spo2: Math.round(jitter(s.spo2, 1.5, 96, 99)),
        temp: +jitter(s.temp, 0.06, 36.4, 37.0).toFixed(1),
        sys: Math.round(jitter(s.sys, 3, 114, 126)),
        dia: Math.round(jitter(s.dia, 2, 76, 84)),
        resp: +jitter(s.resp, 1, 12, 18).toFixed(1),
        movement: +jitter(s.movement, 0.1, 0, 1).toFixed(2),
        wave: [...s.wave.slice(1), 0.25 + Math.random() * 0.75],
        packets: s.packets + 1,
        latency: Math.round(jitter(s.latency, 6, 30, 60)),
        uptime: s.uptime + 1,
        lastPacket: new Date(),
        signal: Object.fromEntries(Object.entries(s.signal).map(([k, v]) => [k, Math.round(jitter(v, 1, 94, 100))])),
      }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return state;
}

// Signed in: snapshot from /api/me/live, then Socket.IO pushes from the device/simulator.
function useRealStream() {
  const [state, setState] = useState(EMPTY);
  const uptimeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getLiveSnapshot().then((snap) => {
      if (!alive || !snap) return;
      const readings = Object.entries(snap.latest).map(([metric, r]) => ({ metric, ...r }));
      setState((s) => {
        let next = applyReadings(s, readings, snap.device);
        next.wave = [...Array(WAVE_LEN).fill(0.2), ...snap.hrSeries.map((p) => clamp((p.value - 50) / 50, 0.2, 1))].slice(-WAVE_LEN);
        return next;
      });
    });

    // Push (Socket.IO) when available; otherwise poll the latest snapshot every 5 s.
    const onReadings = (payload) => {
      if (payload?.readings) return setState((s) => applyReadings(s, payload.readings, payload.device));
      return getLiveSnapshot().then((snap) => {
        if (!alive || !snap) return;
        const readings = Object.entries(snap.latest).map(([metric, r]) => ({ metric, ...r }));
        setState((s) => (readings.some((r) => !s.lastPacket || new Date(r.ts) > s.lastPacket) ? applyReadings(s, readings, snap.device) : s));
      }).catch(() => {});
    };
    const unsubscribe = onLive('readings', onReadings, 5_000);

    // Tick uptime + flip to "offline" if the device goes quiet
    uptimeRef.current = setInterval(() => {
      setState((s) => ({
        ...s,
        uptime: s.connected ? s.uptime + 1 : s.uptime,
        connected: s.lastPacket ? Date.now() - s.lastPacket.getTime() < 30_000 : false,
      }));
    }, 1000);

    return () => {
      alive = false;
      unsubscribe();
      clearInterval(uptimeRef.current);
    };
  }, []);

  return state;
}

export default function useLiveStream() {
  // isDemo() is stable for the lifetime of the page (changes only on login/logout).
  return isDemo() ? useSimulated() : useRealStream(); // eslint-disable-line react-hooks/rules-of-hooks
}
