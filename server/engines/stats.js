export function describe(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return null;
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const pct = (p) => v[Math.min(n - 1, Math.max(0, Math.round((p / 100) * (n - 1))))];
  return { mean, sd, p10: pct(10), p90: pct(90), min: v[0], max: v[n - 1], n };
}

export const round = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));
