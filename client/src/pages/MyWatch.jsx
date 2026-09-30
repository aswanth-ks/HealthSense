import { useState } from 'react';
import { Watch, Wifi, RefreshCw, HeartPulse, Droplets, Thermometer, Activity } from 'lucide-react';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import LiveDot from '../components/common/LiveDot.jsx';

const SENSORS = [
  { label: 'Heart rate (PPG)', icon: HeartPulse },
  { label: 'Blood oxygen (SpO₂)', icon: Droplets },
  { label: 'Skin temperature', icon: Thermometer },
  { label: 'Blood pressure', icon: Activity },
];

export default function MyWatch() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('10:27:08 AM');

  const sync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setLastSync(new Date().toLocaleTimeString('en-US')); }, 1200);
  };

  const details = [['Device ID', 'HS-WATCH-001'], ['Firmware', 'v1.4.2'], ['Connection', 'Wi-Fi'], ['Last sync', lastSync]];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connected wearable"
        title="My Watch"
        subtitle="Manage your HealthSense Watch and its sensors."
        right={
          <button onClick={sync} disabled={syncing} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          eyebrow="Device"
          title="HealthSense Watch"
          className="lg:col-span-2"
          action={<span className="flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs text-brand-900"><LiveDot /> Connected</span>}
        >
          <div className="flex flex-col gap-6 sm:flex-row">
            <span className="grid h-32 w-32 shrink-0 place-items-center rounded-3xl bg-brand-50 text-brand-600"><Watch size={56} strokeWidth={1.2} /></span>
            <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-5 text-sm">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-ink-mute">{k}</dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-medium">{k === 'Connection' && <Wifi size={14} className="text-brand-600" />}{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card eyebrow="Power" title="Battery">
          <p className="text-4xl font-medium text-brand-700">84%</p>
          <div className="mt-4 h-1.5 rounded-full bg-line"><div className="h-full w-[84%] rounded-full bg-brand-500" /></div>
          <p className="mt-3 text-xs text-ink-mute">About 2 days remaining</p>
        </Card>
      </div>

      <Card eyebrow="Hardware" title="Sensors">
        <ul className="divide-y divide-line border-t border-line">
          {SENSORS.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-4 py-4 text-sm">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={18} /></span>
              <span className="flex-1 font-medium">{label}</span>
              <span className="flex items-center gap-1.5 text-xs text-ink-soft"><LiveDot className="!h-1.5 !w-1.5" /> Active</span>
            </li>
          ))}
        </ul>
      </Card>

      <div>
        <button className="rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50">Disconnect watch</button>
      </div>
    </div>
  );
}
