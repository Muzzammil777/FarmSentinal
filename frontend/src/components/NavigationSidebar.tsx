import { memo, useEffect } from 'react';
import { Camera, Gauge, Menu, Settings, Shield, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

interface NavigationSidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/camera', label: 'Camera', icon: Camera },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavigationSidebarBase({ open, onClose }: NavigationSidebarProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          />
        ) : null}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl shadow-slate-950/25 transition-transform duration-300 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-sidebar-border px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sidebar-accent/70 text-accent-foreground">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight text-white">FarmSentinal</p>
                  <p className="text-xs text-sidebar-foreground/70">ESP8266 perimeter control</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-sidebar-border/70 bg-sidebar-accent/60 p-2 transition hover:bg-sidebar-accent lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/10 text-white shadow-lg shadow-black/10'
                        : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-5 w-5 ${isActive ? 'text-accent' : 'text-sidebar-foreground/70'}`} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.9)]" />
                <p className="text-sm font-medium text-white">System online</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-sidebar-foreground/65">
                Polling sensor data and camera detections from the active edge devices.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export const NavigationSidebar = memo(NavigationSidebarBase);
