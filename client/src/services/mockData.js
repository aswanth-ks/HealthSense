export const mockOverview = {
  user: { name: 'Aswanth', initials: 'AS' },
  device: { name: 'HealthSense Watch', id: 'HS-WATCH-001', battery: 84, wifi: true, connected: true },
  status: { label: 'Stable', note: 'All readings in range', updatedAt: '10:27:08 AM' },
  vitals: [
    { key: 'hr', label: 'Heart Rate', value: '79', unit: 'BPM', status: 'Normal', source: 'measured', confidence: 0.96, delta: '+2% vs baseline', series: [72, 74, 71, 76, 75, 80, 79] },
    { key: 'spo2', label: 'Blood Oxygen', value: '98', unit: '% SpO₂', status: 'Normal', source: 'measured', confidence: 0.94, delta: 'Stable', series: [97, 98, 97, 98, 96, 98, 98] },
    { key: 'temp', label: 'Temperature', value: '36.7', unit: '°C', status: 'Stable', source: 'measured', confidence: 0.97, delta: '+0.1° today', series: [36.4, 36.5, 36.5, 36.6, 36.6, 36.7, 36.7] },
    { key: 'bp', label: 'Blood Pressure', value: '120 / 80', unit: 'mmHg', status: 'Normal', source: 'estimated', confidence: 0.74, delta: 'Stable', series: [118, 121, 119, 122, 120, 121, 120] },
  ],
  summary: { parameters: 4, available: 4, alerts: 0 },
  insight: 'Your average heart rate today is slightly higher than your recent baseline.',
};

// ---- Health Trends (same shape as GET /api/me/trends) ----
const TREND_POINTS = { '24H': 24, '7D': 28, '30D': 30 };
const TREND_VITALS = [
  { key: 'hr', label: 'Heart Rate', value: '79', unit: 'BPM', base: 78, amp: 3, band: [70, 84], dp: 0 },
  { key: 'spo2', label: 'Blood Oxygen', value: '98', unit: '% SpO₂', base: 98, amp: 0.6, band: [96.5, 99.5], dp: 0 },
  { key: 'temp', label: 'Temperature', value: '36.7', unit: '°C', base: 36.6, amp: 0.15, band: [36.3, 36.9], dp: 2 },
  { key: 'bp', label: 'Blood Pressure', value: '120 / 80', unit: 'mmHg', base: 120, amp: 2.5, band: null, dp: 0 },
  { key: 'resp', label: 'Respiration', value: '15.2', unit: 'br/min', base: 15, amp: 0.8, band: [13, 17], dp: 1 },
];

export function mockTrends(range = '24H') {
  const n = TREND_POINTS[range] || 24;
  const label = (i) => (range === '24H'
    ? `${((i % 12) || 12)} ${i < 12 ? 'AM' : 'PM'}`
    : range === '7D' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Math.floor(i / 4)] : `Day ${i + 1}`);
  return {
    range,
    baseline: { established: true, daysUsed: 7, establishedAt: null, metrics: {} },
    vitals: TREND_VITALS.map((v) => ({
      key: v.key,
      label: v.label,
      unit: v.unit,
      value: v.value,
      data: Array.from({ length: n }, (_, i) => ({ label: label(i), v: +(v.base + v.amp * (Math.sin(i / 5 + v.key.length) * 0.6 + Math.cos(i / 11) * 0.4)).toFixed(v.dp) })),
      band: v.band ? { lo: v.band[0], hi: v.band[1], mean: (v.band[0] + v.band[1]) / 2 } : null,
      interpretation: null,
    })),
    glance: { stable: '5/5', available: 5, avgSignal: 98, exceptions: 0 },
    comparison: [
      { key: 'hr', label: 'Heart Rate', now: '79 BPM', base: '76 BPM avg', delta: '+4%', up: true },
      { key: 'spo2', label: 'Blood Oxygen', now: '98 % SpO₂', base: '98 % SpO₂ avg', delta: '0%' },
      { key: 'temp', label: 'Temperature', now: '36.7 °C', base: '36.6 °C avg', delta: '0%' },
      { key: 'resp', label: 'Respiration', now: '15.2 br/min', base: '15.0 br/min avg', delta: '+1%' },
    ],
    summary: 'Heart rate is tracking slightly above your personal baseline while oxygen, temperature, and breathing remain steady.',
    unusual: false,
  };
}

// ---- History (same shape as GET /api/me/readings and /api/me/cycles) ----
const HIST = [
  ['hr', 'Heart Rate', 'BPM', 77, 4, 0], ['spo2', 'Blood Oxygen', '% SpO₂', 98, 1, 0],
  ['temp', 'Temperature', '°C', 36.6, 0.2, 1], ['bp_sys', 'Blood Pressure (sys)', 'mmHg', 120, 3, 0], ['resp', 'Respiration', 'br/min', 15, 1, 1],
];
const HIST_ROWS = Array.from({ length: 60 }, (_, i) => {
  const [metric, name, unit, base, amp, dp] = HIST[i % HIST.length];
  return {
    id: i, metric, name, unit, value: +(base + amp * Math.sin(i * 1.3)).toFixed(dp),
    ts: new Date(Date.now() - Math.floor(i / HIST.length) * 15 * 60_000).toISOString(),
    source: 'measured', confidence: 0.9 + (i % 9) / 100, deviceId: 'HS-WATCH-001', inRange: true,
  };
});

export function mockReadings(metric, page = 0, limit = 10) {
  const rows = metric ? HIST_ROWS.filter((r) => r.metric === metric) : HIST_ROWS;
  return { total: rows.length, items: rows.slice(page * limit, page * limit + limit) };
}

export function mockCycles() {
  return Array.from({ length: 7 }, (_, i) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const partial = i === 0;
    return {
      id: `mock-${i}`, index: 7 - i, start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString(),
      status: partial ? 'open' : 'closed', completeness: partial ? 0.42 : 0.96 - (i % 3) * 0.03, confidence: partial ? 0.5 : 0.9,
      aggregates: {
        hr: { mean: 74 + (i % 3), confidence: 0.95, source: 'measured' },
        spo2: { mean: 97.8, confidence: 0.94, source: 'measured' },
        temp: { mean: 36.6, confidence: 0.97, source: 'measured' },
        resp: { mean: 14.8, confidence: 0.88, source: 'measured' },
      },
      activity: { steps: partial ? 2400 : 6800 + i * 310, source: 'measured', confidence: 0.9 },
      sleep: { hours: partial ? null : 7.1 - (i % 2) * 0.6, source: partial ? null : 'estimated', confidence: partial ? 0 : 0.78 },
      missing: partial ? [{ field: 'sleep', resolution: 'unresolved' }] : [],
      findings: [], priority: [],
    };
  });
}

const RANGE_POINTS ={ '1H': 12, '6H': 18, '24H': 24, '7D': 28 };

export function mockHeartRateSeries(range) {
  const n = RANGE_POINTS[range] || 24;
  return Array.from({ length: n }, (_, i) => ({
    label: range === '7D' ? `D${Math.floor(i / 4) + 1}` : `${8 + Math.floor((i * 6) / n)}:${String((i * 5) % 60).padStart(2, '0')}`,
    bpm: Math.round(76 + 4 * Math.sin(i / 2) + 3 * Math.cos(i / 3.3)),
  }));
}
