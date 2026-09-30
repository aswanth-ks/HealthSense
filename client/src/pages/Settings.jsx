import { useState } from 'react';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Toggle from '../components/common/Toggle.jsx';
import Segmented from '../components/common/Segmented.jsx';

const input = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs text-ink-soft">{label}</span>
    {children}
  </label>
);

export default function Settings() {
  const [profile, setProfile] = useState({ name: 'Aswanth S.', email: 'aswanthksv@gmail.com', dob: '' });
  const [ranges, setRanges] = useState({ hrMin: 60, hrMax: 100, spo2Min: 95, tempMin: 36.0, tempMax: 37.5 });
  const [notify, setNotify] = useState({ push: true, email: false, summary: true });
  const [units, setUnits] = useState('Metric (°C)');
  const [saved, setSaved] = useState(false);

  const save = (e) => {
    e.preventDefault();
    // TODO: PUT /api/users/me
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const num = (k) => (e) => setRanges({ ...ranges, [k]: e.target.value });

  return (
    <form onSubmit={save} className="space-y-8">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Manage your profile, monitoring ranges and notifications."
        right={
          <button type="submit" className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-brand-700">
            {saved ? 'Saved ✓' : 'Save changes'}
          </button>
        }
      />

      <Card eyebrow="Account" title="Profile">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name"><input className={input} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className={input} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
          <Field label="Date of birth"><input type="date" className={input} value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} /></Field>
        </div>
      </Card>

      <Card eyebrow="Monitoring" title="Configured Ranges">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Heart rate min (BPM)"><input type="number" className={input} value={ranges.hrMin} onChange={num('hrMin')} /></Field>
          <Field label="Heart rate max (BPM)"><input type="number" className={input} value={ranges.hrMax} onChange={num('hrMax')} /></Field>
          <Field label="Blood oxygen min (%)"><input type="number" className={input} value={ranges.spo2Min} onChange={num('spo2Min')} /></Field>
          <Field label="Temperature min (°C)"><input type="number" step="0.1" className={input} value={ranges.tempMin} onChange={num('tempMin')} /></Field>
          <Field label="Temperature max (°C)"><input type="number" step="0.1" className={input} value={ranges.tempMax} onChange={num('tempMax')} /></Field>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card eyebrow="Alerts" title="Notifications">
          <ul className="divide-y divide-line border-t border-line">
            {[['push', 'Push notifications'], ['email', 'Email alerts'], ['summary', 'Daily summary']].map(([k, l]) => (
              <li key={k} className="flex items-center justify-between py-4 text-sm">
                {l}
                <Toggle checked={notify[k]} onChange={(v) => setNotify({ ...notify, [k]: v })} label={l} />
              </li>
            ))}
          </ul>
        </Card>

        <Card eyebrow="Display" title="Units">
          <Segmented options={['Metric (°C)', 'Imperial (°F)']} value={units} onChange={setUnits} />
          <p className="mt-4 text-xs text-ink-mute">Applies to temperature readings across the app.</p>
        </Card>
      </div>
    </form>
  );
}
