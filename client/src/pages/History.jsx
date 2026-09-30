import { useEffect, useState } from 'react';
import { Download, CheckCircle2, AlertCircle } from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Segmented from '../components/common/Segmented.jsx';
import SourceBadge from '../components/common/SourceBadge.jsx';
import CycleCard from '../components/history/CycleCard.jsx';
import { getReadings, getCycles } from '../services/healthService.js';
import { useInput } from '../context/InputContext.jsx';

const FILTERS = { All: null, 'Heart Rate': 'hr', 'Blood Oxygen': 'spo2', Temperature: 'temp', 'Blood Pressure': 'bp_sys', Respiration: 'resp' };
const PAGE = 10;
const fmt = (d) => `${new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

function exportCsv(items) {
  const head = 'time,parameter,value,unit,source,confidence,in_range\n';
  const body = items.map((r) => [new Date(r.ts).toISOString(), r.name, r.value, r.unit, r.source, r.confidence, r.inRange].join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([head + body], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'healthsense-history.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

export default function History() {
  const [view, setView] = useState('Cycles');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [readings, setReadings] = useState({ total: 0, items: [] });
  const [cycles, setCycles] = useState(null);

  const { version } = useInput();
  useEffect(() => { getCycles(14).then(setCycles).catch(() => setCycles([])); }, [version]);
  useEffect(() => {
    let alive = true;
    getReadings(FILTERS[filter], page, PAGE).then((d) => alive && setReadings(d)).catch(() => {});
    return () => { alive = false; };
  }, [filter, page]);

  const pages = Math.max(1, Math.ceil(readings.total / PAGE));
  const closed = (cycles || []).filter((c) => c.status === 'closed');
  const avgCompleteness = closed.length ? Math.round((closed.reduce((a, c) => a + c.completeness, 0) / closed.length) * 100) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Records archive"
        title="History"
        subtitle="Every 24-hour monitoring cycle and every measurement recorded by your watch."
        right={
          <button onClick={() => exportCsv(readings.items)} className="card flex items-center gap-2 px-4 py-2.5 text-xs text-ink-soft hover:bg-brand-50/60">
            <Download size={14} /> Export CSV
          </button>
        }
      />

      <section className="card grid gap-6 p-6 sm:grid-cols-3">
        {[
          [cycles ? cycles.length : '—', 'Monitoring cycles'],
          [avgCompleteness == null ? '—' : `${avgCompleteness}%`, 'Avg data completeness'],
          [readings.total.toLocaleString(), 'Vital readings recorded'],
        ].map(([v, l]) => (
          <div key={l}>
            <p className="text-2xl font-medium text-brand-700">{v}</p>
            <p className="mt-2 text-xs text-ink-mute">{l}</p>
          </div>
        ))}
      </section>

      <div className="flex justify-start">
        <Segmented options={['Cycles', 'Readings']} value={view} onChange={setView} />
      </div>

      {view === 'Cycles' ? (
        <section>
          <div className="mb-5">
            <p className="eyebrow">24-hour monitoring</p>
            <h2 className="mt-2 text-xl font-medium">Monitoring Cycles</h2>
            <p className="mt-1 text-xs text-ink-mute">Each cycle covers one day. Tap a cycle to see its full 24-hour timeline.</p>
          </div>
          <div className="space-y-4">
            {cycles === null && <p className="text-sm text-ink-soft">Loading…</p>}
            {cycles?.length === 0 && <p className="card p-6 text-sm text-ink-soft">No cycles yet. Cycles are created automatically once your watch or the simulator sends data.</p>}
            {cycles?.map((c) => <CycleCard key={c.id} cycle={c} />)}
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Measurement log</p>
              <h2 className="mt-2 text-xl font-medium">Recorded Readings</h2>
            </div>
            <Segmented options={Object.keys(FILTERS)} value={filter} onChange={(f) => { setFilter(f); setPage(0); }} />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-mute">
                  {['Time', 'Parameter', 'Value', 'Status', 'Source'].map((h) => <th key={h} className="px-6 py-4 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {readings.items.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/30">
                    <td className="px-6 py-3.5 text-ink-soft">{fmt(r.ts)}</td>
                    <td className="px-6 py-3.5 font-medium">{r.name}</td>
                    <td className="px-6 py-3.5">{r.value} <span className="text-xs text-ink-mute">{r.unit}</span></td>
                    <td className="px-6 py-3.5">
                      {r.inRange
                        ? <span className="flex items-center gap-1.5 text-xs text-brand-700"><CheckCircle2 size={14} /> In range</span>
                        : <span className="flex items-center gap-1.5 text-xs text-amber-700"><AlertCircle size={14} /> Out of range</span>}
                    </td>
                    <td className="px-6 py-3.5"><SourceBadge source={r.source} confidence={r.confidence} /></td>
                  </tr>
                ))}
                {!readings.items.length && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-ink-soft">No readings recorded yet.</td></tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-line px-6 py-3 text-xs text-ink-mute">
              <span>{readings.total ? `Showing ${page * PAGE + 1}–${Math.min((page + 1) * PAGE, readings.total)} of ${readings.total.toLocaleString()}` : '—'}</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Previous</button>
                <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
