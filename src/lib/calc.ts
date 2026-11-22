import type { AppData, DailyRecord, FoodEntry, WeightEntry, WorkoutRecord } from '../types';
import { CHECKLIST_ITEMS } from '../constants';
import { addDays, daysBetween, startOfWeek } from './dates';
import { clamp } from './format';

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]): number | null => (a.length ? sum(a) / a.length : null);

export const sortedWeights = (w: WeightEntry[]) => [...w].sort((a, b) => a.date.localeCompare(b.date));
export const latestWeight = (w: WeightEntry[]): WeightEntry | null => {
  const s = sortedWeights(w);
  return s.length ? s[s.length - 1] : null;
};

export function progressPct(start: number, current: number, target: number): number {
  const total = start - target;
  if (total <= 0) return 0;
  return clamp(((start - current) / total) * 100, 0, 100);
}

export function dayTotals(foods: FoodEntry[], date: string) {
  const items = foods.filter((f) => f.date === date);
  return { calories: sum(items.map((f) => f.calories)), protein: sum(items.map((f) => f.protein)), count: items.length };
}

export const checkedCount = (r?: DailyRecord) => (r ? CHECKLIST_ITEMS.filter((i) => r.checklist[i.key]).length : 0);
export const completionPct = (r?: DailyRecord) => (checkedCount(r) / CHECKLIST_ITEMS.length) * 100;

export const weekDates = (anyIso: string) => {
  const s = startOfWeek(anyIso);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
};

function weekAvgWeight(weights: WeightEntry[], weekStart: string): number | null {
  const end = addDays(weekStart, 6);
  return avg(weights.filter((w) => w.date >= weekStart && w.date <= end).map((w) => w.weight));
}

/** Average weight this week minus average weight the week before (null if either week has no entries). */
export function weeklyWeightChange(weights: WeightEntry[], weekStart: string): number | null {
  const cur = weekAvgWeight(weights, weekStart);
  const prev = weekAvgWeight(weights, addDays(weekStart, -7));
  return cur != null && prev != null ? cur - prev : null;
}

/** Average change per week across all weeks that have entries (null with fewer than two weeks). */
export function avgWeeklyChange(weights: WeightEntry[]): number | null {
  const weeks = new Map<string, number[]>();
  for (const w of weights) {
    const k = startOfWeek(w.date);
    weeks.set(k, [...(weeks.get(k) ?? []), w.weight]);
  }
  const keys = [...weeks.keys()].sort();
  if (keys.length < 2) return null;
  const first = avg(weeks.get(keys[0])!)!;
  const last = avg(weeks.get(keys[keys.length - 1])!)!;
  const span = daysBetween(keys[0], keys[keys.length - 1]) / 7;
  return span > 0 ? (last - first) / span : null;
}

/** Trailing 7-day average of weigh-ins, one point per entry. */
export function trendSeries(sorted: WeightEntry[]) {
  return sorted.map((e) => {
    const from = addDays(e.date, -6);
    const window = sorted.filter((w) => w.date >= from && w.date <= e.date).map((w) => w.weight);
    return { date: e.date, weight: e.weight, trend: Number((avg(window) ?? e.weight).toFixed(2)) };
  });
}

export function weeklyOverview(data: AppData, anyIso: string) {
  const dates = weekDates(anyIso);
  const set = new Set(dates);
  const cals: number[] = [];
  const prots: number[] = [];
  const steps: number[] = [];
  const checks: number[] = [];
  for (const d of dates) {
    const t = dayTotals(data.foods, d);
    if (t.count > 0) {
      cals.push(t.calories);
      prots.push(t.protein);
    }
    const r = data.daily[d];
    if (r) {
      if (r.steps != null) steps.push(r.steps);
      checks.push(completionPct(r));
    }
  }
  return {
    calories: avg(cals),
    protein: avg(prots),
    steps: avg(steps),
    gym: data.workouts.filter((w) => set.has(w.date) && w.status === 'completed').length,
    weightChange: weeklyWeightChange(data.weights, dates[0]),
    checklist: avg(checks),
    foodDays: cals.length,
    checkDays: checks.length,
  };
}

export function lastPerformance(workouts: WorkoutRecord[], exerciseName: string, beforeDate: string): string | null {
  const name = exerciseName.trim().toLowerCase();
  if (!name) return null;
  const prior = workouts
    .filter((w) => w.status === 'completed' && w.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const w of prior) {
    const ex = w.exercises.find((e) => e.name.trim().toLowerCase() === name);
    const sets = ex?.sets.filter((s) => s.weight != null || s.reps != null);
    if (sets && sets.length) return sets.map((s) => `${s.weight ?? '–'} kg × ${s.reps ?? '–'}`).join(', ');
  }
  return null;
}
