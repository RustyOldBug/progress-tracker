import type { ReactNode } from 'react';
import { Beef, CalendarCheck, Droplets, Dumbbell, Flame, Footprints } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, ProgressBar } from '../components/ui';
import WeightChart from '../components/WeightChart';
import { checkedCount, completionPct, dayTotals, latestWeight, progressPct, weeklyOverview } from '../lib/calc';
import { daysBetween, formatLong, todayISO, weekdayOf } from '../lib/dates';
import { fmt, fmtKg, fmtSigned } from '../lib/format';
import { CHECKLIST_ITEMS, PLAN_LABELS, SESSION_LABELS } from '../constants';

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
      ? `${SESSION_LABELS[workout.workoutType]} completed`
      : workout.status === 'skipped'
        ? `${SESSION_LABELS[workout.workoutType]} skipped`
        : workout.status === 'rescheduled'
          ? `${SESSION_LABELS[workout.workoutType]} moved`
          : `${SESSION_LABELS[workout.workoutType]} planned`
    : plan === 'rest'
      ? 'Rest day'
      : `${PLAN_LABELS[plan]} not started`;
  const week = weeklyOverview(data, today);
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
          <CardTitle>This week</CardTitle>
          <dl className="divide-y divide-line text-sm">
            {[
              ['Average calories', week.calories == null ? '–' : `${fmt(week.calories)} kcal`, `${week.foodDays} days logged`],
              ['Average protein', week.protein == null ? '–' : `${fmt(week.protein)} g`, `${week.foodDays} days logged`],
              ['Average steps', fmt(week.steps), week.steps == null ? 'no steps logged' : ''],
              ['Gym sessions', `${week.gym} completed`, ''],
              [
                'Weight change',
                week.weightChange == null ? '–' : `${fmtSigned(week.weightChange)} kg`,
                week.weightChange == null ? 'needs entries in this and last week' : 'vs last week’s average',
              ],
              ['Checklist completion', week.checklist == null ? '–' : `${fmt(week.checklist)}%`, `${week.checkDays} days tracked`],
            ].map(([k, v, note]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">
                  <span className="font-semibold tabular-nums">{v}</span>
                  {note && <span className="block text-xs text-muted">{note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardTitle>Weight trend</CardTitle>
        <WeightChart weights={data.weights} profile={profile} />
      </Card>
    </div>
  );
}
