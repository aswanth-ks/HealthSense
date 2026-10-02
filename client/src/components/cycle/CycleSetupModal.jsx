import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { Chips, Section, inputCls } from '../input/fields.jsx';
import { saveCycleSettings } from '../../services/cycleApi.js';

const REG = [
  { label: 'Regular', value: 'regular' }, { label: 'Somewhat irregular', value: 'somewhat_irregular' },
  { label: 'Very irregular', value: 'very_irregular' }, { label: 'Unsure', value: 'unsure' },
];

export const PRIVACY = 'Cycle information is sensitive health data. It is stored with your HealthSense account, used only to interpret your own readings, never shared, and you can edit or delete it — or stop tracking — at any time.';

// Short onboarding when cycle tracking is enabled. Nothing is required: unknown answers stay unknown.
export default function CycleSetupModal({ open, onClose, onDone, initial }) {
  const [f, setF] = useState({ lastPeriodStart: '', noDate: false, avgLengthDays: 28, lengthUnknown: false, typicalPeriodLength: '', regularity: 'unsure' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setF((x) => ({
      ...x,
      avgLengthDays: initial?.avgLengthDays ?? 28,
      lengthUnknown: !!initial?.lengthUnknown,
      typicalPeriodLength: initial?.typicalPeriodLength ?? '',
      regularity: initial?.regularity || 'unsure',
    }));
  }, [open, initial]);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));
  const today = new Date().toISOString().slice(0, 10);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await saveCycleSettings({
        tracking: true,
        lastPeriodStart: !f.noDate && f.lastPeriodStart ? f.lastPeriodStart : undefined,
        lengthUnknown: f.lengthUnknown,
        avgLengthDays: f.lengthUnknown ? undefined : Number(f.avgLengthDays) || undefined,
        typicalPeriodLength: f.typicalPeriodLength === '' ? undefined : Number(f.typicalPeriodLength),
        regularity: f.regularity || 'unsure',
      });
      onDone?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save. Cycle tracking needs a connection to set up.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Menstrual cycle tracking"
      title="Set up cycle context"
      footer={(
        <>
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-xs text-ink-soft hover:bg-canvas">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? 'Saving…' : 'Turn on tracking'}
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        <p className="text-sm text-ink-soft">Answer what you know — everything is optional. HealthSense learns your own pattern over time instead of assuming a "standard" cycle.</p>

        <Section label="First day of your most recent period">
          <input type="date" max={today} disabled={f.noDate} className={`${inputCls} sm:w-56`} value={f.lastPeriodStart} onChange={set('lastPeriodStart')} />
          <label className="flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={f.noDate} onChange={set('noDate')} /> I don't remember</label>
        </Section>

        <Section label="Typical cycle length" hint="Days from one period start to the next">
          <div className="flex items-center gap-3">
            <input type="number" min="15" max="60" disabled={f.lengthUnknown} className={`${inputCls} w-28`} value={f.avgLengthDays} onChange={set('avgLengthDays')} />
            <span className="text-xs text-ink-mute">days</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={f.lengthUnknown} onChange={set('lengthUnknown')} /> I don't know my average cycle length</label>
        </Section>

        <Section label="Typical period duration" hint="Optional">
          <div className="flex items-center gap-3">
            <input type="number" min="1" max="15" placeholder="e.g. 5" className={`${inputCls} w-28`} value={f.typicalPeriodLength} onChange={set('typicalPeriodLength')} />
            <span className="text-xs text-ink-mute">days</span>
          </div>
        </Section>

        <Section label="Cycle regularity">
          <Chips options={REG} value={f.regularity} onChange={(v) => set('regularity')(v || 'unsure')} />
        </Section>

        <p className="flex gap-2 rounded-xl bg-canvas px-3 py-2.5 text-[11px] leading-relaxed text-ink-soft"><Lock size={13} className="mt-0.5 shrink-0" /> {PRIVACY}</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
