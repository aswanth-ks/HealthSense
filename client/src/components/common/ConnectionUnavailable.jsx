import { WifiOff, RefreshCw } from 'lucide-react';

// Shown in place of data that could not be loaded. Never replaced by sample data.
export default function ConnectionUnavailable({ onRetry, compact = false }) {
  return (
    <section className={`card flex flex-col items-center text-center ${compact ? 'px-5 py-8' : 'px-6 py-14'}`}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600"><WifiOff size={22} /></span>
      <h2 className="mt-4 text-base font-medium">Connection unavailable</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">
        Your health data could not be loaded from the HealthSense server. Nothing shown here is out-of-date data presented as current.
      </p>
      <button onClick={() => (onRetry ? onRetry() : window.location.reload())} className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-xs font-medium hover:bg-canvas">
        <RefreshCw size={14} /> Try again
      </button>
    </section>
  );
}
