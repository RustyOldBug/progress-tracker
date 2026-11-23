import type { ChecklistItem, DayPlan, MealType, SessionType, UserProfile, WorkoutRoutine, WorkoutType } from './types';
import { todayISO } from './lib/dates';

export const MEALS: MealType[] = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

export const MAX_DAILY_STEPS = 100_000;

export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'calories', label: 'Stayed within calorie target', autoComplete: 'calories' },
  { id: 'protein', label: 'Reached protein target', autoComplete: 'protein' },
  { id: 'steps', label: 'Completed daily steps', autoComplete: 'steps' },
  { id: 'gym', label: 'Completed scheduled gym session', autoComplete: 'gym' },
  { id: 'water', label: 'Drank enough water', autoComplete: 'water' },
  { id: 'produce', label: 'Ate fruits and vegetables' },
  { id: 'sleep', label: 'Slept 7–9 hours' },
  { id: 'weighIn', label: 'Recorded morning body weight', autoComplete: 'weighIn' },
];

export const DEFAULT_ROUTINES: WorkoutRoutine[] = [
  {
    id: 'upper-a',
    name: 'Upper A',
    exercises: [
    'Machine Chest Press',
    'Lat Pulldown',
    'Seated Cable Row',
    'Machine Shoulder Press',
    'Dumbbell Bicep Curl',
    'Cable Tricep Pushdown',
    ],
  },
  {
    id: 'lower-a',
    name: 'Lower A',
    exercises: ['Leg Press', 'Seated Leg Curl', 'Leg Extension', 'Glute Bridge', 'Standing Calf Raises', 'Dead Bug'],
  },
  {
    id: 'upper-b',
    name: 'Upper B',
    exercises: [
    'Incline Chest Press',
    'Chest Supported Row',
    'Neutral Grip Lat Pulldown',
    'Lateral Raises',
    'Hammer Curls',
    'Tricep Pushdown',
    ],
  },
  {
    id: 'lower-b',
    name: 'Lower B',
    exercises: ['Leg Press', 'Seated Leg Curl', 'Supported Box Squat', 'Glute Bridge', 'Calf Raises', 'Bird Dog'],
  },
];

export const SESSION_LABELS: Record<string, string> = {
  ...Object.fromEntries(DEFAULT_ROUTINES.map(({ id, name }) => [id, name])),
  recovery: 'Active recovery',
};

export const PLAN_LABELS: Record<string, string> = { ...SESSION_LABELS, rest: 'Rest' };

export const routineLabel = (id: string, routines: WorkoutRoutine[], fallback?: string) =>
  routines.find((routine) => routine.id === id)?.name ?? fallback ?? SESSION_LABELS[id] ?? id;

/** Index 0 = Sunday */
export const DEFAULT_SCHEDULE: DayPlan[] = ['rest', 'upper-a', 'lower-a', 'rest', 'upper-b', 'lower-b', 'recovery'];

export function defaultProfile(): UserProfile {
  return {
    name: '',
    age: 32,
    gender: 'Male',
    heightCm: 172,
    startingWeight: 102,
    startingWaist: 122,
    targetWeight: 72,
    bmr: 1900,
    tdee: 2900,
    calorieTarget: 2300,
    proteinTarget: 150,
    stepsTarget: 12000,
    waterTargetMl: 3000,
    startDate: todayISO(),
    schedule: [...DEFAULT_SCHEDULE],
  };
}
