import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, Activity, BarChart3, Clock, Brain, AlertCircle, Watch, Settings, HeartPulse, MoreHorizontal, LogOut, GitCommitVertical, FlaskConical, Download, CalendarHeart,
} from 'lucide-react';
import { useAuth, initials } from '../../context/AuthContext.jsx';
import { usePwa } from '../../context/PwaContext.jsx';
import useQuestions from '../../hooks/useQuestions.js';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutGrid },
  { to: '/live', label: 'Live Monitoring', icon: Activity },
  { to: '/trends', label: 'Health Trends', icon: BarChart3 },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/insights', label: 'AI Insights', icon: Brain },
  { to: '/timeline', label: 'Timeline', icon: GitCommitVertical },
  { to: '/alerts', label: 'Alerts', icon: AlertCircle, badge: 'questions' },
  { to: '/watch', label: 'My Watch', icon: Watch },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// Desktop sidebar (phones use the bottom tab bar in MobileNav).
export default function Sidebar() {
  const { user, isDemo, logout } = useAuth();
  const { canInstall, install } = usePwa();
  const [menu, setMenu] = useState(false);
  const { questions } = useQuestions('open');
  const pending = questions?.length || 0;

  const link = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${isActive ? 'bg-brand-50 font-medium text-brand-900' : 'text-ink-soft hover:bg-brand-50/60'}`;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-[#fbfdfc] lg:flex">
      <div className="flex items-center gap-3 px-7 pb-6 pt-8">
        <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
        <span className="text-xl font-semibold tracking-tight">HealthSense</span>
      </div>

      <p className="eyebrow px-7 pb-2 pt-4">Workspace</p>
      <nav className="flex flex-col gap-1 overflow-y-auto px-4">
        {NAV.map(({ to, label, icon: Icon, badge }) => (
          <NavLink key={to} to={to} end={to === '/'} className={link}>
            <Icon size={18} strokeWidth={1.6} />
            <span className="flex-1">{label}</span>
            {badge && (
              <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] ${pending ? 'bg-red-500 text-white' : 'bg-line text-ink-soft'}`}>{pending}</span>
            )}
          </NavLink>
        ))}
        {user?.cycle?.tracking && (
          <NavLink to="/cycle" className={link}>
            <CalendarHeart size={18} strokeWidth={1.6} /> <span className="flex-1">Cycle &amp; Health</span>
          </NavLink>
        )}
        <NavLink to="/demo" className={({ isActive }) => `mt-3 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${isActive ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-800' : 'border-indigo-100 text-indigo-700 hover:bg-indigo-50'}`}>
          <FlaskConical size={18} strokeWidth={1.7} /> <span className="flex-1">Demo Mode</span>
        </NavLink>
        {canInstall && (
          <button onClick={install} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-brand-700 hover:bg-brand-50/60">
            <Download size={18} strokeWidth={1.7} /> Install app
          </button>
        )}
      </nav>

      <div className="relative mt-auto border-t border-line p-4">
        {menu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 rounded-xl border border-line bg-white p-1 shadow-card">
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-brand-50/60">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-xs font-medium text-brand-900">{initials(user?.name)}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-ink-mute">{isDemo ? 'Sample data' : 'Personal account'}</p>
          </div>
          <button onClick={() => setMenu(!menu)} aria-label="Account menu" className="rounded-lg p-1 hover:bg-brand-50/60">
            <MoreHorizontal size={18} className="text-ink-soft" />
          </button>
        </div>
      </div>
    </aside>
  );
}
