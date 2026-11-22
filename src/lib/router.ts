import { useSyncExternalStore } from 'react';

const normalize = (h: string) => {
  const p = h.replace(/^#/, '').split('?')[0];
  return p === '' ? '/' : p;
};

export function useRoute(): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb);
      return () => window.removeEventListener('hashchange', cb);
    },
    () => normalize(window.location.hash)
  );
}

export const navigate = (path: string) => {
  window.location.hash = path;
};
