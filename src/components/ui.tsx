import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, todayISO } from '../lib/dates';
import { clamp } from '../lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      {children}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5', className)}>
      {children}
    </section>
  );
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-display text-lg font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function ProgressBar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'warn' }) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className="h-2.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-300', tone === 'warn' ? 'bg-warn' : 'bg-accent')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};
export function Button({ variant = 'secondary', className, ...p }: BtnProps) {
  const v = {
    primary: 'bg-accent text-on-accent hover:opacity-90',
    secondary: 'border border-line bg-surface text-ink hover:bg-bg',
    ghost: 'text-muted hover:bg-bg hover:text-ink',
    danger: 'bg-danger text-white hover:opacity-90',
  }[variant];
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        v,
        className
      )}
    />
  );
}

export function IconButton({ label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...p}
      className={cx(
        'inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:bg-bg hover:text-ink',
        className
      )}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...p },
  ref
) {
  return <input ref={ref} {...p} className={cx(inputCls, className)} />;
});
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, className)} />;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, 'py-2', className)} />;
}

export function Message({ tone, children }: { tone: 'ok' | 'error' | 'warn'; children: ReactNode }) {
  const t = {
    ok: 'border-accent/40 bg-accent-soft text-ink',
    error: 'border-danger/40 bg-warn-soft text-ink',
    warn: 'border-warn/40 bg-warn-soft text-ink',
  }[tone];
  return (
    <div role={tone === 'ok' ? 'status' : 'alert'} className={cx('rounded-xl border px-4 py-3 text-sm', t)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayISO();
  return (
    <div className="flex items-center gap-1">
      <IconButton label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft size={20} />
      </IconButton>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Selected date"
        className={cx(inputCls, 'w-auto')}
      />
      <IconButton label="Next day" onClick={() => onChange(addDays(date, 1))}>
        <ChevronRight size={20} />
      </IconButton>
      {date !== today && (
        <Button variant="ghost" onClick={() => onChange(today)}>
          Today
        </Button>
      )}
    </div>
  );
}

type ConfirmOpts = { title: string; message: string; confirmLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | undefined>(undefined);
  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    []
  );
  const close = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onKeyDown={(e) => e.key === 'Escape' && close(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl">
            <h2 id="confirm-title" className="font-display text-lg font-semibold">
              {opts.title}
            </h2>
            <p className="mt-2 text-sm text-muted">{opts.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button autoFocus onClick={() => close(false)}>
                Cancel
              </Button>
              <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {opts.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
