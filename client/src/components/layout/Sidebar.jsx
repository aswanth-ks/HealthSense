import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, Activity, BarChart3, Clock, Brain, AlertCircle, Watch, Settings, HeartPulse, MoreHorizontal, LogOut, GitCommitVertical,
} from 'lucide-react';
import { useAuth, initials } from '../../context/AuthContext.jsx';
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

export default function Sidebar({ open, onClose }) {
  const { user, isDemo, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const { questions } = useQuestions('open');
  const pending = questions?.length || 0;
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-[#fbfdfc] transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-7 pb-6 pt-8">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
            <HeartPulse size={20} />
          </span>
          <span className="text-xl font-semibold tracking-tight">HealthSense</span>
        </div>

        <p className="eyebrow px-7 pb-2 pt-6">Workspace</p>
        <nav className="flex flex-col gap-1 px-4">
          {NAV.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-brand-50 font-medium text-brand-900' : 'text-ink-soft hover:bg-brand-50/60'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.6} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] ${pending ? 'bg-red-500 text-white' : 'bg-line text-ink-soft'}`}>{pending}</span>
              )}
            </NavLink>
          ))}
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
              <p className="text-xs text-ink-mute">{isDemo ? 'Demo mode' : user?.role === 'clinician' ? 'Clinician account' : 'Personal account'}</p>
            </div>
            <button onClick={() => setMenu(!menu)} aria-label="Account menu" className="rounded-lg p-1 hover:bg-brand-50/60">
              <MoreHorizontal size={18} className="text-ink-soft" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
