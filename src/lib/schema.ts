import type {
  AppData,
  ChecklistKey,
  ChecklistItem,
  DailyRecord,
  ExerciseLog,
  FoodEntry,
  UserProfile,
  WeightEntry,
  WorkoutRoutine,
  WorkoutRecord,
} from '../types';
import { DEFAULT_CHECKLIST_ITEMS, DEFAULT_ROUTINES, defaultProfile, MEALS, SESSION_LABELS } from '../constants';

/** Bump when the stored shape changes, and add a step to `migrate`. */
export const SCHEMA_VERSION = 3;

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyChecklist(items: ChecklistItem[] = DEFAULT_CHECKLIST_ITEMS): Record<ChecklistKey, boolean> {
  const c = {} as Record<ChecklistKey, boolean>;
  items.forEach((i) => (c[i.id] = false));
  return c;
}

export const emptyDaily = (date: string, items?: ChecklistItem[]): DailyRecord => ({
  date,
  checklist: emptyChecklist(items),
  steps: null,
  water: 0,
  notes: '',
});

export function defaultData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: defaultProfile(),
    checklistItems: DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item })),
    weights: [],
    foods: [],
    daily: {},
    workouts: [],
    routines: DEFAULT_ROUTINES.map((routine) => ({ ...routine, exercises: [...routine.exercises] })),
    lastBackupAt: null,
  };
}

const num = (v: unknown, fallback: number | null = null) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

export function newExercises(names: string[]): ExerciseLog[] {
  return names.map((name) => ({
    id: uid(),
    name,
    sets: [
      { reps: null, weight: null },
      { reps: null, weight: null },
      { reps: null, weight: null },
    ],
  }));
}

/**
 * Turn anything loaded from storage or a backup file into a well-formed AppData.
 * Tolerant by design: unknown or missing fields fall back to defaults.
 */
export function migrate(raw: unknown): AppData {
  const base = defaultData();
  if (!isObj(raw)) return base;
  // const version = num(raw.schemaVersion, 0);  // v0 → v1 needs no changes. Add steps here later.

  const requiredChecklistItems = DEFAULT_CHECKLIST_ITEMS.filter((item) => item.autoComplete);
  const requiredIds = new Set(requiredChecklistItems.map((item) => item.id));
  const checklistItems = Array.isArray(raw.checklistItems)
    ? (() => {
        const loadedItems = raw.checklistItems
          .filter(isObj)
          .filter((item) =>
            typeof item.id === 'string' &&
            item.id.trim() &&
            typeof item.label === 'string' &&
            item.label.trim() &&
            !requiredIds.has(item.id)
          )
          .map((item) => {
            const requiredItem = requiredChecklistItems.find((required) => required.id === item.id);
            return requiredItem ? { ...requiredItem } : {
              id: (item.id as string).trim(),
              label: (item.label as string).trim(),
            };
          })
          .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
        return [
          ...loadedItems,
          ...requiredChecklistItems.filter((required) => !loadedItems.some((item) => item.id === required.id)),
        ];
      })()
    : DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item }));

  const routines: WorkoutRoutine[] = Array.isArray(raw.routines)
    ? raw.routines
        .filter(isObj)
        .filter((r) => typeof r.id === 'string' && typeof r.name === 'string' && Array.isArray(r.exercises))
        .map((r) => ({
          id: r.id as string,
          name: (r.name as string).trim(),
          exercises: (r.exercises as unknown[]).filter((name): name is string => typeof name === 'string'),
        }))
        .filter((r) => r.id.length > 0 && r.name.length > 0)
        .filter((routine, index, all) => all.findIndex((other) => other.id === routine.id) === index)
    : base.routines;
  const routineIds = new Set(routines.map((routine) => routine.id));
  const profile = (isObj(raw.profile) ? { ...base.profile, ...raw.profile } : base.profile) as unknown as UserProfile;
  if (!Array.isArray(profile.schedule) || profile.schedule.length !== 7) {
    profile.schedule = [...base.profile.schedule];
  } else {
    profile.schedule = profile.schedule.map((plan) =>
      plan === 'rest' || plan === 'recovery' || (typeof plan === 'string' && routineIds.has(plan))
        ? plan
        : 'rest'
    );
  }

  const daily: Record<string, DailyRecord> = {};
  if (isObj(raw.daily)) {
    for (const [date, v] of Object.entries(raw.daily)) {
      if (!isObj(v)) continue;
      daily[date] = {
        date,
        checklist: { ...emptyChecklist(checklistItems), ...(isObj(v.checklist) ? v.checklist : {}) } as Record<ChecklistKey, boolean>,
        steps: num(v.steps),
        water: num(v.water, 0) as number,
        notes: str(v.notes),
      };
    }
  }

  const weights: WeightEntry[] = (Array.isArray(raw.weights) ? raw.weights : []).filter(isObj).map((w) => ({
    id: str(w.id) || uid(),
    date: str(w.date),
    weight: num(w.weight, 0) as number,
    waist: num(w.waist),
    notes: str(w.notes),
  }));

  const foods: FoodEntry[] = (Array.isArray(raw.foods) ? raw.foods : []).filter(isObj).map((f) => ({
    id: str(f.id) || uid(),
    date: str(f.date),
    meal: (MEALS as string[]).includes(str(f.meal)) ? (f.meal as FoodEntry['meal']) : 'Snacks',
    foodName: str(f.foodName),
    calories: num(f.calories, 0) as number,
    protein: num(f.protein, 0) as number,
  }));

  const workouts: WorkoutRecord[] = (Array.isArray(raw.workouts) ? raw.workouts : []).filter(isObj).map((w) => {
    const workoutType = str(w.workoutType);
    return {
      id: str(w.id) || uid(),
      date: str(w.date),
      workoutType,
      routineName:
        str(w.routineName) ||
        routines.find((routine) => routine.id === workoutType)?.name ||
        SESSION_LABELS[workoutType] ||
        workoutType,
      exercises: (Array.isArray(w.exercises) ? w.exercises : []).filter(isObj).map((e) => ({
        id: str(e.id) || uid(),
        name: str(e.name),
        sets: (Array.isArray(e.sets) ? e.sets : []).filter(isObj).map((s) => ({ reps: num(s.reps), weight: num(s.weight) })),
      })),
      duration: num(w.duration),
      status: w.status as WorkoutRecord['status'],
      started: typeof w.started === 'boolean' ? w.started : undefined,
      rescheduledTo: typeof w.rescheduledTo === 'string' ? w.rescheduledTo : undefined,
      notes: str(w.notes),
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    profile,
    checklistItems,
    weights,
    foods,
    daily,
    workouts,
    routines,
    lastBackupAt: typeof raw.lastBackupAt === 'string' ? raw.lastBackupAt : null,
  };
}
