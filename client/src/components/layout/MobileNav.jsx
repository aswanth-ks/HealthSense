import { NavLink, useLocation } from 'react-router-dom';
import { Home, Activity, Brain, GitCommitVertical, UserRound } from 'lucide-react';
import useQuestions from '../../hooks/useQuestions.js';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/live', label: 'Monitoring', icon: Activity },
  { to: '/insights', label: 'Insights', icon: Brain },
  { to: '/timeline', label: 'Timeline', icon: GitCommitVertical },
  { to: '/profile', label: 'Profile', icon: UserRound, also: ['/trends', '/history', '/alerts', '/watch', '/settings', '/demo'] },
];

// Bottom tab bar for phones (hidden on large screens, where the sidebar is used).
export default function MobileNav() {
  const { pathname } = useLocation();
  const { questions } = useQuestions('open');
  const pending = questions?.length || 0;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end, also }) => {
          const extra = also?.some((p) => pathname.startsWith(p));
          return (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[10.5px] ${isActive || extra ? 'font-medium text-brand-700' : 'text-ink-mute'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${isActive || extra ? 'bg-brand-50' : ''}`}>
                      <Icon size={19} strokeWidth={isActive || extra ? 2 : 1.7} />
                    </span>
                    {label}
                    {to === '/profile' && pending > 0 && (
                      <span className="absolute right-[22%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">{pending}</span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
