import { useEffect, useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { Chips, Slider, Section, inputCls } from '../input/fields.jsx';
import { periodStart, periodEnd, logCycleSymptom } from '../../services/cycleApi.js';

const FLOW = [{ label: 'Spotting', value: 'spotting' }, { label: 'Light', value: 'light' }, { label: 'Medium', value: 'medium' }, { label: 'Heavy', value: 'heavy' }];
const IMPACT = [{ label: 'None', value: 'none' }, { label: 'Some', value: 'some' }, { label: 'Significant', value: 'significant' }];
const SEVERITY_SYMPTOMS = [
  ['pain', 'Pain'], ['cramps', 'Cramps'], ['fatigue', 'Fatigue'], ['bloating', 'Bloating'], ['headache', 'Headache'], ['sleep_disturbance', 'Sleep disturbance'],
];
const EMPTY = { period: null, date: '', flow: null, severities: {}, activityImpact: null, customLabel: '', customSeverity: 5 };

// Daily cycle log: period start/end, flow (optional), symptoms with severity, activity impact, custom symptoms.
export default function CycleLogModal({ open, onClose, onSaved, periodOngoing }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setF(EMPTY); setDone(null); setError(''); } }, [open]);
  const today = new Date().toISOString().slice(0, 10);
  const toggleSeverity = (k) => setF((x) => {
    const s = { ...x.severities };
    if (s[k] == null) s[k] = 5; else delete s[k];
    return { ...x, severities: s };
  });

  const save = async () => {
    setBusy(true);
    setError('');
    const at = f.date ? new Date(`${f.date}T12:00:00`).toISOString() : new Date().toISOString();
    const results = [];
    try {
      if (f.period === 'start') results.push(await periodStart(at));
      if (f.period === 'end') results.push(await periodEnd(at));
      if (f.flow) results.push(await logCycleSymptom({ symptom: 'flow', flow: f.flow, ts: at }));
      for (const [symptom, severity] of Object.entries(f.severities)) results.push(await logCycleSymptom({ symptom, severity, ts: at }));
      if (f.activityImpact) results.push(await logCycleSymptom({ symptom: 'activity_impact', activityImpact: f.activityImpact, ts: at }));
      if (f.customLabel.trim()) results.push(await logCycleSymptom({ symptom: 'custom', label: f.customLabel.trim(), severity: f.customSeverity, ts: at }));
      if (!results.length) { setError('Choose at least one thing to record.'); return; }
      setDone(results.some((r) => r?.pending) ? 'pending' : 'saved');
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Cycle & health"
      title={done === 'pending' ? 'Saved on this device' : done ? 'Recorded' : 'Log cycle information'}
      footer={done ? (
        <button onClick={onClose} className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white">Done</button>
      ) : (
        <>
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-xs text-ink-soft hover:bg-canvas">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
        </>
      )}
    >
      {done === 'pending' ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900"><b>Pending sync — not uploaded yet.</b> Kept on this device with the time you entered it; it uploads automatically when the connection returns.</p>
      ) : done ? (
        <p className="flex items-center gap-2 text-sm text-brand-700"><CheckCircle2 size={18} /> Saved as <b>Reported</b> information. Your cycle context and insights are updating.</p>
      ) : (
        <div className="space-y-6">
          <Section label="Period">
            <Chips
              options={[{ label: 'Period started', value: 'start' }, ...(periodOngoing ? [{ label: 'Period ended', value: 'end' }] : [])]}
              value={f.period}
              onChange={(v) => setF((x) => ({ ...x, period: v }))}
            />
          </Section>

          <Section label="Flow" hint="Optional — only if you want to track it">
            <Chips options={FLOW} value={f.flow} onChange={(v) => setF((x) => ({ ...x, flow: v }))} />
          </Section>

          <Section label="Symptoms" hint="Tap to add, then set severity (0–10)">
            <div className="flex flex-wrap gap-2">
              {SEVERITY_SYMPTOMS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => toggleSeverity(k)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${f.severities[k] != null ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-line bg-white text-ink-soft hover:bg-canvas'}`}>
                  {l}
                </button>
              ))}
            </div>
            {Object.keys(f.severities).map((k) => (
              <div key={k} className="rounded-xl bg-canvas px-3 py-2">
                <p className="mb-1 text-xs font-medium">{SEVERITY_SYMPTOMS.find(([x]) => x === k)[1]}</p>
                <Slider value={f.severities[k]} onChange={(v) => setF((x) => ({ ...x, severities: { ...x.severities, [k]: v } }))} low="None" high="Worst" />
              </div>
            ))}
          </Section>

          <Section label="Impact on your usual activities">
            <Chips options={IMPACT} value={f.activityImpact} onChange={(v) => setF((x) => ({ ...x, activityImpact: v }))} />
          </Section>

          <Section label="Other symptom" hint="Optional">
            <div className="flex items-center gap-2">
              <Plus size={14} className="text-ink-mute" />
              <input className={inputCls} placeholder="e.g. back pain, nausea" maxLength={60} value={f.customLabel} onChange={(e) => setF((x) => ({ ...x, customLabel: e.target.value }))} />
            </div>
            {f.customLabel.trim() && <Slider value={f.customSeverity} onChange={(v) => setF((x) => ({ ...x, customSeverity: v }))} low="Mild" high="Severe" />}
          </Section>

          <Section label="Date" hint="Leave empty for today">
            <input type="date" max={today} className={`${inputCls} sm:w-56`} value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} />
          </Section>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
