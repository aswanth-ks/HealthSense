import { useEffect, useState } from 'react';
import { Plus, Trash2, CheckCircle2, Info } from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Toggle from '../components/common/Toggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import HealthTrackingCard from '../components/cycle/HealthTrackingCard.jsx';
import api from '../services/api.js';

const input = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-canvas disabled:text-ink-mute';
const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs text-ink-soft">{label}{hint && <span className="text-[10px] text-ink-mute">{hint}</span>}</span>
    {children}
  </label>
);

const toDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const readPrefs = () => { try { return JSON.parse(localStorage.getItem('prefs')) || null; } catch { return null; } };

function fromUser(u) {
  return {
    name: u?.name || '',
    email: u?.email || '',
    dob: toDate(u?.profile?.dob),
    sex: u?.profile?.sex || '',
    heightCm: u?.profile?.heightCm ?? '',
    weightKg: u?.profile?.weightKg ?? '',
    history: (u?.medicalHistory || []).map(({ condition = '', since = '', notes = '' }) => ({ condition, since, notes })),
    tracking: !!u?.cycle?.tracking,
    lastPeriodStart: toDate(u?.cycle?.lastPeriodStart),
    avgLengthDays: u?.cycle?.avgLengthDays ?? 28,
    ranges: { hrMin: 60, hrMax: 100, spo2Min: 95, tempMin: 36, tempMax: 37.5, ...(u?.ranges || {}) },
  };
}

