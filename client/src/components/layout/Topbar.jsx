import { Bell, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth, initials } from '../../context/AuthContext.jsx';

const TITLES = {
  '/': 'Overview', '/live': 'Live Monitoring', '/trends': 'Health Trends', '/history': 'History',
  '/insights': 'AI Insights', '/alerts': 'Alerts', '/watch': 'My Watch', '/settings': 'Settings',
};

export default function Topbar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  return (
    <header className="mx-4 flex items-center justify-between border-b border-line py-4 sm:mx-8">
      <div className="text-sm text-ink-mute">
        Workspace <span className="mx-2">/</span>
        <span className="text-ink">{TITLES[pathname] || 'Overview'}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <button className="relative rounded-lg p-1.5 text-ink-soft hover:bg-white" aria-label="Notifications">
          <Bell size={18} />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>
        <span className="hidden items-center gap-2 text-ink-soft sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Watch Connected
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-medium text-brand-900">{initials(user?.name)}</span>
        <ChevronDown size={16} className="text-ink-soft" />
      </div>
    </header>
  );
}
