import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import MobileNav from './MobileNav.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import ConnectionBanner from '../common/ConnectionBanner.jsx';
import { InputProvider } from '../../context/InputContext.jsx';

export default function AppLayout() {
  const { pathname } = useLocation();

  return (
    <InputProvider>
      <div className="min-h-screen lg:pl-64">
        <Sidebar />
        <div className="flex min-h-screen flex-col">
          <Topbar />
          <ConnectionBanner />
          {/* Extra bottom padding on phones so content clears the tab bar */}
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-5 sm:px-8 sm:pt-6 lg:pb-10">
            <ErrorBoundary resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        <MobileNav />
      </div>
    </InputProvider>
  );
}
