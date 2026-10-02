import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import Toggle from '../common/Toggle.jsx';
import { Chips, Slider, Section, inputCls } from './fields.jsx';
import { submitCheckin } from '../../services/inputService.js';

const LOCATIONS = ['Lower abdomen', 'Pelvis', 'Lower back', 'Head', 'Chest', 'Other'];
const QUALITY = [{ label: 'Very poor', value: 1 }, { label: 'Poor', value: 2 }, { label: 'OK', value: 3 }, { label: 'Good', value: 4 }, { label: 'Great', value: 5 }];
const MOOD = [{ label: '😞', value: 1 }, { label: '🙁', value: 2 }, { label: '😐', value: 3 }, { label: '🙂', value: 4 }, { label: '😄', value: 5 }];

const EMPTY = { sleepHours: '', sleepQuality: null, fatigue: null, pain: 0, painLocation: null, cramps: false, mood: null, period: false, cycleDay: '', notes: '' };

// Daily check-in: everything the sensors can't measure (spec §27-A symptom logging, §27-F "Reported").
export default function CheckinModal({ open, onClose, prefill, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...(prefill?.values || {}) });
      setDone(null);
      setError('');
    }
  }, [open, prefill]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const dateLabel = prefill?.date ? new Date(prefill.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Today';

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        sleepHours: form.sleepHours === '' ? null : Number(form.sleepHours),
        cycleDay: form.cycleDay === '' ? null : Number(form.cycleDay),
        date: prefill?.date,
      };
      const res = await submitCheckin(payload);
      setDone(res?.pending ? 'pending' : res?.saved || ['Check-in saved']);
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`Daily check-in · ${dateLabel}`}
      title={done === 'pending' ? 'Saved on this device' : done ? 'Thanks — check-in saved' : 'How are you feeling?'}
      footer={done ? (
        <button onClick={onClose} className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-brand-700">Done</button>
      ) : (
        <>
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-xs text-ink-soft hover:bg-canvas">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? 'Saving…' : 'Save check-in'}
          </button>
        </>
      )}
    >
      {done === 'pending' ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-amber-900"><b>Pending sync — not uploaded yet.</b> There is no connection to the HealthSense server.</p>
          <p className="text-ink-soft">Your check-in is stored on this device with the time you entered it, and will upload automatically when the connection returns. Your assessment will update then.</p>
        </div>
      ) : done ? (
        <div className="space-y-4 text-sm">
          <p className="flex items-center gap-2 text-brand-700"><CheckCircle2 size={18} /> Your answers are saved as <b>Reported</b> data (100% confidence).</p>
          {done.length > 0 && <ul className="list-disc space-y-1 pl-5 text-ink-soft">{done.map((s) => <li key={s}>{s}</li>)}</ul>}
          <p className="text-xs text-ink-mute">Your monitoring cycle and insights are being updated.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {prefill?.reason && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{prefill.reason}</p>}

          <Section label="Sleep last night" hint="Replaces any estimate">
            <div className="flex items-center gap-3">
              <input type="number" min="0" max="16" step="0.5" placeholder="e.g. 7.5" className={`${inputCls} w-32`} value={form.sleepHours} onChange={(e) => set('sleepHours')(e.target.value)} />
              <span className="text-xs text-ink-mute">hours</span>
            </div>
            <Chips options={QUALITY} value={form.sleepQuality} onChange={set('sleepQuality')} />
          </Section>

          <Section label="Fatigue / tiredness" hint="0 = none, 10 = exhausted">
            <Slider value={form.fatigue} onChange={set('fatigue')} low="None" high="Exhausted" />
          </Section>

          <Section label="Pain" hint="0 = none, 10 = worst imaginable">
            <Slider value={form.pain} onChange={set('pain')} low="None" high="Worst" />
            {form.pain > 0 && <Chips options={LOCATIONS} value={form.painLocation} onChange={set('painLocation')} />}
            <label className="flex items-center justify-between gap-3 pt-1 text-sm text-ink-soft">
              Cramps
              <Toggle checked={form.cramps} onChange={set('cramps')} label="Cramps" />
            </label>
          </Section>

          <Section label="Mood">
            <Chips options={MOOD} value={form.mood} onChange={set('mood')} />
          </Section>

          <Section label="Menstrual cycle" hint="Optional">
            <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
              I am on my period
              <Toggle checked={form.period} onChange={set('period')} label="On period" />
            </label>
            {form.period && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-mute">Day</span>
                <input type="number" min="1" max="15" className={`${inputCls} w-24`} value={form.cycleDay} onChange={(e) => set('cycleDay')(e.target.value)} />
              </div>
            )}
          </Section>

          <Section label="Anything else?" hint="Optional">
            <textarea rows={2} className={inputCls} placeholder="Notes for your records or your clinician" value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
          </Section>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
