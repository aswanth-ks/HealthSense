import { Watch, Wifi } from 'lucide-react';
import Card from '../common/Card.jsx';
import LiveDot from '../common/LiveDot.jsx';

const SENSORS = ['HR', 'SpO₂', 'Temp', 'BP'];

export default function WearableCard({ device }) {
  return (
    <Card
      eyebrow="Connected Wearable"
      title={device.name}
      action={
        <span className="flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs text-brand-900">
          <LiveDot /> {device.connected ? 'Connected' : 'Offline'}
        </span>
      }
    >
      <div className="flex gap-5">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Watch size={36} strokeWidth={1.4} />
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-ink-mute">Battery</dt>
            <dd className="font-medium">{device.battery}%</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-mute">Wi-Fi</dt>
            <dd className="flex items-center gap-1.5 font-medium text-brand-600"><Wifi size={14} /> Connected</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-ink-mute">Device ID</dt>
            <dd className="font-medium">{device.id}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs text-ink-mute">
        <span>Sensor status</span>
        <span className="flex gap-3">
          {SENSORS.map((s) => (
            <span key={s} className="flex items-center gap-1"><LiveDot className="!h-1.5 !w-1.5" /> {s}</span>
          ))}
        </span>
      </div>
    </Card>
  );
}
