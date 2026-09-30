import { useState } from 'react';
import {
  CheckCircle2, TrendingUp, Info, Droplet, Moon, Coffee, Watch, Sparkles, Database, ShieldCheck, Minus,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Segmented from '../components/common/Segmented.jsx';
import ScoreRing from '../components/insights/ScoreRing.jsx';
import VitalInsightCard from '../components/insights/VitalInsightCard.jsx';
import { getInsightsFor, FINDINGS, PATTERNS, TIPS, WEEKLY } from '../services/insightsData.js';

const FINDING_STYLE = {
  good: { icon: CheckCircle2, cls: 'bg-brand-50 text-brand-600', tag: 'Good' },
  watch: { icon: TrendingUp, cls: 'bg-amber-50 text-amber-600', tag: 'Worth watching' },
  info: { icon: Info, cls: 'bg-blue-50 text-blue-600', tag: 'Info' },
};
const TIP_ICON = { droplet: Droplet, moon: Moon, coffee: Coffee, watch: Watch };

const SectionTitle = ({ eyebrow, title, right }) => (
  <div className="mb-5 flex items-end justify-between gap-3">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-medium">{title}</h2>
    </div>
    {right}
  </div>
);

export default function AIInsights() {
  const [period, setPeriod] = useState('Today');
  const data = getInsightsFor(period);
  const watchCount = data.vitals.filter((v) => v.status === 'Watch').length;
  const inRange = data.vitals.length;
  const maxHr = Math.max(...PATTERNS.map((p) => p.hr));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="AI-generated interpretation"
        title="AI Insights"
        subtitle="A plain-language explanation of what your readings say about your health."
        right={
          <div className="flex items-center gap-3">
            <Segmented options={['Today', '7D', '30D']} value={period} onChange={setPeriod} />
            <span className="rounded border border-line px-2 py-1 text-[10px] text-ink-soft">BETA</span>
          </div>
        }
      />

      {/* 1. Overall verdict */}
      <section className="card flex flex-col gap-8 !border-brand-100 !bg-brand-50/40 p-6 sm:flex-row sm:items-center sm:p-8">
        <ScoreRing score={data.score} />
        <div className="flex-1">
          <p className="eyebrow flex items-center gap-1.5"><Sparkles size={13} /> Overall health summary</p>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink">{data.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1.5 text-brand-900 shadow-card">✓ {inRange}/{inRange} vitals in range</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-brand-900 shadow-card">0 alerts</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-amber-700 shadow-card">{watchCount} to keep an eye on</span>
          </div>
        </div>
      </section>

      {/* 2. Each vital explained */}
      <section>
        <SectionTitle eyebrow="Step 1 · Your numbers" title="Your vitals explained" />
        <div className="grid gap-5 md:grid-cols-2">
          {data.vitals.map((v) => <VitalInsightCard key={v.key} vital={v} avgLabel={data.avgLabel} />)}
        </div>
      </section>

      {/* 3. Findings + patterns */}
      <section>
        <SectionTitle eyebrow="Step 2 · What we noticed" title="Findings & patterns" />
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Card eyebrow="Key findings" title="What stood out">
            <ul className="space-y-4">
              {FINDINGS.map((f) => {
                const s = FINDING_STYLE[f.type];
                return (
                  <li key={f.title} className="flex gap-4">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.cls}`}><s.icon size={17} /></span>
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {f.title}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-normal ${s.cls}`}>{s.tag}</span>
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{f.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card eyebrow="Daily pattern" title="Heart rate by time of day">
            <ul className="space-y-4">
              {PATTERNS.map((p) => (
                <li key={p.label}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{p.label} <span className="text-xs font-normal text-ink-mute">{p.time}</span></span>
                    <span>{p.hr} <span className="text-xs text-ink-mute">BPM</span></span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-line">
                    <div className={`h-full rounded-full ${p.hr === maxHr ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: `${(p.hr / maxHr) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-line pt-3 text-xs text-ink-soft">Your heart rate is highest in the afternoon and lowest while you sleep — a normal rhythm.</p>
          </Card>
        </div>
      </section>

      {/* 4. What to do */}
      <section>
        <SectionTitle eyebrow="Step 3 · What you can do" title="Recommendations & progress" />
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

          <Card
            eyebrow="Comparison"
            title="This week vs last week"
            action={<span className="rounded-md bg-canvas px-2.5 py-1 text-[11px] text-ink-soft">Weekly</span>}
          >
            <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr] border-b border-line pb-2 text-[11px] uppercase tracking-wider text-ink-mute">
              <span>Vital</span><span>This week</span><span>Last week</span><span className="text-right">Change</span>
            </div>
            <ul className="divide-y divide-line text-sm">
              {WEEKLY.map((w) => (
                <li key={w.label} className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr] items-center py-3.5">
                  <span className="text-ink-soft">{w.label}</span>
                  <span className="font-medium">{w.now}</span>
                  <span className="text-ink-mute">{w.prev}</span>
                  <span className={`flex items-center justify-end gap-1 text-xs ${w.up ? 'text-amber-600' : 'text-ink-mute'}`}>
                    {w.up ? <TrendingUp size={13} /> : <Minus size={13} />} {w.change}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* 5. Transparency */}
      <section className="card grid gap-6 p-6 md:grid-cols-3">
        <div className="flex gap-3">
          <Database size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">Data used</p>
            <p className="mt-1 text-xs text-ink-soft">{data.readings.toLocaleString()} readings from HealthSense Watch ({period === 'Today' ? 'today' : `last ${period}`}).</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">How it works</p>
            <p className="mt-1 text-xs text-ink-soft">Readings are compared with your own baseline and standard healthy ranges.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">Not a diagnosis</p>
            <p className="mt-1 text-xs text-ink-soft">Insights are informational only. Consult a healthcare professional for medical advice.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
