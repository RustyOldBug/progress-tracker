import type { AppData } from '../types';
import { isFutureISO, isValidISO, todayISO } from './dates';
import { isObj, migrate, SCHEMA_VERSION } from './schema';
import { DEFAULT_ROUTINES, MAX_DAILY_STEPS, MEALS } from '../constants';

export const APP_ID = 'weight-loss-tracker';

export interface BackupFile {
  app: typeof APP_ID;
  schemaVersion: number;
  createdAt: string;
  data: Omit<AppData, 'schemaVersion' | 'lastBackupAt'>;
}

export function buildBackup(data: AppData): BackupFile {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      profile: data.profile,
      checklistItems: data.checklistItems,
      weights: data.weights,
      foods: data.foods,
      daily: data.daily,
      workouts: data.workouts,
      routines: data.routines,
    },
  };
}

export function downloadBackup(data: AppData, prefix = 'weight-loss-backup'): string {
  const filename = `${prefix}-${todayISO()}.json`;
  const blob = new Blob([JSON.stringify(buildBackup(data), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const SESSION_TYPES = ['upper-a', 'lower-a', 'upper-b', 'lower-b', 'recovery', 'custom'];
const STATUSES = ['planned', 'completed', 'skipped', 'rescheduled'];

function validateData(d: Record<string, unknown>): string | null {
  if (!isObj(d.profile)) return 'The backup has no profile section.';
  for (const k of ['age', 'heightCm', 'startingWeight', 'targetWeight', 'calorieTarget', 'proteinTarget', 'stepsTarget', 'waterTargetMl']) {
    if (!finite(d.profile[k])) return `Profile field "${k}" is missing or not a number.`;
  }
  if (d.checklistItems != null) {
    if (!Array.isArray(d.checklistItems)) return 'The backup checklist items are invalid.';
    const checklistIds = new Set<string>();
    for (const [i, item] of d.checklistItems.entries()) {
      if (!isObj(item) || typeof item.id !== 'string' || !item.id.trim() || typeof item.label !== 'string' || !item.label.trim())
        return `Checklist item ${i + 1} is invalid.`;
      if (checklistIds.has(item.id)) return `Checklist item "${item.id}" is duplicated.`;
      checklistIds.add(item.id);
      if (item.autoComplete != null && !['calories', 'protein', 'steps', 'water', 'weighIn', 'gym'].includes(item.autoComplete as string))
        return `Checklist item ${i + 1} has an invalid automatic rule.`;
    }
  }
  if (!Array.isArray(d.weights)) return 'The backup has no weight history list.';
  const weightDates = new Set<string>();
  for (const [i, w] of d.weights.entries()) {
    if (!isObj(w) || !isValidISO(w.date) || !finite(w.weight) || w.weight <= 0 || w.weight > 500)
      return `Weight entry ${i + 1} is invalid.`;
    if (isFutureISO(w.date)) return `Weight entry ${i + 1} is dated in the future.`;
    if (weightDates.has(w.date)) return `The backup contains more than one weigh-in for ${w.date}.`;
    weightDates.add(w.date);
    if (w.waist != null && (!finite(w.waist) || w.waist <= 0)) return `Weight entry ${i + 1} has an invalid waist value.`;
  }
  if (!Array.isArray(d.foods)) return 'The backup has no food entries list.';
  for (const [i, f] of d.foods.entries()) {
    if (
      !isObj(f) ||
      !isValidISO(f.date) ||
      isFutureISO(f.date) ||
      typeof f.foodName !== 'string' ||
      !MEALS.includes(f.meal as never) ||
      !finite(f.calories) ||
      f.calories < 0 ||
      !finite(f.protein) ||
      f.protein < 0
    )
      return `Food entry ${i + 1} is invalid.`;
  }
  if (!isObj(d.daily)) return 'The backup has no daily records section.';
  for (const [date, r] of Object.entries(d.daily)) {
    if (!isValidISO(date) || !isObj(r) || !isObj(r.checklist)) return `Daily record "${date}" is invalid.`;
    if (isFutureISO(date)) return `Daily record "${date}" is dated in the future.`;
    if (r.steps != null && (!finite(r.steps) || r.steps < 0 || r.steps > MAX_DAILY_STEPS * 2))
      return `Daily record "${date}" has invalid steps.`;
    if (r.water != null && !finite(r.water)) return `Daily record "${date}" has invalid water.`;
  }
  const routines = d.routines ?? DEFAULT_ROUTINES;
  if (!Array.isArray(routines)) return 'The backup has no workout routines list.';
  const routineIds = new Set<string>();
  for (const [i, routine] of routines.entries()) {
    if (
      !isObj(routine) ||
      typeof routine.id !== 'string' ||
      !routine.id.trim() ||
      typeof routine.name !== 'string' ||
      !routine.name.trim() ||
      !Array.isArray(routine.exercises) ||
      !routine.exercises.every((exercise) => typeof exercise === 'string')
    )
      return `Workout routine ${i + 1} is invalid.`;
    if (routineIds.has(routine.id)) return `Workout routine "${routine.id}" is duplicated.`;
    routineIds.add(routine.id);
  }
  if (!Array.isArray(d.workouts)) return 'The backup has no workouts list.';
  for (const [i, w] of d.workouts.entries()) {
    if (
      !isObj(w) ||
      !isValidISO(w.date) ||
      typeof w.workoutType !== 'string' ||
      (!SESSION_TYPES.includes(w.workoutType) && !routineIds.has(w.workoutType)) ||
      !STATUSES.includes(w.status as string) ||
      !Array.isArray(w.exercises)
    )
      return `Workout ${i + 1} is invalid.`;
    if (isFutureISO(w.date) && (w.status === 'completed' || w.started === true))
      return `Workout ${i + 1} is marked as started or completed in the future.`;
  }
  return null;
}

export type ParseResult =
  | { ok: true; data: AppData; createdAt: string; schemaVersion: number }
  | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isObj(raw) || raw.app !== APP_ID) return { ok: false, error: 'This file is not a backup from this app.' };
  if (typeof raw.schemaVersion !== 'number') return { ok: false, error: 'The backup has no schema version.' };
  if (raw.schemaVersion > SCHEMA_VERSION)
    return { ok: false, error: 'This backup was made by a newer version of the app. Update the app and try again.' };
  if (!isObj(raw.data)) return { ok: false, error: 'The backup has no data section.' };
  const err = validateData(raw.data);
  if (err) return { ok: false, error: err };
  return {
    ok: true,
    data: migrate({ ...raw.data, lastBackupAt: null }),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    schemaVersion: raw.schemaVersion,
  };
}

export interface MergeReport {
  added: { weights: number; foods: number; daily: number; workouts: number; routines: number };
  skipped: { weights: number; foods: number; daily: number; workouts: number; routines: number };
}

/**
 * Merge rules: existing records always win. A backup record is added only if
 * nothing in the app already uses its key (weights/daily/workouts: date, foods: id).
 * The current profile is kept.
 */
export function mergeData(cur: AppData, inc: AppData): { merged: AppData; report: MergeReport } {
  const report: MergeReport = {
    added: { weights: 0, foods: 0, daily: 0, workouts: 0, routines: 0 },
    skipped: { weights: 0, foods: 0, daily: 0, workouts: 0, routines: 0 },
  };

  const weightDates = new Set(cur.weights.map((w) => w.date));
  const weights = [...cur.weights];
  for (const w of inc.weights) {
    if (weightDates.has(w.date)) report.skipped.weights++;
    else {
      weightDates.add(w.date);
      weights.push(w);
      report.added.weights++;
    }
  }

  const foodIds = new Set(cur.foods.map((f) => f.id));
  const foods = [...cur.foods];
  for (const f of inc.foods) {
    if (foodIds.has(f.id)) report.skipped.foods++;
    else {
      foodIds.add(f.id);
      foods.push(f);
      report.added.foods++;
    }
  }

  const daily = { ...cur.daily };
  for (const [date, r] of Object.entries(inc.daily)) {
    if (daily[date]) report.skipped.daily++;
    else {
      daily[date] = r;
      report.added.daily++;
    }
  }

  const workoutKeys = new Set(cur.workouts.flatMap((w) => [w.id, w.date]));
  const workouts = [...cur.workouts];
  for (const w of inc.workouts) {
    if (workoutKeys.has(w.id) || workoutKeys.has(w.date)) report.skipped.workouts++;
    else {
      workoutKeys.add(w.id);
      workoutKeys.add(w.date);
      workouts.push(w);
      report.added.workouts++;
    }
  }

  const routineIds = new Set(cur.routines.map((routine) => routine.id));
  const routines = [...cur.routines];
  for (const routine of inc.routines) {
    if (routineIds.has(routine.id)) report.skipped.routines++;
    else {
      routineIds.add(routine.id);
      routines.push(routine);
      report.added.routines++;
    }
  }

  const checklistIds = new Set(cur.checklistItems.map((item) => item.id));
  const checklistItems = [
    ...cur.checklistItems,
    ...inc.checklistItems.filter((item) => !checklistIds.has(item.id)),
  ];

  return { merged: { ...cur, weights, foods, daily, workouts, routines, checklistItems }, report };
}
