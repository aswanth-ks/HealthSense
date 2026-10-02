import { useEffect, useState } from 'react';
import { Activity, Moon, Droplets, User, History, Sparkles } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { getEvidence } from '../../services/assessmentApi.js';

const PROV = {
  MEASURED: { label: 'Measured · sensor', cls: 'bg-brand-50 text-brand-700', icon: Activity },
  USER_REPORTED: { label: 'Reported by you', cls: 'bg-blue-50 text-blue-700', icon: User },
  HISTORICAL: { label: 'Historical', cls: 'bg-violet-50 text-violet-700', icon: History },
  AI_ESTIMATED: { label: 'AI estimated', cls: 'bg-amber-50 text-amber-700', icon: Sparkles },
};
const UNIT = (e) => (e.unit === 'hours' ? 'h' : e.unit === '/10' ? '/10' : e.unit ? ` ${e.unit}` : '');

export function ProvenancePill({ p, confidence }) {
  const s = PROV[p] || PROV.MEASURED;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>
      <s.icon size={10} /> {s.label}{confidence != null && <span className="font-normal opacity-80">· {Math.round(confidence * 100)}%</span>}
    </span>
  );
}

// "Evidence behind this pattern": the actual stored observations, their source and confidence.
export default function EvidenceModal({ open, onClose, assessment, pattern, target, title }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !assessment) return;
    setRows(null);
    setError(false);
    getEvidence(assessment.assessment_id, { patternId: pattern?.pattern_id, target })
      .then((d) => setRows(d.evidence))
      .catch(() => setError(true));
  }, [open, assessment, pattern, target]);

  const Icon = pattern?.category === 'sleep' ? Moon : pattern?.category === 'physiology' ? Droplets : Activity;

  return (
    <Modal open={open} onClose={onClose} eyebrow="Evidence behind this pattern" title={title || pattern?.name || 'Evidence'} width="max-w-xl">
      {pattern && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-canvas px-2 py-2.5">
            <p className="text-[10px] text-ink-mute">Observed</p>
            <p className="text-sm font-medium">{pattern.recurrence.cycles_observed ? `${pattern.recurrence.cycles_observed} cycles` : `${pattern.recurrence.days_observed} of ${pattern.recurrence.total_days} days`}</p>
          </div>
          <div className="rounded-xl bg-canvas px-2 py-2.5">
            <p className="text-[10px] text-ink-mute">Occurrences</p>
            <p className="text-sm font-medium">{pattern.recurrence.occurrences ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-canvas px-2 py-2.5">
            <p className="text-[10px] text-ink-mute">Confidence</p>
            <p className="text-sm font-medium">{Math.round(pattern.confidence * 100)}%</p>
          </div>
        </div>
      )}
      {pattern?.history_note && <p className="mb-4 flex gap-2 rounded-xl bg-violet-50/60 px-3 py-2 text-xs text-violet-900"><History size={14} className="mt-0.5 shrink-0" /> <span><b>Compared with your history:</b> {pattern.history_note}</span></p>}

      {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Evidence could not be loaded — connection unavailable.</p>}
      {!rows && !error && <p className="text-sm text-ink-soft">Loading evidence…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-ink-soft">No individual observations are attached to this item.</p>}
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rows.map((e) => (
            <li key={e.id} className="flex gap-3 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-ink-soft"><Icon size={14} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">{e.label}{e.value != null && <span className="font-normal normal-case text-ink-soft"> · {e.value}{UNIT(e)}</span>}</p>
                <p className="text-[11px] text-ink-mute">{e.day || new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{e.baseline != null && <> · your baseline {e.baseline}{UNIT(e)}</>}</p>
                {e.note && <p className="mt-0.5 text-xs text-ink-soft">{e.note}</p>}
              </div>
              <ProvenancePill p={e.provenance} confidence={e.confidence} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] text-ink-mute">Every item shows where it came from. Estimated values are always labelled as estimates.</p>
    </Modal>
  );
}
