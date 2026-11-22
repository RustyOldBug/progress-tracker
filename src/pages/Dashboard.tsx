import { useState } from 'react';
import type { ReactNode } from 'react';
import { Beef, CalendarCheck, ChevronLeft, ChevronRight, Droplets, Dumbbell, Flame, Footprints } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, ProgressBar } from '../components/ui';
import { checkedCount, completionPct, dayTotals, latestWeight, periodOverview, progressPct } from '../lib/calc';
import { addDays, daysBetween, formatLong, formatShort, parseISO, todayISO, weekdayOf } from '../lib/dates';
import { fmt, fmtKg } from '../lib/format';
import { CHECKLIST_ITEMS, PLAN_LABELS, routineLabel } from '../constants';

function Journey({ start, target, current }: { start: number; target: number; current: number | null }) {
  const span = start - target;
  const pos = (w: number) => Math.min(100, Math.max(0, ((start - w) / span) * 100));
  const ticks: number[] = [];
  for (let w = Math.floor((start - 0.01) / 5) * 5; w > target; w -= 5) ticks.push(w);
  const here = current == null ? 0 : pos(current);
  return (
    <div className="mt-6 px-2">
      <div className="relative h-14">
        {current != null && (
          <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${here}%` }}>
            <div className="rounded-lg bg-ink px-2 py-0.5 text-xs font-semibold text-surface">{fmt(current, 1)}</div>
          </div>
        )}
        <div className="absolute inset-x-0 top-8 h-3 rounded-full bg-line" />
        <div className="absolute left-0 top-8 h-3 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${here}%` }} />
        {ticks.map((w) => (
          <div key={w} className="absolute top-7 -translate-x-1/2" style={{ left: `${pos(w)}%` }}>
            <div className="mx-auto h-5 w-px bg-muted/50" />
            <div className="mt-0.5 text-[11px] text-muted">{w}</div>
          </div>
        ))}
        {current != null && (
          <div
            className="absolute top-[1.65rem] h-6 w-6 -translate-x-1/2 rounded-full border-4 border-surface bg-accent shadow"
            style={{ left: `${here}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs font-medium text-muted">
        <span>{fmt(start, 1)} kg start</span>
        <span>{fmt(target, 1)} kg goal</span>
      </div>
    </div>
  );
}

function Meter({
  icon,
  label,
  value,
  target,
  unit,
  over,
  extra,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  target: number;
  unit: string;
  over?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span className="text-accent">{icon}</span>
          {label}
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-muted">
            <span className="font-semibold text-ink">{fmt(value)}</span> / {fmt(target)} {unit}
          </span>
          {extra}
        </span>
      </div>
      <ProgressBar value={value} max={target} tone={over ? 'warn' : 'accent'} />
    </div>
  );
}

export default function Dashboard() {
  const { data, addWater } = useStore();
  const [trendPeriod, setTrendPeriod] = useState<'7' | '30'>('7');
  const [trendDate, setTrendDate] = useState(todayISO());
  const { profile } = data;
  const today = todayISO();
  const latest = latestWeight(data.weights);
  const current = latest?.weight ?? null;
  const lost = current == null ? null : profile.startingWeight - current;
  const remaining = current == null ? null : current - profile.targetWeight;
  const progress = current == null ? 0 : progressPct(profile.startingWeight, current, profile.targetWeight);
  const dayNo = Math.max(1, daysBetween(profile.startDate, today) + 1);

  const totals = dayTotals(data.foods, today);
  const daily = data.daily[today];
  const workout = data.workouts.find((w) => w.date === today);
  const plan = profile.schedule[weekdayOf(today)];
  const gymStatus = workout
    ? workout.status === 'completed'
      ? `${routineLabel(workout.workoutType, data.routines, workout.routineName)} completed`
      : workout.status === 'skipped'
        ? `${routineLabel(workout.workoutType, data.routines, workout.routineName)} skipped`
        : workout.status === 'rescheduled'
          ? `${routineLabel(workout.workoutType, data.routines, workout.routineName)} moved`
          : `${routineLabel(workout.workoutType, data.routines, workout.routineName)} planned`
    : plan === 'rest'
      ? 'Rest day'
      : `${PLAN_LABELS[plan] ?? routineLabel(plan, data.routines)} not started`;
  const periodLength = Number(trendPeriod);
  const periodEnd = trendDate;
  const periodStart = addDays(periodEnd, -(periodLength - 1));
  const previousStart = addDays(periodStart, -periodLength);
  const previousEnd = addDays(periodStart, -1);
  const trends = periodOverview(data, periodStart, periodEnd, previousStart, previousEnd);
  const nextDisabled = periodEnd >= today;
  const periodStartYear = parseISO(periodStart).getFullYear();
  const periodEndYear = parseISO(periodEnd).getFullYear();
  const periodTitle = `${formatShort(periodStart)} – ${formatShort(periodEnd)}, ${
    periodStartYear === periodEndYear ? periodEndYear : `${periodStartYear}–${periodEndYear}`
  }`;
  const kcalLeft = profile.calorieTarget - totals.calories;

  return (
    <div className="space-y-4">
      <Card className="pb-6">
        <p className="text-sm text-muted">
          {profile.name ? `${profile.name} · ` : ''}Day {dayNo} · {formatLong(today)}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <div>
            <p className="font-display text-6xl font-bold leading-none tracking-tight tabular-nums sm:text-7xl">
              {current == null ? '–' : fmt(current, 1)}
              <span className="ml-2 text-2xl font-semibold text-muted">kg</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              {current == null
                ? 'No weigh-in yet. Log your first one on the Weight page.'
                : `${fmt(remaining, 1)} kg to go to reach ${fmt(profile.targetWeight, 1)} kg`}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-x-6 text-sm">
            <div>
              <dt className="text-muted">Lost</dt>
              <dd className="font-display text-xl font-semibold tabular-nums">{fmtKg(lost)}</dd>
            </div>
            <div>
              <dt className="text-muted">Remaining</dt>
              <dd className="font-display text-xl font-semibold tabular-nums">{fmtKg(remaining)}</dd>
            </div>
            <div>
              <dt className="text-muted">Progress</dt>
              <dd className="font-display text-xl font-semibold tabular-nums">{fmt(progress, 0)}%</dd>
            </div>
          </dl>
        </div>
        <Journey start={profile.startingWeight} target={profile.targetWeight} current={current} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Today</CardTitle>
          <div className="space-y-4">
            <Meter
              icon={<Flame size={18} />}
              label="Calories"
              value={totals.calories}
              target={profile.calorieTarget}
              unit="kcal"
              over={kcalLeft < 0}
              extra={
                <span className={kcalLeft < 0 ? 'text-xs font-medium text-warn' : 'text-xs text-muted'}>
                  {kcalLeft < 0 ? `${fmt(-kcalLeft)} over` : `${fmt(kcalLeft)} left`}
                </span>
              }
            />
            <Meter icon={<Beef size={18} />} label="Protein" value={totals.protein} target={profile.proteinTarget} unit="g" />
            <Meter
              icon={<Droplets size={18} />}
              label="Water"
              value={(daily?.water ?? 0) / 1000}
              target={profile.waterTargetMl / 1000}
              unit="L"
              extra={
                <Button variant="ghost" className="!min-h-8 !px-2 text-xs" onClick={() => addWater(today, 250)}>
                  +250 ml
                </Button>
              }
            />
            <Meter icon={<Footprints size={18} />} label="Steps" value={daily?.steps ?? 0} target={profile.stepsTarget} unit="" />
            <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Dumbbell size={18} className="text-accent" />
                Gym
              </span>
              <span className="text-muted">{gymStatus}</span>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <CalendarCheck size={18} className="text-accent" />
                  Checklist
                </span>
                <span className="tabular-nums text-muted">
                  {checkedCount(daily)} / {CHECKLIST_ITEMS.length} · {fmt(completionPct(daily))}%
                </span>
              </div>
              <ProgressBar value={completionPct(daily)} max={100} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-lg font-semibold">Habit trends</h2>
            <div className="flex w-full rounded-xl bg-bg p-1 sm:w-auto" role="group" aria-label="Habit trend range">
              <Button
                variant={trendPeriod === '7' ? 'primary' : 'ghost'}
                className="!min-h-9 flex-1 !px-2 sm:flex-none sm:!px-3"
                aria-pressed={trendPeriod === '7'}
                onClick={() => setTrendPeriod('7')}
              >
                Last 7 days
              </Button>
              <Button
                variant={trendPeriod === '30' ? 'primary' : 'ghost'}
                className="!min-h-9 flex-1 !px-2 sm:flex-none sm:!px-3"
                aria-pressed={trendPeriod === '30'}
                onClick={() => setTrendPeriod('30')}
              >
                Last 30 days
              </Button>
            </div>
          </div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              className="!h-9 !min-h-9 !w-9 !px-0"
              aria-label={`Previous ${periodLength} days`}
              onClick={() => setTrendDate((date) => addDays(date, -periodLength))}
            >
              <ChevronLeft size={18} />
            </Button>
            <p className="text-sm font-medium">{periodTitle}</p>
            <Button
              variant="ghost"
              className="!h-9 !min-h-9 !w-9 !px-0"
              aria-label={`Next ${periodLength} days`}
              disabled={nextDisabled}
              onClick={() => setTrendDate((date) => addDays(date, periodLength))}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
          <dl className="divide-y divide-line text-sm">
            {[
            ['calories', <><span className="sm:hidden">Avg. cal</span><span className="hidden sm:inline">Average calories</span></>, trends.calories == null ? '–' : `${fmt(trends.calories)} kcal`, `${trends.foodDays} days logged`],
            ['protein', <><span className="sm:hidden">Avg. protein</span><span className="hidden sm:inline">Average protein</span></>, trends.protein == null ? '–' : `${fmt(trends.protein)} g`, `${trends.foodDays} days logged`],
            ['steps', <><span className="sm:hidden">Avg. steps</span><span className="hidden sm:inline">Average steps</span></>, fmt(trends.steps), trends.steps == null ? 'no steps logged' : `${trends.stepDays} days logged`],
            ['water', <><span className="sm:hidden">Avg. water</span><span className="hidden sm:inline">Average water</span></>, trends.water == null ? '–' : `${fmt(trends.water, 2)} L`, `${trends.waterDays} days logged`],
            ['gym', <><span className="sm:hidden">Gym</span><span className="hidden sm:inline">Gym sessions</span></>, `${trends.gym} completed`, ''],
            ['checklist', <><span className="sm:hidden">Checklist</span><span className="hidden sm:inline">Checklist completion</span></>, trends.checklist == null ? '–' : `${fmt(trends.checklist)}%`, `${trends.checkDays} days tracked`],
          ].map(([id, label, v, note]) => (
            <div key={String(id)} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-muted">{label}</dt>
                <dd className="text-right">
                  <span className="font-semibold tabular-nums">{v}</span>
                  {note && <span className="block text-xs text-muted">{note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
