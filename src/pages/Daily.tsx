import { useState } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, DateNav, Input, ProgressBar, Textarea, cx, useConfirm } from '../components/ui';
import { checkedCount, completionPct, dayTotals } from '../lib/calc';
import { formatLong, todayISO } from '../lib/dates';
import { emptyDaily } from '../lib/schema';
import { fmt } from '../lib/format';
import { CHECKLIST_ITEMS } from '../constants';
import type { ChecklistKey } from '../types';

export default function Daily() {
  const { data, selectedDate: date, setSelectedDate, toggleCheck, updateDaily, addWater } = useStore();
  const confirm = useConfirm();
  const { profile } = data;
  const rec = data.daily[date] ?? emptyDaily(date);
  const totals = dayTotals(data.foods, date);
  const hasWeight = data.weights.some((w) => w.date === date);
  const workout = data.workouts.find((w) => w.date === date);
  const [custom, setCustom] = useState('');
  const pct = completionPct(rec);

  const hints: Partial<Record<ChecklistKey, string>> = {
    calories: totals.count ? `${fmt(totals.calories)} / ${fmt(profile.calorieTarget)} kcal logged` : 'No food logged yet',
    protein: `${fmt(totals.protein)} / ${fmt(profile.proteinTarget)} g logged`,
    steps: `${fmt(rec.steps ?? 0)} / ${fmt(profile.stepsTarget)} steps`,
    gym: workout ? `Session status: ${workout.status}` : 'No session recorded',
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

      <Card>
        <CardTitle right={<span className="text-sm tabular-nums text-muted">{checkedCount(rec)} / {CHECKLIST_ITEMS.length} · {fmt(pct)}%</span>}>
          Checklist
        </CardTitle>
        <ProgressBar value={pct} max={100} />
        <ul className="mt-4 space-y-2">
          {CHECKLIST_ITEMS.map(({ key, label }) => {
            const on = rec.checklist[key];
            return (
              <li key={key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleCheck(date, key)}
                  className={cx(
                    'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition',
                    on ? 'border-accent/50 bg-accent-soft' : 'border-line hover:bg-bg'
                  )}
                >
                  <span
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2',
                      on ? 'border-accent bg-accent text-on-accent' : 'border-muted/50'
                    )}
                  >
                    {on && <Check size={18} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{label}</span>
                    {hints[key] && <span className="block text-xs text-muted">{hints[key]}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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
            <Button onClick={() => addWater(date, 250)}>+ 250 ml</Button>
            <Button onClick={() => addWater(date, 500)}>+ 500 ml</Button>
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
            />
            <Button onClick={addCustom} disabled={!custom}>Add</Button>
          </div>
          {rec.water > 0 && (
            <Button
              variant="ghost"
              className="mt-2 w-full"
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
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium">Steps today</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={200000}
              value={rec.steps ?? ''}
              placeholder="Enter total steps"
              onChange={(e) => {
                const v = e.target.value;
                const n = Math.round(Number(v));
                updateDaily(date, (r) => ({ ...r, steps: v === '' ? null : Number.isFinite(n) ? Math.min(200000, Math.max(0, n)) : r.steps }));
              }}
            />
          </label>
        </Card>
      </div>

      <Card>
        <CardTitle>Notes</CardTitle>
        <Textarea
          rows={3}
          placeholder="How did the day go?"
          value={rec.notes}
          onChange={(e) => updateDaily(date, (r) => ({ ...r, notes: e.target.value }))}
        />
        <p className="mt-1 text-xs text-muted">Everything on this page saves as you type.</p>
      </Card>
    </div>
  );
}
