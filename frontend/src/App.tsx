import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Menu, PanelLeftClose } from 'lucide-react';
import { NavigationSidebar } from './components/NavigationSidebar';
import { Camera } from './pages/Camera';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/camera': 'Camera',
  '/settings': 'Settings',
};

type MobileHeaderProps = {
  pageTitle: string;
  onOpen: () => void;
  onClose: () => void;
};

function MobileHeaderBase({ pageTitle, onOpen, onClose }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground transition hover:bg-muted"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">FarmSentinal</p>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{pageTitle}</h1>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground transition hover:bg-muted"
          aria-label="Close navigation"
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

const MobileHeader = memo(MobileHeaderBase);

function AppLayoutBase() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar, location.pathname]);

  const pageTitle = useMemo(() => {
    return PAGE_TITLES[location.pathname] ?? 'Dashboard';
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavigationSidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="lg:pl-72">
        <MobileHeader pageTitle={pageTitle} onOpen={openSidebar} onClose={closeSidebar} />

        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

const AppLayout = memo(AppLayoutBase);

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
