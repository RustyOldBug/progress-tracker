export type WorkoutType = string;
export type SessionType = WorkoutType | 'recovery';
export type DayPlan = SessionType | 'rest';
export type MealType = 'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner';
export type WorkoutStatus = 'planned' | 'completed' | 'skipped' | 'rescheduled';

export type ChecklistKey =
  | 'calories'
  | 'protein'
  | 'steps'
  | 'gym'
  | 'water'
  | 'produce'
  | 'sleep'
  | 'weighIn';

export interface UserProfile {
  name: string;
  age: number;
  gender: string;
  heightCm: number;
  startingWeight: number;
  startingWaist: number;
  targetWeight: number;
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinTarget: number;
  stepsTarget: number;
  waterTargetMl: number;
  startDate: string;
  /** Index 0 = Sunday ... 6 = Saturday */
  schedule: DayPlan[];
}

export interface WorkoutRoutine {
  id: WorkoutType;
  name: string;
  exercises: string[];
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  waist: number | null;
  notes: string;
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: MealType;
  foodName: string;
  calories: number;
  protein: number;
}

export interface DailyRecord {
  date: string;
  checklist: Record<ChecklistKey, boolean>;
  steps: number | null;
  /** millilitres */
  water: number;
  notes: string;
}

export interface SetLog {
  reps: number | null;
  weight: number | null;
}

export interface ExerciseLog {
  id: string;
  name: string;
  sets: SetLog[];
}

export interface WorkoutRecord {
  id: string;
  date: string;
  workoutType: SessionType;
  routineName?: string;
  exercises: ExerciseLog[];
  duration: number | null;
  status: WorkoutStatus;
  started?: boolean;
  rescheduledTo?: string;
  notes: string;
}

export interface AppData {
  schemaVersion: number;
  profile: UserProfile;
  weights: WeightEntry[];
  foods: FoodEntry[];
  daily: Record<string, DailyRecord>;
  workouts: WorkoutRecord[];
  routines: WorkoutRoutine[];
  lastBackupAt: string | null;
}
