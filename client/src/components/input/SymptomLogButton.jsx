import { useEffect, useRef, useState } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { Chips, Slider } from './fields.jsx';
import { logSymptom } from '../../services/inputService.js';
import { useInput } from '../../context/InputContext.jsx';

const TYPES = [
  { label: 'Cramp', value: 'cramp' }, { label: 'Pain', value: 'pain' }, { label: 'Fatigue', value: 'fatigue' },
  { label: 'Woke suddenly', value: 'wake_sudden' }, { label: 'Headache', value: 'headache' }, { label: 'Breathless', value: 'breathless' },
  { label: 'Dizziness', value: 'dizziness' }, { label: 'Nausea', value: 'nausea' },
];

// Quick one-tap symptom log in the top bar.
export default function SymptomLogButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(null);
  const [severity, setSeverity] = useState(5);
  const [state, setState] = useState('idle');
  const ref = useRef(null);
  const { bump } = useInput();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const save = async () => {
    setState('saving');
    try {
      await logSymptom({ type, severity });
      setState('saved');
      bump();
      setTimeout(() => { setOpen(false); setState('idle'); setType(null); setSeverity(5); }, 1100);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs text-ink-soft hover:bg-brand-50/60"
      >
        <Plus size={14} /> <span className="hidden sm:inline">Log symptom</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-line bg-white p-5 shadow-lg">
          {state === 'saved' ? (
            <p className="flex items-center gap-2 py-4 text-sm text-brand-700"><CheckCircle2 size={18} /> Symptom logged</p>
          ) : (
            <div className="space-y-4">
              <p className="eyebrow">Quick log</p>
              <Chips options={TYPES} value={type} onChange={setType} />
              {type && (
                <div>
                  <p className="mb-2 text-xs text-ink-soft">How strong?</p>
                  <Slider value={severity} onChange={setSeverity} low="Mild" high="Severe" />
                </div>
              )}
              {state === 'error' && <p className="text-xs text-red-600">Could not save. Try again.</p>}
              <button
                onClick={save}
                disabled={!type || state === 'saving'}
                className="w-full rounded-xl bg-brand-600 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {state === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
