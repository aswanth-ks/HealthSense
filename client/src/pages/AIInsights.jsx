import { useEffect, useState } from 'react';
import {
  Info, Droplet, Moon, Coffee, Watch, Sparkles, Database, ShieldCheck, TrendingUp, TrendingDown, Stethoscope, ClipboardCheck,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Segmented from '../components/common/Segmented.jsx';
import VitalInsightCard from '../components/insights/VitalInsightCard.jsx';
import TriageBadge, { TriageScale, LEVEL_STYLE } from '../components/triage/TriageBadge.jsx';
import ClosedLoopCard from '../components/triage/ClosedLoopCard.jsx';
import ModuleCard from '../components/triage/ModuleCard.jsx';
import useTriage from '../hooks/useTriage.js';
import { getTrends, isDemo } from '../services/healthService.js';
import { getInsightsFor, TIPS } from '../services/insightsData.js';
import { useInput } from '../context/InputContext.jsx';

const TIP_ICON = { droplet: Droplet, moon: Moon, coffee: Coffee, watch: Watch };
const PERIOD = { Today: '24H', '7D': '7D', '30D': '30D' };
const STANDARD = { hr: [40, 130, 60, 100], spo2: [85, 100, 95, 100], temp: [35, 39, 36, 37.5], bp: [80, 160, 90, 130], resp: [4, 30, 12, 20] };

const SectionTitle = ({ eyebrow, title, right }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-medium">{title}</h2>
    </div>
    {right}
  </div>
);

// Map /api/me/trends vitals to the VitalInsightCard shape (value vs personal band + plain meaning).
function toInsightVital(v) {
  const num = parseFloat(v.value);
  const [min, max, low, high] = v.band
    ? [v.band.lo - (v.band.hi - v.band.lo), v.band.hi + (v.band.hi - v.band.lo), v.band.lo, v.band.hi]
    : STANDARD[v.key];
  const r = (x) => Math.round(x * 10) / 10;
  const band = v.interpretation?.band;
  return {
    key: v.key, label: v.label, unit: v.unit,
    value: Number.isFinite(num) ? num : null,
    display: v.value,
    avg: v.band ? `${r(v.band.mean)} ${v.unit}` : 'standard range',
    delta: v.band && Number.isFinite(num) ? `${num >= v.band.mean ? '+' : ''}${Math.round(((num - v.band.mean) / v.band.mean) * 100)}%` : '—',
    trend: band?.includes('above') ? 'up' : 'flat',
    status: !band || band === 'typical' || band === 'unknown' ? 'Normal' : 'Watch',
    range: { min: r(min), max: r(max), low: r(low), high: r(high) },
    meaning: v.interpretation?.text || (v.band ? 'Within your personal range.' : 'Your personal range is still being learned; compared with standard ranges for now.'),
    series: v.data.slice(-14).map((p) => p.v),
  };
}

export default function AIInsights() {
  const [period, setPeriod] = useState('Today');
  const [trends, setTrends] = useState(null);
  const tri = useTriage();
  const { openCheckin } = useInput();
  const demo = isDemo();

  useEffect(() => { if (!demo) getTrends(PERIOD[period]).then(setTrends).catch(() => setTrends(null)); }, [period, demo]);

  const vitals = demo ? getInsightsFor(period).vitals : (trends?.vitals || []).filter((v) => v.data.length && v.key !== 'bp').map(toInsightVital);
  const cur = tri?.current;
  const style = LEVEL_STYLE[cur?.level] || LEVEL_STYLE.LOW;
  const up = cur?.changed && ['LOW', 'MONITOR', 'MODERATE', 'HIGH'].indexOf(cur.changed.to) > ['LOW', 'MONITOR', 'MODERATE', 'HIGH'].indexOf(cur.changed.from);
  const reasons = (cur?.reasons || []).filter((r) => !r.startsWith('Data confidence'));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="AI-generated interpretation"
        title="AI Insights"
        subtitle="What your readings and answers mean, why the system thinks so, and how monitoring adapts."
        right={<span className="rounded border border-line px-2 py-1 text-[10px] text-ink-soft">BETA</span>}
      />

      {/* 1. Triage: overall verdict with its explanation */}
      <section className="card grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]" style={{ borderColor: `${style.ring}33`, background: `linear-gradient(135deg, ${style.ring}0d, transparent 60%)` }}>
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Sparkles size={13} /> Current triage level</p>
          {cur ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <span className={`text-5xl font-semibold tracking-tight ${style.text}`}>{cur.level}</span>
              </div>
              <p className="mt-2 max-w-sm text-sm text-ink-soft">{style.desc}</p>
              <div className="mt-6 max-w-sm"><TriageScale level={cur.level} /></div>
              <div className="mt-6 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-3 py-1.5 shadow-card">Data confidence <b>{Math.round(cur.confidence * 100)}%</b></span>
                {cur.changed && (
                  <span className={`flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-card ${up ? 'text-amber-700' : 'text-brand-700'}`}>
                    {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {cur.changed.from} → {cur.changed.to}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">{tri === null ? 'Loading…' : 'Not enough data yet. Triage starts once your watch has sent data.'}</p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm font-medium">{cur?.changed ? (up ? 'Risk increased because:' : 'Risk decreased because:') : 'Why this level:'}</p>
          <ul className="mt-3 space-y-2">
            {reasons.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-ink-soft"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.bar}`} />{r}</li>
            ))}
            {cur && <li className="flex gap-2 text-sm font-medium"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />Data confidence: {Math.round(cur.confidence * 100)}%</li>}
          </ul>
          <p className="mt-4 flex gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-mute">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" /> {tri?.disclaimer || 'Risk/triage information, not a diagnosis.'}
          </p>
          {['MODERATE', 'HIGH'].includes(cur?.level) && (
            <p className={`mt-3 flex gap-2 rounded-xl ${style.bg} px-3 py-2 text-xs ${style.text}`}>
              <Stethoscope size={14} className="mt-0.5 shrink-0" /> Consider sharing this summary with a clinician. They can see the underlying evidence in the clinician view.
            </p>
          )}
        </div>
      </section>

      {/* 2. Closed loop */}
      <ClosedLoopCard loop={tri?.loop} />

      {/* 3. Modules */}
      <section>
        <SectionTitle
          eyebrow="Step 1 · Patterns"
          title="What the monitoring modules found"
          right={<button onClick={() => openCheckin()} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink-soft hover:bg-brand-50/60"><ClipboardCheck size={14} /> Add symptoms</button>}
        />
        <div className="grid gap-5 md:grid-cols-2">
          {(tri?.modules || []).map((m) => <ModuleCard key={m.module} module={m} />)}
        </div>
      </section>

      {/* 4. Vitals vs personal baseline */}
      <section>
        <SectionTitle
          eyebrow="Step 2 · Your numbers"
          title="Your vitals against your personal baseline"
          right={<Segmented options={Object.keys(PERIOD)} value={period} onChange={setPeriod} />}
        />
        {vitals.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {vitals.map((v) => <VitalInsightCard key={v.key} vital={v} avgLabel={demo ? '7-day avg' : 'your baseline'} />)}
          </div>
        ) : (
          <p className="card p-6 text-sm text-ink-soft">{trends === null && !demo ? 'Loading…' : 'No readings in this period yet.'}</p>
        )}
      </section>

      {/* 5. What to do + triage history */}
      <section>
        <SectionTitle eyebrow="Step 3 · What you can do" title="Suggestions & history" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Card eyebrow="Suggestions" title="Simple things that help">
            <ul className="grid gap-4 sm:grid-cols-2">
              {TIPS.map((t) => {
                const Icon = TIP_ICON[t.icon];
                return (
                  <li key={t.title} className="rounded-xl border border-line p-4">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon size={16} /></span>
                    <p className="mt-3 text-sm font-medium">{t.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t.text}</p>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card eyebrow="Longitudinal" title="Triage history">
            {tri?.history?.length ? (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {tri.history.map((h) => (
                  <li key={`${h.ts}-${h.level}`} className="relative">
                    <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white ${LEVEL_STYLE[h.level].bar}`} />
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {h.prevLevel && <><TriageBadge level={h.prevLevel} /><span className="text-ink-mute">→</span></>}
                      <TriageBadge level={h.level} />
                    </div>
                    <p className="mt-1 text-xs text-ink-mute">{new Date(h.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink-soft">Level changes will appear here.</p>}
          </Card>
        </div>
      </section>

      {/* 6. Transparency */}
      <section className="card grid gap-6 p-6 md:grid-cols-3">
        <div className="flex gap-3">
          <Database size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">Data used</p>
            <p className="mt-1 text-xs text-ink-soft">Measured sensor data, your reported answers and check-ins, and values estimated from your history — each labelled with its source and confidence.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">How it works</p>
            <p className="mt-1 text-xs text-ink-soft">Collect → analyse → detect deviation from your baseline → ask for missing information → update → reanalyse, every 24-hour cycle.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">Not a diagnosis</p>
            <p className="mt-1 text-xs text-ink-soft">Prototype risk/triage information only. It is not clinically validated. Consult a healthcare professional for medical advice.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
