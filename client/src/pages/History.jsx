import { useMemo, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Segmented from '../components/common/Segmented.jsx';
import LiveDot from '../components/common/LiveDot.jsx';

const PARAMS = {
  'Heart Rate': { unit: 'BPM', base: 77, amp: 4 },
  'Blood Oxygen': { unit: '% SpO₂', base: 98, amp: 1 },
  Temperature: { unit: '°C', base: 36.6, amp: 0.2 },
  'Blood Pressure': { unit: 'mmHg', base: 120, amp: 3 },
};

// Placeholder records; replace with GET /api/health when the backend exists.
const RECORDS = Array.from({ length: 48 }, (_, i) => {
  const name = Object.keys(PARAMS)[i % 4];
  const p = PARAMS[name];
  const raw = p.base + p.amp * Math.sin(i * 1.3);
  const value = name === 'Blood Pressure' ? `${Math.round(raw)} / ${Math.round(80 + 2 * Math.sin(i))}` : name === 'Temperature' ? raw.toFixed(1) : Math.round(raw);
  const t = new Date(2024, 9, 24, 10, 27 - Math.floor(i / 4) * 15, 0);
  return { id: i, name, unit: p.unit, value, time: t, source: 'HealthSense Watch' };
});

const PAGE = 10;
const fmt = (d) => `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

export default function History() {
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => (filter === 'All' ? RECORDS : RECORDS.filter((r) => r.name === filter)), [filter]);
  const pages = Math.ceil(rows.length / PAGE);
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Records archive"
        title="History"
        subtitle="Review every measurement recorded by your connected watch."
        right={
          <button className="card flex items-center gap-2 px-4 py-2.5 text-xs text-ink-soft hover:bg-brand-50/60">
            <Download size={14} /> Export CSV
          </button>
        }
      />

      <section className="card grid gap-6 p-6 sm:grid-cols-3">
        {[[RECORDS.length, 'Records in period'], ['0', 'Out-of-range readings'], ['Today, 10:27 AM', 'Latest record']].map(([v, l]) => (
          <div key={l}>
            <p className="text-2xl font-medium text-brand-700">{v}</p>
            <p className="mt-2 text-xs text-ink-mute">{l}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Measurement log</p>
            <h2 className="mt-2 text-xl font-medium">Recorded Readings</h2>
          </div>
          <Segmented options={['All', ...Object.keys(PARAMS)]} value={filter} onChange={(f) => { setFilter(f); setPage(0); }} />
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-mute">
                {['Time', 'Parameter', 'Value', 'Status', 'Source'].map((h) => <th key={h} className="px-6 py-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50/30">
                  <td className="px-6 py-3.5 text-ink-soft">{fmt(r.time)}</td>
                  <td className="px-6 py-3.5 font-medium">{r.name}</td>
                  <td className="px-6 py-3.5">{r.value} <span className="text-xs text-ink-mute">{r.unit}</span></td>
                  <td className="px-6 py-3.5"><span className="flex items-center gap-1.5 text-xs text-brand-700"><CheckCircle2 size={14} /> In range</span></td>
                  <td className="px-6 py-3.5 text-xs text-ink-soft"><span className="flex items-center gap-1.5"><LiveDot className="!h-1.5 !w-1.5" /> {r.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line px-6 py-3 text-xs text-ink-mute">
            <span>Showing {page * PAGE + 1}–{Math.min((page + 1) * PAGE, rows.length)} of {rows.length}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Previous</button>
              <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
