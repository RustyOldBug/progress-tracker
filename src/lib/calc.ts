import type { AppData, ChecklistAutoMetric, ChecklistItem, DailyRecord, FoodEntry, SetLog, WeightEntry, WorkoutRecord } from '../types';
import { MAX_DAILY_STEPS } from '../constants';
import { addDays, daysBetween, startOfWeek, todayISO } from './dates';
import { clamp } from './format';

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]): number | null => (a.length ? sum(a) / a.length : null);

export const sortedWeights = (w: WeightEntry[]) => [...w].sort((a, b) => a.date.localeCompare(b.date));
export const firstWeight = (w: WeightEntry[]): WeightEntry | null =>
  sortedWeights(w.filter((entry) => entry.date <= todayISO()))[0] ?? null;
export const latestWeight = (w: WeightEntry[]): WeightEntry | null => {
  const s = sortedWeights(w.filter((entry) => entry.date <= todayISO()));
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

export type ChecklistAutoValues = Partial<Record<ChecklistAutoMetric, boolean>>;

export function checklistStates(items: ChecklistItem[], record?: DailyRecord, automatic: ChecklistAutoValues = {}) {
  return items.map((item) => ({
    item,
    checked: item.autoComplete ? automatic[item.autoComplete] ?? false : Boolean(record?.checklist[item.id]),
  }));
}

export function checklistProgress(items: ChecklistItem[], record?: DailyRecord, automatic: ChecklistAutoValues = {}) {
  const states = checklistStates(items, record, automatic);
  const checked = states.filter((state) => state.checked).length;
  return { checked, total: states.length, percent: states.length ? (checked / states.length) * 100 : 0 };
}

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
export function avgWeeklyChange(weights: WeightEntry[], asOfDate = todayISO()): number | null {
  const weeks = new Map<string, number[]>();
  const completedWeekStart = startOfWeek(asOfDate);
  for (const w of weights.filter((entry) => entry.date < completedWeekStart)) {
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
  const overview = periodOverview(data, dates[0], dates[6], addDays(dates[0], -7), addDays(dates[0], -1));
  return {
    calories: overview.calories,
    protein: overview.protein,
    steps: overview.steps,
    gym: overview.gym,
    weightChange: overview.weightChange,
    checklist: overview.checklist,
    foodDays: overview.foodDays,
    checkDays: overview.checkDays,
  };
}

export function periodOverview(data: AppData, start: string, end: string, previousStart: string, previousEnd: string) {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  const dateSet = new Set(dates);
  const cals: number[] = [];
  const proteins: number[] = [];
  const steps: number[] = [];
  const waters: number[] = [];
  const checks: number[] = [];
  const stepOutliers: { date: string; steps: number }[] = [];

  for (const date of dates) {
    const totals = dayTotals(data.foods, date);
    if (totals.count) {
      cals.push(totals.calories);
      proteins.push(totals.protein);
    }
    const daily = data.daily[date];
    const hasWeight = data.weights.some((weight) => weight.date === date);
    const hasWorkout = data.workouts.some((workout) => workout.date === date);
    const hasCompletedWorkout = data.workouts.some((workout) => workout.date === date && workout.status === 'completed');
    if (daily) {
      if (daily.steps != null) {
        if (daily.steps < 0 || daily.steps > MAX_DAILY_STEPS) stepOutliers.push({ date, steps: daily.steps });
        else steps.push(daily.steps);
      }
      if (daily.water > 0) waters.push(daily.water / 1000);
    }
    if (daily || totals.count) {
      checks.push(checklistProgress(data.checklistItems, daily, {
        calories: totals.count > 0 && totals.calories <= data.profile.calorieTarget,
        protein: totals.protein >= data.profile.proteinTarget,
        steps: (daily?.steps ?? 0) >= data.profile.stepsTarget && (daily?.steps ?? 0) <= MAX_DAILY_STEPS,
        water: (daily?.water ?? 0) >= data.profile.waterTargetMl,
        weighIn: hasWeight,
        gym: hasCompletedWorkout,
      }).percent);
    }
    if (!daily && !totals.count && (hasWeight || hasWorkout)) {
      checks.push(checklistProgress(data.checklistItems, daily, {
        calories: false,
        protein: false,
        steps: false,
        water: false,
        weighIn: hasWeight,
        gym: hasCompletedWorkout,
      }).percent);
    }
  }

  const currentWeight = avg(data.weights.filter((entry) => dateSet.has(entry.date)).map((entry) => entry.weight));
  const previousWeight = avg(data.weights
    .filter((entry) => entry.date >= previousStart && entry.date <= previousEnd)
    .map((entry) => entry.weight));

  return {
    calories: avg(cals),
    protein: avg(proteins),
    steps: avg(steps),
    water: avg(waters),
    gym: data.workouts.filter((workout) => dateSet.has(workout.date) && workout.status === 'completed').length,
    weightChange: currentWeight != null && previousWeight != null ? currentWeight - previousWeight : null,
    checklist: avg(checks),
    foodDays: cals.length,
    stepDays: steps.length,
    stepOutliers,
    waterDays: waters.length,
    checkDays: checks.length,
  };
}

export function lastPerformance(workouts: WorkoutRecord[], exerciseName: string, beforeDate: string): string | null {
  const sets = lastExerciseSets(workouts, exerciseName, beforeDate);
  return sets?.map((set) => `${set.weight ?? '–'} kg × ${set.reps ?? '–'}`).join(', ') ?? null;
}

export function lastExerciseSets(workouts: WorkoutRecord[], exerciseName: string, beforeDate: string): SetLog[] | null {
  const name = exerciseName.trim().toLowerCase();
  if (!name) return null;
  const prior = workouts
    .filter((w) => w.status === 'completed' && w.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const w of prior) {
    const ex = w.exercises.find((e) => e.name.trim().toLowerCase() === name);
    const sets = ex?.sets.filter((s) => s.weight != null || s.reps != null);
    if (sets?.length) return sets.map((set) => ({ ...set }));
  }
  return null;
}
