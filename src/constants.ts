import type { ChecklistKey, DayPlan, MealType, SessionType, UserProfile, WorkoutType } from './types';
import { todayISO } from './lib/dates';

export const MEALS: MealType[] = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

export const CHECKLIST_ITEMS: { key: ChecklistKey; label: string }[] = [
  { key: 'calories', label: 'Stayed within calorie target' },
  { key: 'protein', label: 'Reached protein target' },
  { key: 'steps', label: 'Completed daily steps' },
  { key: 'gym', label: 'Completed scheduled gym session' },
  { key: 'water', label: 'Drank enough water' },
  { key: 'produce', label: 'Ate fruits and vegetables' },
  { key: 'sleep', label: 'Slept 7–9 hours' },
  { key: 'weighIn', label: 'Recorded morning body weight' },
];

export const SESSION_LABELS: Record<SessionType, string> = {
  'upper-a': 'Upper A',
  'lower-a': 'Lower A',
  'upper-b': 'Upper B',
  'lower-b': 'Lower B',
  recovery: 'Active recovery',
};

export const PLAN_LABELS: Record<DayPlan, string> = { ...SESSION_LABELS, rest: 'Rest' };

export const WORKOUT_TEMPLATES: Record<WorkoutType, string[]> = {
  'upper-a': [
    'Machine Chest Press',
    'Lat Pulldown',
    'Seated Cable Row',
    'Machine Shoulder Press',
    'Dumbbell Bicep Curl',
    'Cable Tricep Pushdown',
  ],
  'lower-a': ['Leg Press', 'Seated Leg Curl', 'Leg Extension', 'Glute Bridge', 'Standing Calf Raises', 'Dead Bug'],
  'upper-b': [
    'Incline Chest Press',
    'Chest Supported Row',
    'Neutral Grip Lat Pulldown',
    'Lateral Raises',
    'Hammer Curls',
    'Tricep Pushdown',
  ],
  'lower-b': ['Leg Press', 'Seated Leg Curl', 'Supported Box Squat', 'Glute Bridge', 'Calf Raises', 'Bird Dog'],
};

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
