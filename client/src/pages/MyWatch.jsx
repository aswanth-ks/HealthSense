import { Watch, Wifi, WifiOff, HeartPulse, Thermometer, Wind, Move } from 'lucide-react';
import Section from '../components/common/Section.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import LiveDot from '../components/common/LiveDot.jsx';
import ConnectDeviceCard from '../components/dashboard/ConnectDeviceCard.jsx';
import useLiveStream from '../hooks/useLiveStream.js';
import { useAuth } from '../context/AuthContext.jsx';

// Hardware from the MVP spec (§27-B)
const SENSORS = [
  { label: 'MAX30102', detail: 'Heart rate + SpO₂', icon: HeartPulse, metrics: ['hr', 'spo2'] },
  { label: 'MPU6050', detail: 'Movement + body position', icon: Move, metrics: ['movement'] },
  { label: 'Respiration sensor', detail: 'Breathing rate / pattern', icon: Wind, metrics: ['resp'] },
  { label: 'Temperature sensor', detail: 'Temperature trend', icon: Thermometer, metrics: ['temp'] },
];

const time = (d) => (d ? d.toLocaleTimeString('en-US') : '—');

export default function MyWatch() {
  const s = useLiveStream();
  const { user } = useAuth();
  const on = s.connected;

  const details = [
    ['Device ID', s.deviceId],
    ['Mode', s.mode === 'simulation' ? 'Simulation' : s.mode === 'sensor' ? 'ESP32 sensor' : '—'],
    ['Connection', on ? 'Wi-Fi' : 'Offline'],
    ['Last data', time(s.lastPacket)],
    ['Packets received', s.packets.toLocaleString()],
    ['Latency', s.latency == null ? '—' : `${s.latency} ms`],
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connected wearable"
        title="My Watch"
        subtitle="Manage your HealthSense Watch, its sensors and how it sends data."
        right={
          <span className={`card flex items-center gap-2 px-4 py-2.5 text-xs ${on ? 'text-brand-900' : 'text-ink-soft'}`}>
            <LiveDot className={on ? '' : '!bg-ink-mute'} /> {on ? 'Receiving data' : 'Not connected'}
          </span>
        }
      />

      <Section tone="indigo">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card
            eyebrow="Device"
            title="HealthSense Watch"
            className="lg:col-span-2"
            action={
              <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${on ? 'bg-brand-50 text-brand-900' : 'bg-canvas text-ink-soft'}`}>
                <LiveDot className={on ? '' : '!bg-ink-mute'} /> {on ? 'Connected' : 'Offline'}
              </span>
            }
          >
            <div className="flex flex-col gap-6 sm:flex-row">
              <span className="grid h-32 w-32 shrink-0 place-items-center rounded-3xl bg-brand-50 text-brand-600"><Watch size={56} strokeWidth={1.2} /></span>
              <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-5 text-sm">
                {details.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-ink-mute">{k}</dt>
                    <dd className="mt-1 flex items-center gap-1.5 font-medium">
                      {k === 'Connection' && (on ? <Wifi size={14} className="text-brand-600" /> : <WifiOff size={14} className="text-ink-mute" />)}
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>

          <Card eyebrow="Power" title="Battery">
            <p className="text-4xl font-medium text-brand-700">{s.battery == null ? '—' : `${s.battery}%`}</p>
            <div className="mt-4 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-brand-500" style={{ width: `${s.battery ?? 0}%` }} /></div>
            <p className="mt-3 text-xs text-ink-mute">{s.battery == null ? 'Reported by the device once connected' : s.battery < 20 ? 'Charge soon' : 'Battery level is fine'}</p>
          </Card>
        </div>
      </Section>

      <Section tone="slate" className="!p-2 sm:!p-3">
        <Card eyebrow="Hardware" title="Sensors">
          <ul className="divide-y divide-line border-t border-line">
            {SENSORS.map(({ label, detail, icon: Icon, metrics }) => {
              const signals = metrics.map((m) => s.signal[m]).filter((v) => v != null);
              const ok = on && signals.length > 0;
              return (
                <li key={label} className="flex flex-wrap items-center gap-4 py-4 text-sm">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={18} /></span>
                  <div className="flex-1">
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-ink-mute">{detail}</p>
                  </div>
                  {signals.length > 0 && <span className="text-xs text-ink-soft">Signal {Math.round(signals.reduce((a, b) => a + b, 0) / signals.length)}%</span>}
                  <span className="flex w-16 items-center gap-1.5 text-xs text-ink-soft">
                    <LiveDot className={`!h-1.5 !w-1.5 ${ok ? '' : '!bg-ink-mute'}`} /> {ok ? 'Active' : 'Idle'}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </Section>

      <Section tone="sky" className="!p-2 sm:!p-3">
        <ConnectDeviceCard email={user?.email} />
      </Section>
    </div>
  );
}
