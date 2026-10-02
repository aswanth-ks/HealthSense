import { Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, initials } from '../../context/AuthContext.jsx';
import useLiveStream from '../../hooks/useLiveStream.js';
import useQuestions from '../../hooks/useQuestions.js';
import SymptomLogButton from '../input/SymptomLogButton.jsx';

const TITLES = {
  '/': 'Overview', '/live': 'Live Monitoring', '/trends': 'Health Trends', '/history': 'History',
  '/insights': 'AI Insights', '/timeline': 'Timeline', '/alerts': 'Alerts & Questions', '/watch': 'My Watch',
  '/settings': 'Settings', '/profile': 'Profile', '/demo': 'Demo Mode',
};

export default function Topbar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { connected } = useLiveStream();
  const { questions } = useQuestions('open');
  const pending = questions?.length || 0;
  const title = TITLES[pathname] || 'Overview';

  return (
    <header
      className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur lg:static lg:mx-8 lg:bg-transparent lg:backdrop-blur-none"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-0 lg:py-4">
        {/* Phones: app identity + page title. Desktop: breadcrumb. */}
        <Link to="/" className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <img src="/icons/icon-192.png" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="truncate text-base font-semibold tracking-tight">{pathname === '/' ? 'HealthSense' : title}</span>
        </Link>
        <div className="hidden truncate text-sm text-ink-mute lg:block">
          Workspace <span className="mx-2">/</span>
          <span className="text-ink">{title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-4">
          <SymptomLogButton />
          <Link to="/alerts" className="relative rounded-lg p-2 text-ink-soft hover:bg-white" aria-label={`${pending} questions waiting`}>
            <Bell size={19} />
            {pending > 0 && (
              <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">{pending}</span>
            )}
          </Link>
          <span className="hidden items-center gap-2 text-ink-soft md:flex">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-ink-mute'}`} /> {connected ? 'Watch Connected' : 'Watch Offline'}
          </span>
          <Link to="/profile" className="hidden h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-medium text-brand-900 lg:grid" aria-label="Profile">
            {initials(user?.name)}
          </Link>
        </div>
      </div>
    </header>
  );
}
