import { HeartPulse } from 'lucide-react';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
            <HeartPulse size={22} />
          </span>
          <span className="text-2xl font-semibold tracking-tight">HealthSense</span>
        </div>
        <section className="card p-8">
          <h1 className="text-2xl font-medium">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>
        <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>
      </div>
    </div>
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
