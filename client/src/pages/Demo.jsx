import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarHeart, CalendarRange, FlaskConical, Play, RotateCcw, Moon, Activity, DatabaseZap, CheckCircle2, Loader2, ArrowRight, ShieldCheck, MessageCircleQuestion, Target, GraduationCap,
} from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useInput } from '../context/InputContext.jsx';
import TriageBadge from '../components/triage/TriageBadge.jsx';

const STEPS = [
  { id: 'normal', icon: Play, title: 'Normal 24-hour monitoring', text: 'Generates 4 days of normal sensor data. The system learns your personal baseline.', see: ['/trends', 'Health Trends'] },
  { id: 'sleep', icon: Moon, title: 'Sleep-related abnormal pattern', text: 'Adds breathing pauses with SpO₂ dips to the last 3 nights. Deviation from baseline → adaptive question.', see: ['/alerts', 'Answer the question'] },
  { id: 'symptoms', icon: Activity, title: 'Recurring symptom pattern', text: 'Reports strong cramps/pain and fatigue on 3 days around menstruation (endometriosis-associated module).', see: ['/insights', 'Risk explanation'] },
  { id: 'threeDay', icon: CalendarRange, title: '3-Day Sleep Pattern', text: 'Resets the account, learns a baseline, then: day 1 reduced sleep + fatigue · day 2 breathing irregularity + SpO₂ dips · day 3 repeated + fatigue. Open the 3-Day Assessment, answer the question, watch it update.', see: ['/insights/3-day-assessment', '3-Day Assessment'] },
  { id: 'menstrual', icon: CalendarHeart, title: 'Menstrual cycle pattern', text: 'Enables cycle tracking and generates 3 cycles where days 1–3 bring strong pain, fatigue and reduced activity. Recurring pattern → adaptive question → answer → risk/context update → next-cycle priorities. (Resets the account first.)', see: ['/cycle', 'Cycle & Health'] },
  { id: 'missing', icon: DatabaseZap, title: 'Missing data', text: 'Removes last night\'s SpO₂, breathing and movement (watch not worn). Sensor → estimate → ask you.', see: ['/history', 'See the cycle'] },
];

const METRIC = { resp: 'Respiration', spo2: 'SpO₂', hr: 'Heart rate', movement: 'Movement', temp: 'Temperature', steps: 'Activity' };

function Stat({ icon: Icon, label, children }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-ink-mute"><Icon size={12} /> {label}</p>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

// Demo Mode: runs real scenarios on the signed-in account through the real engines (spec §28 demo).
export default function Demo() {
  const { isDemo, updateUser } = useAuth();
  const { bump } = useInput();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');

  const refresh = useCallback(() => api.get('/demo/status').then(({ data }) => setStatus(data)).catch(() => {}), []);
  useEffect(() => { if (!isDemo) refresh(); }, [isDemo, refresh]);

  const run = async (id) => {
    setBusy(id);
    setError('');
    const before = status?.triage?.level;
    try {
      const { data } = await api.post(`/demo/${id}`, null, { timeout: 180_000 });
      setStatus(data.status);
      setDone((d) => ({ ...d, [id]: true, ...(id === 'reset' || id === 'menstrual' || id === 'threeDay' ? { normal: false, sleep: false, symptoms: false, missing: false } : {}) }));
      const after = data.status.triage?.level;
      setLog((l) => [{ id, message: data.message, change: before && after && before !== after ? `${before} → ${after}` : null, at: new Date() }, ...l]);
      // Scenarios can change account settings (e.g. cycle tracking): refresh the profile
      api.get('/users/me').then(({ data: u }) => updateUser(u.user)).catch(() => {});
      bump();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not reach the server. Demo Mode needs a connection.');
    } finally {
      setBusy(null);
    }
  };

  if (isDemo) {
    return (
      <section className="card mx-auto max-w-xl p-6 text-center">
        <FlaskConical className="mx-auto text-indigo-600" size={28} />
        <h1 className="mt-3 text-xl font-medium">Demo Mode needs an account</h1>
        <p className="mt-2 text-sm text-ink-soft">Demo scenarios run on a real HealthSense account through the real engines. Create a free account (or sign in) to use them.</p>
        <Link to="/register" className="mt-5 inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-medium text-white">Create account</Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden border-indigo-200">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 text-white sm:p-6">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-indigo-100"><FlaskConical size={14} /> Presentation mode</p>
          <h1 className="mt-2 text-2xl font-medium sm:text-3xl">Demo Mode</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-indigo-100">
            Simulate monitoring scenarios on <b>this account</b>. Data goes through the real pipeline — cycles, baseline, missing-data handling, adaptive questions, triage and next-cycle monitoring.
          </p>
        </div>
        {status && (
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
            <Stat icon={ShieldCheck} label="Triage">{status.triage ? <TriageBadge level={status.triage.level} /> : '—'}</Stat>
            <Stat icon={GraduationCap} label="Baseline">{status.baseline.established ? `Established · ${status.baseline.daysUsed}d` : `Learning · ${status.baseline.daysUsed}/3`}</Stat>
            <Stat icon={MessageCircleQuestion} label="Open questions">{status.openQuestions}</Stat>
            <Stat icon={Target} label="Next-cycle focus">{status.focus.length ? status.focus.map((m) => METRIC[m] || m).join(', ') : 'Standard'}</Stat>
          </div>
        )}
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section>
        <p className="eyebrow">Run in order</p>
        <ol className="mt-3 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.id} className="card p-4 sm:p-5">
              <div className="flex gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done[s.id] ? 'bg-brand-50 text-brand-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  {done[s.id] ? <CheckCircle2 size={18} /> : <s.icon size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-mute">Step {i + 1}</p>
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{s.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => run(s.id)}
                      disabled={!!busy}
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {busy === s.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {busy === s.id ? 'Running…' : done[s.id] ? 'Run again' : 'Run'}
                    </button>
                    {done[s.id] && (
                      <Link to={s.see[0]} className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs text-ink-soft hover:bg-canvas">
                        {s.see[1]} <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-5">
        <p className="font-medium">Then show the closed loop</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>Open <Link to="/alerts" className="text-brand-700 underline">Alerts &amp; Questions</Link> and answer <i>"Did you wake suddenly during sleep?"</i> → the triage level and confidence update.</li>
          <li>Open <Link to="/insights" className="text-brand-700 underline">AI Insights</Link>: <b>Risk increased because…</b> and <b>previous cycle → learning → next-cycle monitoring priority</b>.</li>
          <li>Open <Link to="/timeline" className="text-brand-700 underline">Timeline</Link>: what happened, when, and what changed.</li>
        </ol>
      </section>

      {log.length > 0 && (
        <section className="card p-5">
          <p className="eyebrow">Activity</p>
          <ul className="mt-3 space-y-2 text-sm">
            {log.map((l) => (
              <li key={l.at.getTime()} className="flex gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand-600" />
                <span className="text-ink-soft">{l.message}{l.change && <b className="ml-1 text-amber-700">Triage {l.change}.</b>}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-ink-mute">Simulated data for demonstration. HealthSense provides triage support, not a diagnosis.</p>
        <button onClick={() => window.confirm('Clear all monitoring data for this account?') && run('reset')} disabled={!!busy} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink-soft hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
          {busy === 'reset' ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Reset demo data
        </button>
      </div>
    </div>
  );
}
