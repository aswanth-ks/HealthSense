import { useEffect, useState } from 'react';
import { Copy, Check, Eye, EyeOff, Cpu, Terminal } from 'lucide-react';
import Card from '../common/Card.jsx';
import { getDeviceKey, isDemo } from '../../services/healthService.js';

function CopyField({ label, value, secret }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div>
      <p className="mb-1.5 text-xs text-ink-mute">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-xs text-ink">{shown ? value : '•'.repeat(24)}</code>
        {secret && (
          <button type="button" onClick={() => setShown(!shown)} className="text-ink-mute hover:text-ink" aria-label={shown ? 'Hide' : 'Show'}>
            {shown ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <button type="button" onClick={copy} className="text-ink-mute hover:text-ink" aria-label="Copy">
          {copied ? <Check size={14} className="text-brand-600" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function ConnectDeviceCard({ email }) {
  const [key, setKey] = useState(null);
  useEffect(() => { getDeviceKey().then((d) => setKey(d?.deviceKey || null)).catch(() => {}); }, []);

  if (isDemo()) {
    return (
      <Card eyebrow="Setup" title="Connect a device">
        <p className="text-sm text-ink-soft">You are in demo mode. Create an account to pair an ESP32 watch or run the sensor simulator.</p>
      </Card>
    );
  }

  const ingestUrl = `${window.location.origin.replace(/:\d+$/, ':5000')}/api/ingest`;
  const simCmd = `npm run sim -- --email ${email || '<your email>'} --password <your password> --backfill 3`;

  return (
    <Card eyebrow="Setup" title="Connect a device">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-medium"><Cpu size={16} className="text-brand-600" /> ESP32 watch</p>
          <p className="text-xs leading-relaxed text-ink-soft">Put these values in the firmware config. The watch sends readings over Wi-Fi with this key.</p>
          <CopyField label="Ingest URL" value={ingestUrl} />
          <CopyField label="Device key (x-device-key header)" value={key || 'Loading…'} secret />
        </div>
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-medium"><Terminal size={16} className="text-brand-600" /> Sensor simulation mode</p>
          <p className="text-xs leading-relaxed text-ink-soft">
            No hardware? Run this from the <code>server/</code> folder. It uploads 3 days of history, then streams live data. Add
            <code className="mx-1">--profile apnea</code> or <code className="mx-1">--profile endo</code> to simulate the demo patterns.
          </p>
          <CopyField label="Command" value={simCmd} />
        </div>
      </div>
    </Card>
  );
}
