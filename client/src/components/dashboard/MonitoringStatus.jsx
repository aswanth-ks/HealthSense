import { HelpCircle, ShieldCheck, Clock, Bluetooth } from 'lucide-react';
import Card from '../common/Card.jsx';

export default function MonitoringStatus({ status, source }) {
  return (
    <Card
      eyebrow="Monitoring Overview"
      title="Overall Monitoring Status"
      action={<HelpCircle size={18} className="text-ink-soft" />}
      className="lg:col-span-2"
    >
      <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
        <div className="grid h-32 w-32 shrink-0 place-items-center rounded-full border-[6px] border-brand-100 bg-brand-50/60">
          <div className="text-center">
            <ShieldCheck size={22} className="mx-auto text-brand-600" />
            <p className="mt-1 text-lg font-medium text-brand-700">{status.label}</p>
            <p className="text-[10px] text-ink-mute">{status.note}</p>
          </div>
        </div>
        <div className="space-y-4 text-sm">
          <p className="max-w-md text-ink-soft">All currently available measurements are within the configured monitoring ranges.</p>
          <p className="flex items-center gap-2 text-ink-soft">
            <Clock size={15} /> Last updated <span className="font-medium text-ink">{status.updatedAt}</span>
          </p>
          <p className="flex items-center gap-2 text-ink-soft">
            <Bluetooth size={15} /> Source <span className="font-medium text-ink">{source}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
