import { useEffect, useState } from 'react';

const WAVE_LEN = 24;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const jitter = (v, amt, lo, hi) => clamp(v + (Math.random() - 0.5) * amt, lo, hi);

// Simulated live stream (1 tick/sec). Swap the interval body for a WebSocket/SSE
// or polling call to the backend when it exists.
export default function useLiveStream() {
  const [state, setState] = useState(() => ({
    hr: 79, spo2: 98, temp: 36.7, sys: 120, dia: 80,
    wave: Array.from({ length: WAVE_LEN }, () => 0.3 + Math.random() * 0.7),
    packets: 1248, latency: 42, uptime: 6 * 3600 + 18 * 60, lastPacket: new Date(),
    signal: { hr: 99, spo2: 98, temp: 97, bp: 99 },
  }));

  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => ({
        hr: Math.round(jitter(s.hr, 3, 68, 92)),
        spo2: Math.round(jitter(s.spo2, 1.5, 96, 99)),
        temp: +jitter(s.temp, 0.06, 36.4, 37.0).toFixed(1),
        sys: Math.round(jitter(s.sys, 3, 114, 126)),
        dia: Math.round(jitter(s.dia, 2, 76, 84)),
        wave: [...s.wave.slice(1), 0.25 + Math.random() * 0.75],
        packets: s.packets + 1,
        latency: Math.round(jitter(s.latency, 6, 30, 60)),
        uptime: s.uptime + 1,
        lastPacket: new Date(),
        signal: {
          hr: Math.round(jitter(s.signal.hr, 1, 96, 100)),
          spo2: Math.round(jitter(s.signal.spo2, 1, 95, 100)),
          temp: Math.round(jitter(s.signal.temp, 1, 94, 99)),
          bp: Math.round(jitter(s.signal.bp, 1, 96, 100)),
        },
      }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}
