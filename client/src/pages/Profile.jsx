import Section from '../components/common/Section.jsx';
import { Link } from 'react-router-dom';
import {
  BarChart3, Clock, AlertCircle, Watch, Settings, FlaskConical, Download, LogOut, ChevronRight, ShieldCheck, Smartphone, Share, CheckCircle2, CalendarHeart,
} from 'lucide-react';
import { useAuth, initials } from '../context/AuthContext.jsx';
import { usePwa } from '../context/PwaContext.jsx';
import useQuestions from '../hooks/useQuestions.js';

function Row({ to, icon: Icon, label, hint, badge, tint = 'bg-canvas text-ink-soft' }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/60">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tint}`}><Icon size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block truncate text-xs text-ink-mute">{hint}</span>}
      </span>
      {badge > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] text-white">{badge}</span>}
      <ChevronRight size={17} className="text-ink-mute" />
    </Link>
  );
}

// Phone "Profile" tab: account, the remaining pages, Demo Mode, app install and sign-out.
export default function Profile() {
  const { user, isDemo, logout } = useAuth();
  const { installed, canInstall, install, isIOS } = usePwa();
  const { questions } = useQuestions('open');

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="card flex items-center gap-4 p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-semibold text-brand-900">{initials(user?.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium">{user?.name}</p>
          <p className="truncate text-xs text-ink-mute">{isDemo ? 'Viewing sample data' : user?.email}</p>
        </div>
        <Link to="/settings" className="rounded-xl border border-line px-3 py-2 text-xs text-ink-soft hover:bg-canvas">Edit</Link>
      </section>

      <Link to="/demo" className="card flex items-center gap-4 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white"><FlaskConical size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-indigo-900">Demo Mode</span>
          <span className="block text-xs text-indigo-800/80">Simulate monitoring, sleep patterns, symptoms, missing data and triage changes</span>
        </span>
        <ChevronRight size={18} className="text-indigo-400" />
      </Link>

      <Section tone="slate" className="!p-2 sm:!p-3">
        <section className="card divide-y divide-line overflow-hidden">
          <Row to="/alerts" icon={AlertCircle} label="Alerts & Questions" hint="Questions the system needs answered" badge={questions?.length || 0} tint="bg-red-50 text-red-500" />
          {user?.cycle?.tracking && <Row to="/cycle" icon={CalendarHeart} label="Cycle & Health" hint="Cycle context, patterns and cycle-aware baseline" tint="bg-rose-50 text-rose-500" />}
          <Row to="/trends" icon={BarChart3} label="Health Trends" hint="Your vitals against your personal baseline" tint="bg-brand-50 text-brand-600" />
          <Row to="/history" icon={Clock} label="History" hint="24-hour monitoring cycles and readings" tint="bg-blue-50 text-blue-600" />
          <Row to="/watch" icon={Watch} label="My Watch" hint="Device status and connection" tint="bg-amber-50 text-amber-600" />
          <Row to="/settings" icon={Settings} label="Settings" hint="Profile, medical history, cycle tracking, ranges" />
        </section>
      </Section>

      {/* Install */}
      <Section tone="sky" className="!p-2 sm:!p-3">
        <section className="card p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Smartphone size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">HealthSense app</p>
              {installed ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-700"><CheckCircle2 size={13} /> Installed — you're using the app.</p>
              ) : canInstall ? (
                <>
                  <p className="mt-1 text-xs text-ink-soft">Add HealthSense to your home screen and open it like an app.</p>
                  <button onClick={install} className="mt-3 flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700">
                    <Download size={14} /> Install HealthSense
                  </button>
                </>
              ) : isIOS ? (
                <p className="mt-1 text-xs text-ink-soft">On iPhone: tap <Share size={12} className="inline" /> <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</p>
              ) : (
                <p className="mt-1 text-xs text-ink-soft">Open this site in Chrome on your phone and choose <b>Install app</b> (or <b>Add to Home screen</b>) from the browser menu.</p>
              )}
            </div>
          </div>
        </section>
      </Section>

      <p className="flex gap-2 px-1 text-[11px] leading-relaxed text-ink-mute">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        HealthSense provides risk-pattern identification and triage support. It does not diagnose medical conditions. Always consult a healthcare professional for medical advice.
      </p>

      <button onClick={logout} className="card flex w-full items-center justify-center gap-2 p-3.5 text-sm font-medium text-red-600 hover:bg-red-50">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
