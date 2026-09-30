import { Brain, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InsightCard({ text }) {
  return (
    <section className="card p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Brain size={18} /></span>
        <div className="flex-1">
          <p className="eyebrow">AI-Generated Interpretation</p>
          <h2 className="mt-1 text-lg font-medium">AI Health Insight</h2>
        </div>
        <span className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-soft">BETA</span>
      </div>
      <p className="mt-5 text-ink-soft">{text}</p>
      <div className="mt-6 flex items-center justify-between text-xs">
        <span className="text-ink-mute">Based on recent monitored readings</span>
        <Link to="/insights" className="flex items-center gap-1.5 text-sm text-brand-700 hover:underline">
          View insights <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