export default function Settings() {
  const { user, isDemo, updateUser } = useAuth();
  const [form, setForm] = useState(() => fromUser(user));
  const [prefs, setPrefs] = useState(() => readPrefs() || { push: true, email: false, summary: true });
  const [state, setState] = useState({ status: 'idle', msg: '' });

  useEffect(() => { setForm(fromUser(user)); }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const setRange = (k) => (e) => setForm((f) => ({ ...f, ranges: { ...f.ranges, [k]: e.target.value } }));
  const setHistory = (i, k) => (e) => setForm((f) => ({ ...f, history: f.history.map((h, j) => (j === i ? { ...h, [k]: e.target.value } : h)) }));

  const save = async (e) => {
    e.preventDefault();
    try { localStorage.setItem('prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
    if (isDemo) { setState({ status: 'saved', msg: 'Saved on this device (demo mode)' }); return; }

    const r = form.ranges;
    if (+r.hrMin >= +r.hrMax || +r.tempMin >= +r.tempMax) {
      setState({ status: 'error', msg: 'Each minimum must be lower than its maximum.' });
      return;
    }
    setState({ status: 'saving', msg: '' });
    try {
      const num = (v) => (v === '' || v == null ? undefined : Number(v));
      const { data } = await api.put('/users/me', {
        name: form.name.trim(),
        profile: { dob: form.dob || undefined, sex: form.sex, heightCm: num(form.heightCm), weightKg: num(form.weightKg) },
        medicalHistory: form.history.filter((h) => h.condition.trim()),
        ranges: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)])),
      });
      updateUser(data.user);
      setState({ status: 'saved', msg: 'Changes saved' });
    } catch (err) {
      setState({ status: 'error', msg: err.response?.data?.message || 'Could not save changes.' });
    }
  };

  useEffect(() => {
    if (state.status !== 'saved') return undefined;
    const t = setTimeout(() => setState({ status: 'idle', msg: '' }), 2500);
    return () => clearTimeout(t);
  }, [state.status]);

  const saveButton = (
    <div className="flex items-center gap-3">
      {state.msg && (
        <span className={`flex items-center gap-1.5 text-xs ${state.status === 'error' ? 'text-red-600' : 'text-brand-700'}`}>
          {state.status === 'saved' && <CheckCircle2 size={14} />} {state.msg}
        </span>
      )}
      <button type="submit" disabled={state.status === 'saving'} className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {state.status === 'saving' ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-8">
      <PageHeader eyebrow="Preferences" title="Settings" subtitle="Your profile, medical background and monitoring preferences." right={saveButton} />

      <Card eyebrow="Account" title="Patient profile">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name"><input required className={input} value={form.name} onChange={set('name')} /></Field>
          <Field label="Email" hint="Sign-in email"><input className={input} value={form.email} disabled /></Field>
          <Field label="Date of birth"><input type="date" className={input} value={form.dob} onChange={set('dob')} /></Field>
          <Field label="Sex">
            <select className={input} value={form.sex} onChange={set('sex')}>
              <option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
            </select>
          </Field>
          <Field label="Height (cm)"><input type="number" min="50" max="250" className={input} value={form.heightCm} onChange={set('heightCm')} /></Field>
          <Field label="Weight (kg)"><input type="number" min="20" max="300" className={input} value={form.weightKg} onChange={set('weightKg')} /></Field>
        </div>
      </Card>

      <Card
        eyebrow="Background"
        title="Medical history"
        action={
          <button type="button" onClick={() => setForm((f) => ({ ...f, history: [...f.history, { condition: '', since: '', notes: '' }] }))} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs text-ink-soft hover:bg-brand-50/60">
            <Plus size={14} /> Add condition
          </button>
        }
      >
        {form.history.length === 0 ? (
          <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-soft">No conditions added. Adding relevant history (e.g. asthma, hypertension, diagnosed sleep problems) helps put your readings in context.</p>
        ) : (
          <ul className="space-y-3">
            {form.history.map((h, i) => (
              <li key={i} className="grid items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1.4fr_0.7fr_1.6fr_auto]">
                <Field label="Condition"><input className={input} placeholder="e.g. Asthma" value={h.condition} onChange={setHistory(i, 'condition')} /></Field>
                <Field label="Since"><input className={input} placeholder="e.g. 2019" value={h.since} onChange={setHistory(i, 'since')} /></Field>
                <Field label="Notes"><input className={input} placeholder="Medication, severity…" value={h.notes} onChange={setHistory(i, 'notes')} /></Field>
                <button type="button" onClick={() => setForm((f) => ({ ...f, history: f.history.filter((_, j) => j !== i) }))} aria-label="Remove" className="mb-1 rounded-lg p-2 text-ink-mute hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <HealthTrackingCard />

        <Card eyebrow="Monitoring" title="Configured ranges">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Heart rate min (BPM)"><input type="number" className={input} value={form.ranges.hrMin} onChange={setRange('hrMin')} /></Field>
            <Field label="Heart rate max (BPM)"><input type="number" className={input} value={form.ranges.hrMax} onChange={setRange('hrMax')} /></Field>
            <Field label="Blood oxygen min (%)"><input type="number" className={input} value={form.ranges.spo2Min} onChange={setRange('spo2Min')} /></Field>
            <div className="hidden sm:block" />
            <Field label="Temperature min (°C)"><input type="number" step="0.1" className={input} value={form.ranges.tempMin} onChange={setRange('tempMin')} /></Field>
            <Field label="Temperature max (°C)"><input type="number" step="0.1" className={input} value={form.ranges.tempMax} onChange={setRange('tempMax')} /></Field>
          </div>
          <p className="mt-4 flex gap-1.5 text-[11px] text-ink-mute"><Info size={12} className="mt-0.5 shrink-0" /> Used for "in range" checks. Your personal baseline is learned separately from your data.</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card eyebrow="Alerts" title="Notifications">
          <ul className="divide-y divide-line border-t border-line">
            {[['push', 'Push notifications'], ['email', 'Email alerts'], ['summary', 'Daily summary']].map(([k, l]) => (
              <li key={k} className="flex items-center justify-between py-4 text-sm">
                {l}
                <Toggle checked={prefs[k]} onChange={(v) => setPrefs({ ...prefs, [k]: v })} label={l} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-mute">Saved on this device.</p>
        </Card>

      </div>

      <div className="flex justify-end">{saveButton}</div>
    </form>
  );
}
