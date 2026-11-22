export const fmt = (n: number | null | undefined, digits = 0): string =>
  n == null || !Number.isFinite(n)
    ? '–'
    : n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtKg = (n: number | null | undefined) => (n == null ? '–' : `${fmt(n, 1)} kg`);

export const fmtSigned = (n: number | null | undefined, digits = 1): string => {
  if (n == null || !Number.isFinite(n)) return '–';
  const s = fmt(Math.abs(n), digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
};

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
