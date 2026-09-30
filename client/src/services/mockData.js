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

const RANGE_POINTS = { '1H': 12, '6H': 18, '24H': 24, '7D': 28 };

export function mockHeartRateSeries(range) {
  const n = RANGE_POINTS[range] || 24;
  return Array.from({ length: n }, (_, i) => ({
    label: range === '7D' ? `D${Math.floor(i / 4) + 1}` : `${8 + Math.floor((i * 6) / n)}:${String((i * 5) % 60).padStart(2, '0')}`,
    bpm: Math.round(76 + 4 * Math.sin(i / 2) + 3 * Math.cos(i / 3.3)),
  }));
}
