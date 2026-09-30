import { Bell, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, initials } from '../../context/AuthContext.jsx';
import useLiveStream from '../../hooks/useLiveStream.js';
import useQuestions from '../../hooks/useQuestions.js';
import SymptomLogButton from '../input/SymptomLogButton.jsx';

const TITLES = {
  '/': 'Overview', '/live': 'Live Monitoring', '/trends': 'Health Trends', '/history': 'History',
  '/insights': 'AI Insights', '/timeline': 'Timeline', '/alerts': 'Alerts & Questions', '/watch': 'My Watch', '/settings': 'Settings',
};

export default function Topbar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { connected } = useLiveStream();
  const { questions } = useQuestions('open');
  const pending = questions?.length || 0;

  return (
    <header className="mx-4 flex items-center justify-between gap-3 border-b border-line py-4 sm:mx-8">
      <div className="truncate text-sm text-ink-mute">
        Workspace <span className="mx-2">/</span>
        <span className="text-ink">{TITLES[pathname] || 'Overview'}</span>
      </div>
      <div className="flex items-center gap-3 text-sm sm:gap-4">
        <SymptomLogButton />
        <Link to="/alerts" className="relative rounded-lg p-1.5 text-ink-soft hover:bg-white" aria-label={`${pending} questions waiting`}>
          <Bell size={18} />
          {pending > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">{pending}</span>
          )}
        </Link>
        <span className="hidden items-center gap-2 text-ink-soft md:flex">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-ink-mute'}`} /> {connected ? 'Watch Connected' : 'Watch Offline'}
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-medium text-brand-900">{initials(user?.name)}</span>
        <ChevronDown size={16} className="hidden text-ink-soft sm:block" />
      </div>
    </header>
  );
}
