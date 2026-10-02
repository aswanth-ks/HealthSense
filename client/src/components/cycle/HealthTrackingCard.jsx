import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart, Lock, ArrowRight } from 'lucide-react';
import Card from '../common/Card.jsx';
import Toggle from '../common/Toggle.jsx';
import Modal from '../common/Modal.jsx';
import CycleSetupModal, { PRIVACY } from './CycleSetupModal.jsx';
import { saveCycleSettings } from '../../services/cycleApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useInput } from '../../context/InputContext.jsx';
import api from '../../services/api.js';

// Settings → Health tracking → Menstrual Cycle Tracking (opt-in, sensitive).
export default function HealthTrackingCard() {
  const { user, isDemo, updateUser } = useAuth();
  const { bump } = useInput();
  const tracking = !!user?.cycle?.tracking;
  const [setup, setSetup] = useState(false);
  const [stop, setStop] = useState(false);
  const [deleteData, setDeleteData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshUser = async () => {
    const { data } = await api.get('/users/me');
    updateUser(data.user);
    bump();
  };

  const turnOff = async () => {
    setBusy(true);
    setError('');
    try {
      await saveCycleSettings({ tracking: false, deleteData });
      await refreshUser();
      setStop(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not update. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card eyebrow="Health tracking" title="Menstrual Cycle Tracking" action={<CalendarHeart size={18} className="text-rose-500" />}>
      <label className="flex items-start justify-between gap-4 text-sm">
        <span className="text-ink-soft">Help HealthSense understand your symptoms and physiological patterns in relation to your menstrual cycle.</span>
        <Toggle
          checked={tracking}
          label="Menstrual Cycle Tracking"
          onChange={(on) => {
            if (isDemo) return setError('Cycle tracking needs a HealthSense account.');
            return on ? setSetup(true) : setStop(true);
          }}
        />
      </label>
      {tracking && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/cycle" className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs text-ink-soft hover:bg-canvas">Open Cycle &amp; Health <ArrowRight size={13} /></Link>
          <button type="button" onClick={() => setSetup(true)} className="rounded-xl border border-line px-3 py-2 text-xs text-ink-soft hover:bg-canvas">Edit cycle details</button>
        </div>
      )}
      <p className="mt-4 flex gap-2 rounded-xl bg-canvas px-3 py-2.5 text-[11px] leading-relaxed text-ink-soft"><Lock size={13} className="mt-0.5 shrink-0" /> {PRIVACY}</p>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <CycleSetupModal open={setup} initial={user?.cycle} onClose={() => setSetup(false)} onDone={async () => { setSetup(false); await refreshUser(); }} />

      <Modal
        open={stop}
        onClose={() => setStop(false)}
        eyebrow="Menstrual cycle tracking"
        title="Stop tracking?"
        footer={(
          <>
            <button type="button" onClick={() => setStop(false)} className="rounded-xl border border-line px-4 py-2.5 text-xs text-ink-soft">Keep tracking</button>
            <button type="button" onClick={turnOff} disabled={busy} className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-60">{busy ? 'Saving…' : 'Stop tracking'}</button>
          </>
        )}
      >
        <p className="text-sm text-ink-soft">HealthSense will stop collecting and showing menstrual-cycle information, and stop using it to interpret your readings.</p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={deleteData} onChange={(e) => setDeleteData(e.target.checked)} />
          <span>Also permanently delete my cycle history, cycle symptoms and cycle-aware baselines.</span>
        </label>
      </Modal>
    </Card>
  );
}
