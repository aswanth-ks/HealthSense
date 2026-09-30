import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-h-screen flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-white">
            <Menu size={20} />
          </button>
        </div>
        <Topbar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-10 pt-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
