import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'wlt:theme';
const listeners = new Set<() => void>();

export function getMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function applyTheme() {
  const m = getMode();
  const dark = m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1613' : '#f3f5f1');
}

export function setMode(m: ThemeMode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* ignore */
  }
  applyTheme();
  listeners.forEach((l) => l());
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getMode
  );
}
