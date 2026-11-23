import { useState, type ReactNode } from 'react';
import {
  CalendarCheck,
  DatabaseBackup,
  Dumbbell,
  History,
  LayoutDashboard,
  MoreHorizontal,
  Moon,
  Scale,
  Settings,
  Sun,
  TrendingDown,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { cx, Message } from './ui';
import { useStore } from '../store';
import { setMode, useThemeDark, useThemeMode } from '../lib/theme';

export const NAV: { path: string; label: string; icon: LucideIcon; primary: boolean }[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { path: '/daily', label: 'Daily Tracker', icon: CalendarCheck, primary: true },
  { path: '/weight', label: 'Weight', icon: Scale, primary: true },
  { path: '/nutrition', label: 'Nutrition', icon: Utensils, primary: true },
  { path: '/gym', label: 'Gym', icon: Dumbbell, primary: true },
  { path: '/history', label: 'History', icon: History, primary: false },
  { path: '/backup', label: 'Backup & Restore', icon: DatabaseBackup, primary: false },
  { path: '/settings', label: 'Settings', icon: Settings, primary: false },
];

function ThemeToggle({ className }: { className?: string }) {
  const mode = useThemeMode();
  const dark = useThemeDark();
  return (
    <button
      type="button"
      onClick={() => setMode(dark ? 'light' : 'dark')}
      className={cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-bg hover:text-ink', className)}
      data-mode={mode}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
      {dark ? 'Light theme' : 'Dark theme'}
    </button>
  );
}

export default function Layout({ route, children }: { route: string; children: ReactNode }) {
  const { storageError } = useStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = NAV.some((n) => !n.primary && n.path === route);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 pt-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-on-accent">
            <TrendingDown size={20} />
          </span>
          <span className="font-display text-lg font-bold">Progress Tracker</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map(({ path, label, icon: Icon }) => (
            <a
              key={path}
              href={`#${path}`}
              aria-current={route === path ? 'page' : undefined}
              className={cx(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
                route === path ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-bg hover:text-ink'
              )}
            >
              <Icon size={20} className={route === path ? 'text-accent' : ''} />
              {label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </aside>

      <main className="w-full px-4 pb-32 pt-6 md:ml-60 md:w-[calc(100%-15rem)] md:px-8 md:pb-10">
        <div className="mx-auto max-w-5xl">
        {storageError && (
          <div className="mb-4">
            <Message tone="error">{storageError}</Message>
          </div>
        )}
        {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] rounded-2xl border border-line bg-surface p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV.filter((n) => !n.primary).map(({ path, label, icon: Icon }) => (
              <a
                key={path}
                href={`#${path}`}
                onClick={() => setMoreOpen(false)}
                className={cx(
                  'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium',
                  route === path ? 'bg-accent-soft' : 'hover:bg-bg'
                )}
              >
                <Icon size={20} className="text-accent" />
                {label}
              </a>
            ))}
            <ThemeToggle className="w-full" />
          </div>
        </div>
      )}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
      >
        {NAV.filter((n) => n.primary).map(({ path, label, icon: Icon }) => (
          <a
            key={path}
            href={`#${path}`}
            onClick={() => setMoreOpen(false)}
            aria-current={route === path ? 'page' : undefined}
            aria-label={label}
            className={cx(
              'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
              route === path ? 'text-accent' : 'text-muted'
            )}
          >
            <Icon size={22} />
            {label === 'Dashboard' ? 'Home' : label === 'Daily Tracker' ? 'Daily' : label === 'Nutrition' ? 'Food' : label}
          </a>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={cx(
            'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
            secondaryActive || moreOpen ? 'text-accent' : 'text-muted'
          )}
        >
          <MoreHorizontal size={22} />
          More
        </button>
      </nav>
    </div>
  );
}
