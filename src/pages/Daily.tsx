import { useState } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, DateNav, Input, ProgressBar, Textarea, cx, useConfirm } from '../components/ui';
import { checklistProgress, checklistStates, dayTotals } from '../lib/calc';
import { formatLong, isFutureISO, todayISO } from '../lib/dates';
import { emptyDaily } from '../lib/schema';
import { fmt } from '../lib/format';
import { MAX_DAILY_STEPS } from '../constants';
import type { ChecklistItem } from '../types';

export default function Daily() {
  const { data, selectedDate: date, setSelectedDate, toggleCheck, updateDaily, addWater } = useStore();
  const confirm = useConfirm();
  const { profile } = data;
  const futureDate = isFutureISO(date);
  const rec = data.daily[date] ?? emptyDaily(date, data.checklistItems);
  const totals = dayTotals(data.foods, date);
  const hasWeight = data.weights.some((w) => w.date === date);
  const workout = data.workouts.find((w) => w.date === date);
  const [custom, setCustom] = useState('');
  const checklist = checklistProgress(data.checklistItems, rec, {
    calories: totals.count > 0 && totals.calories <= profile.calorieTarget,
    protein: totals.protein >= profile.proteinTarget,
    steps: (rec.steps ?? 0) >= profile.stepsTarget && (rec.steps ?? 0) <= MAX_DAILY_STEPS,
    water: rec.water >= profile.waterTargetMl,
    weighIn: hasWeight,
    gym: workout?.status === 'completed',
  });
  const states = checklistStates(data.checklistItems, rec, {
    calories: totals.count > 0 && totals.calories <= profile.calorieTarget,
    protein: totals.protein >= profile.proteinTarget,
    steps: (rec.steps ?? 0) >= profile.stepsTarget && (rec.steps ?? 0) <= MAX_DAILY_STEPS,
    water: rec.water >= profile.waterTargetMl,
    weighIn: hasWeight,
    gym: workout?.status === 'completed',
  });
  const automaticStates = states.filter(({ item }) => Boolean(item.autoComplete));
  const manualStates = states.filter(({ item }) => !item.autoComplete);

  const hints: Record<string, string> = {
    calories: totals.count ? `${fmt(totals.calories)} / ${fmt(profile.calorieTarget)} kcal logged` : 'No food logged yet',
    protein: `${fmt(totals.protein, 1)} / ${fmt(profile.proteinTarget)} g logged`,
    steps: `${fmt(rec.steps ?? 0)} / ${fmt(profile.stepsTarget)} steps`,
    gym: workout?.status === 'completed' ? 'Workout completed' : 'No completed session for this date',
    water: `${fmt(rec.water / 1000, 2)} / ${fmt(profile.waterTargetMl / 1000, 1)} L`,
    weighIn: hasWeight ? 'Weight logged' : 'No weigh-in for this date',
  };

  const addCustom = () => {
    const ml = Number(custom);
    if (Number.isFinite(ml) && ml > 0 && ml <= 5000) {
      addWater(date, Math.round(ml));
      setCustom('');
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{date === todayISO() ? 'Today' : 'Viewing'}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{formatLong(date)}</h1>
        </div>
        <DateNav date={date} onChange={setSelectedDate} />
      </header>
      {futureDate && <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm">Future dates are view-only. Daily logs can be entered on or before today.</p>}

      <Card>
        <CardTitle right={<span className="text-sm tabular-nums text-muted">{checklist.checked} / {checklist.total} · {fmt(checklist.percent)}%</span>}>
          Checklist
        </CardTitle>
        <ProgressBar value={checklist.percent} max={100} />
        {automaticStates.length > 0 && (
          <section className="mt-4" aria-labelledby="automatic-checklist-heading">
            <h3 id="automatic-checklist-heading" className="font-semibold">Automatic</h3>
            <p className="mb-2 text-xs text-muted">These items update automatically based on your daily logs and targets.</p>
            <ul className="space-y-2">
              {automaticStates.map(({ item, checked }) => {
                const on = checked;
                return (
                  <li key={item.id}>
                    <ChecklistButton item={item} checked={on} futureDate={futureDate} hint={hints[item.id]} toggleCheck={toggleCheck} date={date} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {manualStates.length > 0 && (
          <section className="mt-4" aria-labelledby="manual-checklist-heading">
            <h3 id="manual-checklist-heading" className="mb-2 font-semibold">Manual</h3>
            <ul className="space-y-2">
              {manualStates.map(({ item, checked }) => {
                const on = checked;
                return (
                  <li key={item.id}>
                    <ChecklistButton item={item} checked={on} futureDate={futureDate} hint={hints[item.id]} toggleCheck={toggleCheck} date={date} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Water</CardTitle>
          <p className="mb-2 font-display text-3xl font-bold tabular-nums">
            {fmt(rec.water / 1000, 2)} <span className="text-base font-semibold text-muted">/ {fmt(profile.waterTargetMl / 1000, 1)} L</span>
          </p>
          <ProgressBar value={rec.water} max={profile.waterTargetMl} />
          <p className="mt-2 text-sm text-muted">
            {rec.water >= profile.waterTargetMl
              ? 'Target reached.'
              : `${fmt(profile.waterTargetMl - rec.water)} ml to go.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button disabled={futureDate} onClick={() => addWater(date, 250)}>+ 250 ml</Button>
            <Button disabled={futureDate} onClick={() => addWater(date, 500)}>+ 500 ml</Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              placeholder="Custom ml"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              aria-label="Custom water amount in millilitres"
              disabled={futureDate}
            />
            <Button onClick={addCustom} disabled={!custom || futureDate}>Add</Button>
          </div>
          {rec.water > 0 && (
            <Button
              variant="ghost"
              className="mt-2 w-full"
              disabled={futureDate}
              onClick={async () => {
                if (await confirm({ title: 'Reset water?', message: `Set water for ${formatLong(date)} back to 0.`, confirmLabel: 'Reset', danger: true }))
                  updateDaily(date, (r) => ({ ...r, water: 0 }));
              }}
            >
              Reset water for this day
            </Button>
          )}
        </Card>

        <Card>
          <CardTitle>Steps</CardTitle>
          <p className="mb-2 font-display text-3xl font-bold tabular-nums">
            {fmt(rec.steps ?? 0)} <span className="text-base font-semibold text-muted">/ {fmt(profile.stepsTarget)}</span>
          </p>
          <ProgressBar value={rec.steps ?? 0} max={profile.stepsTarget} />
          <p className="mt-2 text-sm text-muted">
            {fmt(Math.min(100, ((rec.steps ?? 0) / profile.stepsTarget) * 100))}% of target
          </p>
          {rec.steps != null && (rec.steps < 0 || rec.steps > MAX_DAILY_STEPS) && (
            <p role="status" className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-ink">
              This entry is outside the 0–{fmt(MAX_DAILY_STEPS)} range and is excluded from averages. Review it for a typing error.
            </p>
          )}
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium">Steps today</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_DAILY_STEPS}
              disabled={futureDate}
              value={rec.steps ?? ''}
              placeholder="Enter total steps"
              onChange={(e) => {
                const v = e.target.value;
                const n = Math.round(Number(v));
                updateDaily(date, (r) => ({ ...r, steps: v === '' ? null : Number.isFinite(n) ? Math.min(MAX_DAILY_STEPS, Math.max(0, n)) : r.steps }));
              }}
            />
          </label>
        </Card>
      </div>

      <Card>
        <CardTitle>Notes</CardTitle>
        <Textarea
          rows={3}
          disabled={futureDate}
          placeholder="How did the day go?"
          value={rec.notes}
          onChange={(e) => updateDaily(date, (r) => ({ ...r, notes: e.target.value }))}
        />
        <p className="mt-1 text-xs text-muted">Everything on this page saves as you type.</p>
      </Card>
    </div>
  );
}

function ChecklistButton({
  item,
  checked,
  futureDate,
  hint,
  toggleCheck,
  date,
}: {
  item: ChecklistItem;
  checked: boolean;
  futureDate: boolean;
  hint?: string;
  toggleCheck: (date: string, key: string) => void;
  date: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={futureDate || Boolean(item.autoComplete)}
      disabled={futureDate || Boolean(item.autoComplete)}
      onClick={() => toggleCheck(date, item.id)}
      className={cx(
        'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition',
        checked ? 'border-accent/50 bg-accent-soft' : 'border-line hover:bg-bg'
      )}
    >
      <span className={cx(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2',
        checked ? 'border-accent bg-accent text-on-accent' : 'border-muted/50'
      )}>
        {checked && <Check size={18} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{item.label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
