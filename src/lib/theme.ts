import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePalette = 'forest' | 'ocean' | 'berry';
const KEY = 'wlt:theme';
const PALETTE_KEY = 'wlt:palette';
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

export function getPalette(): ThemePalette {
  try {
    const palette = localStorage.getItem(PALETTE_KEY);
    if (palette === 'forest' || palette === 'ocean' || palette === 'berry') return palette;
  } catch {
    /* ignore */
  }
  return 'forest';
}

export function applyTheme() {
  const m = getMode();
  const dark = m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.palette = getPalette();
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().replace(/ /g, ', ');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${background})`);
}

export function applySystemTheme() {
  applyTheme();
  listeners.forEach((listener) => listener());
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

export function setPalette(palette: ThemePalette) {
  try {
    localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    /* ignore */
  }
  applyTheme();
  listeners.forEach((listener) => listener());
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

export function useThemeDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => document.documentElement.classList.contains('dark')
  );
}

export function useThemePalette(): ThemePalette {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPalette
  );
}
