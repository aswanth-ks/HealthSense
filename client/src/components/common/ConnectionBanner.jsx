import { useState } from 'react';
import { WifiOff, CloudUpload, AlertTriangle, ChevronDown, X } from 'lucide-react';
import { usePwa } from '../../context/PwaContext.jsx';
import { describe, discard } from '../../services/outbox.js';

const when = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Global status strip: connection state + entries waiting to be uploaded. Never claims data was sent when it wasn't.
export default function ConnectionBanner() {
  const { connected, online, pending, failed, outbox, retry } = usePwa();
  const [open, setOpen] = useState(false);
  if (connected && !pending && !failed) return null;

  const tone = !connected ? 'border-amber-200 bg-amber-50 text-amber-900' : failed ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-900';

  return (
    <div className={`mx-4 mt-3 rounded-xl border px-4 py-2.5 text-xs sm:mx-8 ${tone}`} role="status">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {!connected ? <WifiOff size={15} className="shrink-0" /> : failed ? <AlertTriangle size={15} className="shrink-0" /> : <CloudUpload size={15} className="shrink-0" />}
        <span className="min-w-0 flex-1">
          {!connected && <b>Connection unavailable. </b>}
          {!connected && (online ? 'The HealthSense server cannot be reached. ' : 'Your device is offline. ')}
          {pending > 0 && <>{pending} {pending === 1 ? 'entry is' : 'entries are'} <b>saved on this device, pending sync</b> — not yet uploaded. </>}
          {!connected && !pending && 'New check-ins and answers will be kept on this device until the connection returns.'}
          {failed > 0 && <>{failed} {failed === 1 ? 'entry was' : 'entries were'} not accepted by the server.</>}
        </span>
        {(pending > 0 || failed > 0) && (
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1 font-medium underline-offset-2 hover:underline">
            Details <ChevronDown size={13} className={open ? 'rotate-180' : ''} />
          </button>
        )}
        {connected && pending > 0 && <button onClick={retry} className="font-medium hover:underline">Sync now</button>}
      </div>
      {open && (
        <ul className="mt-2 space-y-1 border-t border-current/10 pt-2">
          {outbox.map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${i.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-white/70'}`}>
                {i.status === 'failed' ? 'Not accepted' : 'Pending sync'}
              </span>
              <span className="flex-1">{describe(i)} · entered {when(i.createdAt)}{i.error ? ` — ${i.error}` : ''}</span>
              {i.status === 'failed' && <button onClick={() => discard(i.id)} aria-label="Dismiss"><X size={13} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
