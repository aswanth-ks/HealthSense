import {
  Radio, Watch, CheckCircle2, Clock, Zap, Wifi, Signal, MoreHorizontal, AlertCircle,
  HeartPulse, Droplets, Thermometer, Activity, Wind, Move,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import useLiveStream from '../hooks/useLiveStream.js';
import Card from '../components/common/Card.jsx';
import LiveDot from '../components/common/LiveDot.jsx';
import SourceBadge from '../components/common/SourceBadge.jsx';

const time = (d) => (d ? d.toLocaleTimeString('en-US') : '—');
const uptime = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
const fmt = (v, d = 0) => (v == null ? '--' : Number(v).toFixed(d));

const Pill = ({ children, off }) => (
  <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${off ? 'bg-canvas text-ink-soft' : 'bg-brand-50 text-brand-900'}`}>
    <LiveDot className={`!h-1.5 !w-1.5 ${off ? '!bg-ink-mute' : ''}`} /> {children}
  </span>
);

function Waveform({ data }) {
  return (
    <div className="relative flex h-16 items-center gap-[7px]">
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-brand-100" />
      {data.map((v, i) => (
        <span
          key={i}
          className="relative w-[3px] rounded-full bg-brand-500 transition-all duration-700"
          style={{ height: `${v * 100}%`, opacity: 0.45 + (i / data.length) * 0.55 }}
        />
      ))}
    </div>
  );
}

export default function LiveMonitoring() {
  const s = useLiveStream();
  const on = s.connected;

  const channels = [
    { key: 'hr', label: 'Heart Rate', value: `${fmt(s.hr)} BPM`, signal: s.signal.hr, icon: HeartPulse, color: '#d94452', tint: 'bg-red-50' },
    { key: 'spo2', label: 'Blood Oxygen', value: `${fmt(s.spo2)}% SpO₂`, signal: s.signal.spo2, icon: Droplets, color: '#1f9a86', tint: 'bg-brand-50' },
    { key: 'temp', label: 'Temperature', value: `${fmt(s.temp, 1)} °C`, signal: s.signal.temp, icon: Thermometer, color: '#c8892f', tint: 'bg-amber-50' },
    { key: 'bp_sys', label: 'Blood Pressure', value: `${fmt(s.sys)} / ${fmt(s.dia)} mmHg`, signal: s.signal.bp, icon: Activity, color: '#4a7fc1', tint: 'bg-blue-50' },
    { key: 'resp', label: 'Respiration', value: `${fmt(s.resp, 1)} br/min`, signal: s.signal.resp, icon: Wind, color: '#6b7fd7', tint: 'bg-indigo-50' },
    { key: 'movement', label: 'Movement', value: s.movement == null ? '--' : s.movement < 0.1 ? 'Still' : s.movement < 0.45 ? 'Light' : 'Active', signal: s.signal.movement, icon: Move, color: '#5b6b68', tint: 'bg-canvas' },
  ];
  const active = channels.filter((c) => c.signal != null);
  const quality = active.length ? Math.round(active.reduce((a, c) => a + c.signal, 0) / active.length) : 0;
  const qualityLabel = quality >= 90 ? 'Excellent' : quality >= 75 ? 'Good' : quality > 0 ? 'Weak' : 'No signal';
  const hrOk = s.hr != null && s.hr >= 60 && s.hr <= 100;

  const steps = [
    ['Wearable connected', on ? `${s.deviceId} is online` : 'Waiting for the device'],
    ['Measurements received', `${active.length} sensor channels active`],
    ['Monitoring in progress', on ? 'Readings are being evaluated' : 'Paused until data arrives'],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Real-time sensor command center</p>
          <h1 className="mt-3 text-3xl font-medium sm:text-4xl">Live Monitoring</h1>
          <p className="mt-2 text-ink-soft">Watch the latest readings arriving from your connected HealthSense Watch.</p>
        </div>
        <div className="card flex items-center gap-3 px-4 py-3">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${on ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-ink-mute'}`}><Radio size={18} /></span>
          <div className="leading-tight">
            <p className="text-xs font-medium text-brand-900">{on ? 'Live stream active' : 'Stream offline'}</p>
            <p className="text-[11px] text-ink-mute">
              {on ? `Receiving data continuously${s.mode === 'simulation' ? ' · Simulation mode' : ''}` : 'No data in the last 30 seconds'}
            </p>
          </div>
        </div>
      </div>

      {!on && !s.demo && (
        <div className="card flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50/50 px-5 py-4 text-sm">
          <AlertCircle size={18} className="text-amber-600" />
          <span className="flex-1 text-ink-soft">No device is sending data. Power on your ESP32 watch or start the sensor simulator.</span>
          <Link to="/watch" className="text-xs font-medium text-brand-700 hover:underline">How to connect →</Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card eyebrow="Primary live signal" title="Heart Rate" action={<Pill off={!on}>{on ? 'Receiving' : 'Offline'}</Pill>} className="!border-brand-100 !bg-brand-50/40 lg:col-span-2">
          <div className="flex flex-wrap items-end gap-3">
            <span className="text-7xl font-medium leading-none tracking-tight text-brand-900">{fmt(s.hr)}</span>
            <span className="pb-1 text-sm text-ink-mute">BPM</span>
            {s.hr != null && (
              <span className={`ml-2 flex items-center gap-1.5 pb-1.5 text-xs ${hrOk ? 'text-brand-700' : 'text-amber-700'}`}>
                {hrOk ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {hrOk ? 'Within configured range' : 'Outside configured range'}
              </span>
            )}
            {s.sources.hr && <SourceBadge {...s.sources.hr} className="mb-1.5" />}
          </div>
          <div className="mt-8"><Waveform data={s.wave} /></div>
          <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-brand-100 pt-4 text-xs text-ink-mute">
            <span className="flex items-center gap-1.5"><Clock size={14} /> Last packet {time(s.lastPacket)}</span>
            <span className="flex items-center gap-1.5"><Zap size={14} /> Signal latency {s.latency == null ? '—' : `${s.latency} ms`}</span>
          </div>
        </Card>

        <Card eyebrow="Device telemetry" title="HealthSense Watch" action={<Watch size={18} className="text-brand-600" />}>
          <div className="flex items-center gap-4 border-b border-line pb-5">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><Watch size={22} strokeWidth={1.4} /></span>
            <div className="leading-tight">
              <p className="text-sm font-medium">{s.deviceId}</p>
              <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${on ? 'text-brand-600' : 'text-ink-mute'}`}>
                <LiveDot className={`!h-1.5 !w-1.5 ${on ? '' : '!bg-ink-mute'}`} /> {on ? 'Connected over Wi-Fi' : 'Not connected'}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <div>
              <dt className="text-xs text-ink-mute">Battery</dt>
              <dd className="mt-1 font-medium">{s.battery == null ? '—' : `${s.battery}%`}</dd>
              <div className="mt-2 h-1 rounded-full bg-line"><div className="h-full rounded-full bg-brand-500" style={{ width: `${s.battery ?? 0}%` }} /></div>
            </div>
            <div>
              <dt className="text-xs text-ink-mute">Uptime</dt>
              <dd className="mt-1 font-medium">{uptime(s.uptime)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-mute">Packets</dt>
              <dd className="mt-1 font-medium">{s.packets.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-mute">Mode</dt>
              <dd className="mt-1 font-medium">{s.mode === 'simulation' ? 'Simulation' : s.mode === 'sensor' ? 'Sensor' : '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="eyebrow">Incoming sensor channels</p>
            <h2 className="mt-2 text-xl font-medium">Live Sensor Feed</h2>
          </div>
          <span className="flex items-center gap-2 text-xs text-ink-soft"><Signal size={14} /> {active.length} channels active</span>
        </div>
        <ul className="card divide-y divide-line">
          {channels.map(({ key, label, value, signal, icon: Icon, color, tint }) => (
            <li key={label} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
              <div className="flex w-56 items-center gap-4">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`} style={{ color }}><Icon size={18} /></span>
                <div className="leading-tight">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="mt-1 text-xs text-ink-mute">{signal == null ? 'No data' : on ? 'Receiving now' : 'Last known value'}</p>
                </div>
              </div>
              <div className="w-44">
                <p className="text-sm font-medium">{value}</p>
                {s.sources[key] && <SourceBadge {...s.sources[key]} className="mt-1" />}
              </div>
              <div className="flex min-w-[220px] flex-1 items-center gap-3 text-xs">
                <span className="text-ink-mute">Signal</span>
                <div className="h-1 flex-1 rounded-full bg-line"><div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${signal ?? 0}%` }} /></div>
                <span className="w-8 font-medium text-brand-900">{signal == null ? '—' : `${signal}%`}</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                <LiveDot className={`!h-1.5 !w-1.5 ${on && signal != null ? '' : '!bg-ink-mute'}`} /> {on && signal != null ? 'Active' : 'Idle'}
              </span>
              <MoreHorizontal size={18} className="text-ink-soft" />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          eyebrow="Connection diagnostics"
          title="Signal Quality"
          action={<span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs text-brand-900">{qualityLabel}</span>}
        >
          <div className="flex items-center gap-4">
            <div className="relative h-2 flex-1 rounded-full bg-gradient-to-r from-amber-200 via-lime-200 to-brand-500">
              <span className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-[3px] border-brand-500 bg-white transition-all" style={{ left: `calc(${quality}% - 8px)` }} />
            </div>
            <span className="text-lg font-medium text-brand-700">{quality}%</span>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-ink-mute"><span>Weak</span><span>Stable</span><span>Excellent</span></div>
          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5 text-sm">
            <div><dt className="text-xs text-ink-mute">Wi-Fi strength</dt><dd className="mt-1 flex items-center gap-1.5 font-medium"><Wifi size={14} /> {on ? 'Excellent' : '—'}</dd></div>
            <div><dt className="text-xs text-ink-mute">Data latency</dt><dd className="mt-1 font-medium">{s.latency == null ? '—' : `${s.latency} ms`}</dd></div>
            <div><dt className="text-xs text-ink-mute">Last sync</dt><dd className="mt-1 font-medium">{time(s.lastPacket)}</dd></div>
          </dl>
        </Card>

        <Card eyebrow="Data pipeline" title="Monitoring Protocol" action={<Pill off={!on}>{on ? 'On' : 'Off'}</Pill>}>
          <ol className="relative space-y-5">
            {steps.map(([t, d], i) => (
              <li key={t} className="relative flex gap-4">
                {i < steps.length - 1 && <span className="absolute left-[15px] top-8 h-5 w-px bg-line" />}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-medium text-brand-700">0{i + 1}</span>
                <div className="leading-tight">
                  <p className="text-sm font-medium">{t}</p>
                  <p className="mt-1 text-xs text-ink-mute">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
