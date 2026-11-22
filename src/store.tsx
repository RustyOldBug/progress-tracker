import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppData, ChecklistKey, DailyRecord, FoodEntry, UserProfile, WeightEntry, WorkoutRecord } from './types';
import { defaultProfile } from './constants';
import { todayISO, addDays } from './lib/dates';
import { defaultData, emptyDaily, migrate, uid } from './lib/schema';
import { mergeData, type MergeReport } from './lib/backup';

export const STORAGE_KEY = 'wlt:data';

function load(): { data: AppData; error: string | null } {
  let text: string | null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      data: defaultData(),
      error: 'Browser storage is blocked, so nothing you enter can be saved. Allow site data for this page, or leave private browsing.',
    };
  }
  if (!text) return { data: defaultData(), error: null };
  try {
    return { data: migrate(JSON.parse(text)), error: null };
  } catch {
    try {
      localStorage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, text);
    } catch {
      /* ignore */
    }
    return {
      data: defaultData(),
      error:
        'Your saved data could not be read, so the app started empty. The unreadable copy was kept in browser storage under a key starting with "wlt:data:corrupt".',
    };
  }
}

type NewWeight = Omit<WeightEntry, 'id'>;
type NewFood = Omit<FoodEntry, 'id'>;

interface Store {
  data: AppData;
  storageError: string | null;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  setProfile: (p: UserProfile) => void;
  resetProfile: () => void;
  saveWeight: (e: NewWeight) => void;
  deleteWeight: (id: string) => void;
  addFood: (f: NewFood) => void;
  updateFood: (id: string, f: NewFood) => void;
  deleteFood: (id: string) => void;
  updateDaily: (date: string, fn: (r: DailyRecord) => DailyRecord) => void;
  toggleCheck: (date: string, key: ChecklistKey) => void;
  addWater: (date: string, ml: number) => void;
  saveWorkout: (w: WorkoutRecord) => void;
  deleteWorkout: (id: string) => void;
  rescheduleWorkout: (id: string, newDate: string) => void;
  replaceAll: (incoming: AppData) => void;
  mergeIn: (incoming: AppData) => MergeReport;
  eraseAll: () => void;
  markBackup: () => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(load);
  const [data, setData] = useState<AppData>(initial.data);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  // Auto-save on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaveError(null);
    } catch {
      setSaveError('Changes could not be saved because browser storage is full or blocked. Download a backup now.');
    }
  }, [data]);

  // Keep several open tabs in sync instead of letting them overwrite each other.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setData(migrate(JSON.parse(e.newValue)));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const upsertById = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

  const updateDaily: Store['updateDaily'] = (date, fn) =>
    setData((d) => ({ ...d, daily: { ...d.daily, [date]: fn(d.daily[date] ?? emptyDaily(date)) } }));

  const store: Store = {
    data,
    storageError: initial.error ?? saveError,
    selectedDate,
    setSelectedDate,
    setProfile: (profile) => setData((d) => ({ ...d, profile })),
    resetProfile: () => setData((d) => ({ ...d, profile: { ...defaultProfile(), startDate: d.profile.startDate } })),
    saveWeight: (e) =>
      setData((d) => {
        const existing = d.weights.find((w) => w.date === e.date);
        return { ...d, weights: upsertById(d.weights, { id: existing?.id ?? uid(), ...e }) };
      }),
    deleteWeight: (id) => setData((d) => ({ ...d, weights: d.weights.filter((w) => w.id !== id) })),
    addFood: (f) => setData((d) => ({ ...d, foods: [...d.foods, { id: uid(), ...f }] })),
    updateFood: (id, f) => setData((d) => ({ ...d, foods: d.foods.map((x) => (x.id === id ? { id, ...f } : x)) })),
    deleteFood: (id) => setData((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) })),
    updateDaily,
    toggleCheck: (date, key) =>
      updateDaily(date, (r) => ({ ...r, checklist: { ...r.checklist, [key]: !r.checklist[key] } })),
    addWater: (date, ml) => updateDaily(date, (r) => ({ ...r, water: Math.max(0, r.water + ml) })),
    saveWorkout: (w) => setData((d) => ({ ...d, workouts: upsertById(d.workouts, w) })),
    deleteWorkout: (id) => setData((d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) })),
    rescheduleWorkout: (id, newDate) =>
      setData((d) => {
        const w = d.workouts.find((x) => x.id === id);
        if (!w || w.date === newDate) return d;
        const moved: WorkoutRecord = { ...w, status: 'rescheduled', rescheduledTo: newDate };
        let workouts = d.workouts.map((x) => (x.id === id ? moved : x));
        if (!workouts.some((x) => x.date === newDate)) {
          workouts = [
            ...workouts,
            {
              id: uid(),
              date: newDate,
              workoutType: w.workoutType,
              exercises: w.exercises.map((e) => ({
                id: uid(),
                name: e.name,
                sets: e.sets.map(() => ({ reps: null, weight: null })),
              })),
              duration: null,
              status: 'planned',
              notes: '',
            },
          ];
        }
        return { ...d, workouts };
      }),
    replaceAll: (incoming) => setData((d) => ({ ...incoming, lastBackupAt: d.lastBackupAt })),
    mergeIn: (incoming) => {
      const { merged, report } = mergeData(data, incoming);
      setData(merged);
      return report;
    },
    eraseAll: () => setData((d) => ({ ...defaultData(), lastBackupAt: d.lastBackupAt })),
    markBackup: () => setData((d) => ({ ...d, lastBackupAt: new Date().toISOString() })),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const yesterday = () => addDays(todayISO(), -1);
