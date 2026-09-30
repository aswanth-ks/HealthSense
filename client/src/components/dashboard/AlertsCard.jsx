import { CheckCircle2, MoreHorizontal } from 'lucide-react';

export default function AlertsCard() {
  return (
    <section className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">Safety Monitoring</p>
          <h2 className="mt-1 text-lg font-medium">Alerts</h2>
        </div>
        <MoreHorizontal size={18} className="text-ink-soft" />
      </div>
      <div className="mt-5 flex items-center gap-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600"><CheckCircle2 size={20} /></span>
        <div>
          <p className="text-sm font-medium">You&apos;re all caught up</p>
          <p className="text-xs text-ink-soft">No new monitoring alerts.</p>
        </div>
      </div>
      <p className="mt-6 text-xs text-ink-mute">All monitored measurements are currently within the configured ranges.</p>
    </section>
  );
}
