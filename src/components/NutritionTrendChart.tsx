import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FoodEntry } from '../types';
import { addDays, daysBetween, formatLong, formatShort, todayISO } from '../lib/dates';
import { avg, sum } from '../lib/calc';
import { fmt } from '../lib/format';
import { cx, EmptyState } from './ui';

const RANGES = [
  { id: '7', label: 'Week', mobileLabel: '7 days', days: 7 },
  { id: '30', label: 'Month', mobileLabel: '30 days', days: 30 },
  { id: '90', label: '3 months', mobileLabel: '90 days', days: 90 },
  { id: 'all', label: 'All time', mobileLabel: 'All', days: null },
] as const;

const EPOCH = '2000-01-01';

export default function NutritionTrendChart({
  foods,
  calorieTarget,
  proteinTarget,
}: {
  foods: FoodEntry[];
  calorieTarget: number;
  proteinTarget: number;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('30');

  const { points, caloriesAverage, proteinAverage } = useMemo(() => {
    const days = new Map<string, { calories: number; protein: number }>();
    for (const food of foods) {
      const current = days.get(food.date) ?? { calories: 0, protein: 0 };
      current.calories += food.calories;
      current.protein += food.protein;
      days.set(food.date, current);
    }

    const duration = RANGES.find((item) => item.id === range)?.days ?? null;
    const from = duration ? addDays(todayISO(), -(duration - 1)) : '0000-00-00';
    const selected = [...days.entries()]
      .filter(([date]) => date >= from && date <= todayISO())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => ({
        date,
        t: daysBetween(EPOCH, date),
        calories: totals.calories,
        protein: totals.protein,
      }));

    return {
      points: selected,
      caloriesAverage: avg(selected.map((point) => point.calories)),
      proteinAverage: avg(selected.map((point) => point.protein)),
    };
  }, [foods, range]);

  const xMin = points.length ? points[0].t : 0;
  const xMax = points.length ? points[points.length - 1].t : 1;
  const xPadding = xMin === xMax ? 3 : 0;
  const tickStep = Math.max(1, Math.ceil(points.length / 6));
  const xTicks = points
    .filter((_, index) => index % tickStep === 0 || index === points.length - 1)
    .map((point) => point.t);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Nutrition chart range">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRange(item.id)}
            aria-pressed={range === item.id}
            className={cx(
              'min-h-9 rounded-lg px-2 text-sm font-medium transition sm:px-3',
              range === item.id ? 'bg-accent text-on-accent' : 'text-muted hover:bg-bg hover:text-ink'
            )}
          >
            <span className="sm:hidden">{item.mobileLabel}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>
      {points.length === 0 ? (
        <EmptyState title="No nutrition entries in this range" hint="Log food to start seeing daily calorie and protein patterns." />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:max-w-md">
            <div className="rounded-xl bg-bg p-3">
              <p className="text-muted">Avg. cal / day</p>
              <p className="font-semibold tabular-nums">{fmt(caloriesAverage ?? 0)} kcal</p>
            </div>
            <div className="rounded-xl bg-bg p-3">
              <p className="text-muted">
                <span className="sm:hidden">Avg. prot. / day</span>
                <span className="hidden sm:inline">Avg. protein / day</span>
              </p>
              <p className="font-semibold tabular-nums">{fmt(proteinAverage ?? 0)} g</p>
            </div>
          </div>
          <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-dashed border-warn" />
              Calorie target: {fmt(calorieTarget)} kcal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-dashed border-accent" />
              Protein target: {fmt(proteinTarget)} g
            </span>
          </div>
          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={[xMin - xPadding, xMax + xPadding]}
                  ticks={xTicks}
                  tickFormatter={(value) => formatShort(addDays(EPOCH, Number(value)))}
                  tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
                  stroke="rgb(var(--line))"
                />
                <YAxis
                  yAxisId="calories"
                  domain={[0, (max: number) => Math.ceil(Math.max(max, calorieTarget) / 250) * 250]}
                  tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
                  stroke="rgb(var(--line))"
                  width={64}
                  tickFormatter={(value) => Number(value) >= 1000 ? `${fmt(Number(value) / 1000, 1)}k` : fmt(Number(value))}
                />
                <YAxis
                  yAxisId="protein"
                  orientation="right"
                  domain={[0, (max: number) => Math.ceil(Math.max(max, proteinTarget) / 25) * 25]}
                  tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
                  stroke="rgb(var(--line))"
                  width={56}
                  unit=" g"
                />
                <Tooltip
                  labelFormatter={(value) => formatLong(addDays(EPOCH, Number(value)))}
                  formatter={(value, name) => {
                    const isCalories = name === 'calories' || name === 'Calories';
                    return [
                      isCalories ? `${fmt(Number(value))} kcal` : `${fmt(Number(value))} g`,
                      isCalories ? 'Calories' : 'Protein',
                    ];
                  }}
                  contentStyle={{
                    background: 'rgb(var(--surface))',
                    border: '1px solid rgb(var(--line))',
                    borderRadius: 12,
                    color: 'rgb(var(--ink))',
                  }}
                />
                <Legend />
                <ReferenceLine
                  yAxisId="calories"
                  y={calorieTarget}
                  stroke="rgb(var(--warn))"
                  strokeDasharray="4 4"
                />
                <ReferenceLine
                  yAxisId="protein"
                  y={proteinTarget}
                  stroke="rgb(var(--accent))"
                  strokeDasharray="4 4"
                />
                <Line
                  yAxisId="calories"
                  type="monotone"
                  dataKey="calories"
                  name="Calories"
                  stroke="rgb(var(--warn))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'rgb(var(--warn))' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="protein"
                  type="monotone"
                  dataKey="protein"
                  name="Protein"
                  stroke="rgb(var(--accent))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'rgb(var(--accent))' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted">Left axis: calories (kcal) · right axis: protein (g)</p>
          <p className="mt-2 text-xs text-muted">
            {points.length} logged {points.length === 1 ? 'day' : 'days'}. Days without food entries are omitted, not counted as zero.
          </p>
        </>
      )}
    </div>
  );
}
