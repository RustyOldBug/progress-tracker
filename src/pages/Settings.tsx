import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, Field, Input, Message, PageHeader, Select, useConfirm } from '../components/ui';
import { isValidISO, todayISO, WEEKDAY_NAMES } from '../lib/dates';
import { setMode, setPalette, useThemeMode, useThemePalette, type ThemeMode, type ThemePalette } from '../lib/theme';
import { DEFAULT_CHECKLIST_ITEMS, DEFAULT_ROUTINES, defaultProfile } from '../constants';
import { uid } from '../lib/schema';
import type { ChecklistItem, DayPlan, UserProfile, WorkoutRoutine } from '../types';

type Draft = Record<Exclude<keyof UserProfile, 'schedule'>, string> & {
  schedule: DayPlan[];
  routines: WorkoutRoutine[];
  checklistItems: ChecklistItem[];
};

const toDraft = (p: UserProfile, routines: WorkoutRoutine[], checklistItems: ChecklistItem[]): Draft => ({
  name: p.name,
  age: String(p.age),
  gender: p.gender,
  heightCm: String(p.heightCm),
  startingWeight: String(p.startingWeight),
  startingWaist: String(p.startingWaist),
  targetWeight: String(p.targetWeight),
  bmr: String(p.bmr),
  tdee: String(p.tdee),
  calorieTarget: String(p.calorieTarget),
  proteinTarget: String(p.proteinTarget),
  stepsTarget: String(p.stepsTarget),
  waterTargetMl: String(p.waterTargetMl / 1000),
  startDate: p.startDate,
  schedule: [...p.schedule],
  routines: routines.map((routine) => ({ ...routine, exercises: [...routine.exercises] })),
  checklistItems: checklistItems.map((item) => ({ ...item })),
});

const RANGES: [keyof Draft, string, number, number][] = [
  ['age', 'Age', 10, 120],
  ['heightCm', 'Height (cm)', 80, 260],
  ['startingWeight', 'Starting weight (kg)', 20, 400],
  ['targetWeight', 'Target weight (kg)', 20, 400],
  ['startingWaist', 'Starting waist (cm)', 30, 250],
  ['calorieTarget', 'Daily calorie target (kcal)', 500, 10000],
  ['proteinTarget', 'Daily protein target (g)', 10, 600],
  ['stepsTarget', 'Daily steps target', 500, 100000],
  ['waterTargetMl', 'Daily water target (litres)', 0.5, 10],
  ['bmr', 'Estimated BMR (kcal)', 500, 6000],
  ['tdee', 'Estimated TDEE (kcal)', 500, 10000],
];

export default function SettingsPage() {
  const { data, setProfile, setRoutines, setChecklistItems, resetProfile } = useStore();
  const confirm = useConfirm();
  const theme = useThemeMode();
  const palette = useThemePalette();
  const [draft, setDraft] = useState<Draft>(() => toDraft(data.profile, data.routines, data.checklistItems));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const automaticChecklistItems = draft.checklistItems.filter((item) => item.autoComplete);
  const manualChecklistItems = draft.checklistItems.filter((item) => !item.autoComplete);

  const set = (k: keyof Draft, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  const save = (ev: FormEvent) => {
    ev.preventDefault();
    const errs: string[] = [];
    const nums: Record<string, number> = {};
    for (const [k, label, lo, hi] of RANGES) {
      const n = Number(draft[k]);
      if (draft[k] === '' || !Number.isFinite(n) || n < lo || n > hi) errs.push(`${label} must be between ${lo} and ${hi}.`);
      else nums[k] = n;
    }
    if (nums.targetWeight != null && nums.startingWeight != null && nums.targetWeight >= nums.startingWeight)
      errs.push('Target weight must be lower than starting weight.');
    if (!isValidISO(draft.startDate)) errs.push('Start date must be a valid date.');
    else if (draft.startDate > todayISO()) errs.push('Start date cannot be in the future.');
    const routineNames = draft.routines.map((routine) => routine.name.trim().toLocaleLowerCase());
    if (draft.routines.some((routine) => !routine.name.trim())) errs.push('Every workout routine needs a name.');
    if (new Set(routineNames).size !== routineNames.length) errs.push('Workout routine names must be unique.');
    const checklistIds = draft.checklistItems.map((item) => item.id);
    const checklistLabels = draft.checklistItems.map((item) => item.label.trim().toLocaleLowerCase());
    if (draft.checklistItems.some((item) => !item.label.trim())) errs.push('Every checklist item needs a name.');
    if (new Set(checklistIds).size !== checklistIds.length) errs.push('Checklist item IDs must be unique.');
    if (new Set(checklistLabels).size !== checklistLabels.length) errs.push('Checklist item names must be unique.');
    if (DEFAULT_CHECKLIST_ITEMS.some((item) => item.autoComplete && !draft.checklistItems.some((draftItem) =>
      draftItem.id === item.id && draftItem.autoComplete === item.autoComplete
    ))) errs.push('The automatic Calories, Protein, Steps, Water, Weigh-in and Gym checklist items cannot be removed.');
    setErrors(errs);
    if (errs.length) return setSaved(false);
    const routines = draft.routines.map((routine) => ({
      ...routine,
      name: routine.name.trim(),
      exercises: routine.exercises.map((exercise) => exercise.trim()).filter(Boolean),
    }));
    setProfile({
      name: draft.name.trim(),
      gender: draft.gender,
      startDate: draft.startDate,
      schedule: draft.schedule,
      age: nums.age,
      heightCm: nums.heightCm,
      startingWeight: nums.startingWeight,
      targetWeight: nums.targetWeight,
      startingWaist: nums.startingWaist,
      calorieTarget: nums.calorieTarget,
      proteinTarget: nums.proteinTarget,
      stepsTarget: nums.stepsTarget,
      waterTargetMl: Math.round(nums.waterTargetMl * 1000),
      bmr: nums.bmr,
      tdee: nums.tdee,
    });
    setRoutines(routines);
    setChecklistItems(draft.checklistItems.map((item) => ({ ...item, label: item.label.trim() })));
    setSaved(true);
  };

  const reset = async () => {
    if (await confirm({ title: 'Reset settings to defaults?', message: 'Targets, profile values and the weekly gym schedule go back to the original values. Your logged data is not affected.', confirmLabel: 'Reset settings', danger: true })) {
      resetProfile();
      setRoutines(DEFAULT_ROUTINES.map((routine) => ({ ...routine, exercises: [...routine.exercises] })));
      setChecklistItems(DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item })));
      setDraft(toDraft({ ...defaultProfile(), startDate: data.profile.startDate }, DEFAULT_ROUTINES, DEFAULT_CHECKLIST_ITEMS));
      setErrors([]);
      setSaved(true);
    }
  };

  const removeRoutine = async (routine: WorkoutRoutine) => {
    if (!await confirm({
      title: `Delete ${routine.name}?`,
      message: 'Scheduled days using this routine will become rest days. Existing workout history will be kept.',
      confirmLabel: 'Delete routine',
      danger: true,
    })) return;
    setDraft((current) => ({
      ...current,
      routines: current.routines.filter((item) => item.id !== routine.id),
      schedule: current.schedule.map((plan) => plan === routine.id ? 'rest' : plan),
    }));
    setSaved(false);
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader title="Settings" />

      <Card>
        <CardTitle>Profile</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name, optional"><Input value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Gender">
            <Select value={draft.gender} onChange={(e) => set('gender', e.target.value)}>
              {['Male', 'Female', 'Other'].map((g) => <option key={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Start date" hint="The dashboard day count starts here. Set this to the date you actually began tracking.">
            <Input type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          {RANGES.slice(0, 5).map(([k, label, lo, hi]) => (
            <Field key={k} label={label}>
              <Input type="number" inputMode="decimal" step="any" min={lo} max={hi} value={draft[k] as string} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Daily targets</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {RANGES.slice(5).map(([k, label, lo, hi]) => (
            <Field key={k} label={label} hint={k === 'bmr' || k === 'tdee' ? 'Reference estimate. Used for the planned deficit on the Nutrition page.' : undefined}>
              <Input type="number" inputMode="decimal" step="any" min={lo} max={hi} value={draft[k] as string} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle right={
          <Button
            onClick={() => {
              setDraft((current) => ({
                ...current,
                checklistItems: [...current.checklistItems, { id: `custom-${uid()}`, label: '' }],
              }));
              setSaved(false);
            }}
          >
            <Plus size={16} /> Add item
          </Button>
        }>Daily checklist</CardTitle>
        <p className="mb-4 text-sm text-muted">
          Automatic items are required and cannot be removed. Add, rename or remove your manual checklist items.
        </p>
        {automaticChecklistItems.length > 0 && (
          <section aria-labelledby="settings-automatic-checklist-heading">
            <h3 id="settings-automatic-checklist-heading" className="mb-1 font-semibold">Automatic</h3>
            <p className="mb-3 text-xs text-muted">Checked from your daily logs and targets; these are managed by the app.</p>
            <div className="space-y-2">
              {automaticChecklistItems.map((item) => (
                <div key={item.id} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Field
                      label={`${item.label} · required`}
                      hint={item.autoComplete === 'steps'
                        ? 'Checks when logged steps reach your daily target.'
                        : item.autoComplete === 'protein'
                          ? 'Checks when logged protein reaches your daily target.'
                          : item.autoComplete === 'calories'
                            ? 'Checks when food is logged and total calories are within your daily target.'
                            : item.autoComplete === 'water'
                              ? 'Checks when logged water reaches your daily target.'
                              : item.autoComplete === 'weighIn'
                                ? 'Checks when a weight entry is saved for that date.'
                                : item.autoComplete === 'gym'
                                  ? 'Checks when a workout is marked completed for that date.'
                                : undefined}
                    >
                      <Input value={item.label} disabled />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {manualChecklistItems.length > 0 && (
          <section className={automaticChecklistItems.length > 0 ? 'mt-5 border-t border-line pt-4' : ''} aria-labelledby="settings-manual-checklist-heading">
            <h3 id="settings-manual-checklist-heading" className="mb-3 font-semibold">Manual</h3>
            <div className="space-y-2">
              {manualChecklistItems.map((item) => (
                <div key={item.id} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label="Checklist item">
                      <Input
                        value={item.label}
                        onChange={(event) => {
                          const label = event.target.value;
                          setDraft((current) => ({
                            ...current,
                            checklistItems: current.checklistItems.map((entry) => entry.id === item.id ? { ...entry, label } : entry),
                          }));
                          setSaved(false);
                        }}
                        placeholder="e.g. Take a walk"
                      />
                    </Field>
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={`Remove checklist item ${item.label || 'unnamed item'}`}
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        checklistItems: current.checklistItems.filter((entry) => entry.id !== item.id),
                      }));
                      setSaved(false);
                    }}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </Card>

      <Card>
        <CardTitle>Weekly gym schedule</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6, 0].map((i) => (
            <Field key={i} label={WEEKDAY_NAMES[i]}>
              <Select
                value={draft.schedule[i]}
                onChange={(e) => {
                  const s = [...draft.schedule];
                  s[i] = e.target.value as DayPlan;
                  setDraft((d) => ({ ...d, schedule: s }));
                  setSaved(false);
                }}
              >
                <option value="rest">Rest</option>
                <option value="recovery">Active recovery</option>
                {draft.routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
              </Select>
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle right={
          <Button
            onClick={() => {
              const id = `custom-${uid()}`;
              setDraft((current) => ({
                ...current,
                routines: [...current.routines, { id, name: '', exercises: [] }],
              }));
              setSaved(false);
            }}
          >
            <Plus size={16} /> Add routine
          </Button>
        }>Workout routines</CardTitle>
        <p className="mb-4 text-sm text-muted">Create reusable workout types and choose their starting exercises. You can still edit exercises in each workout.</p>
        <div className="space-y-4">
          {draft.routines.map((routine) => (
            <section key={routine.id} className="rounded-xl border border-line p-3">
              <div className="flex items-end gap-2">
                <Field label="Routine name">
                  <Input
                    value={routine.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setDraft((current) => ({
                        ...current,
                        routines: current.routines.map((item) => item.id === routine.id ? { ...item, name } : item),
                      }));
                      setSaved(false);
                    }}
                    placeholder="e.g. Push day"
                  />
                </Field>
                <Button variant="ghost" aria-label={`Delete ${routine.name || 'unnamed routine'}`} onClick={() => removeRoutine(routine)}>
                  <Trash2 size={18} />
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {routine.exercises.map((exercise, index) => (
                  <div key={`${routine.id}-${index}`} className="flex items-center gap-2">
                    <Input
                      aria-label={`${routine.name || 'Routine'} exercise ${index + 1}`}
                      value={exercise}
                      onChange={(e) => {
                        const name = e.target.value;
                        setDraft((current) => ({
                          ...current,
                          routines: current.routines.map((item) => item.id === routine.id
                            ? { ...item, exercises: item.exercises.map((value, i) => i === index ? name : value) }
                            : item),
                        }));
                        setSaved(false);
                      }}
                      placeholder="Exercise name"
                    />
                    <Button
                      variant="ghost"
                      aria-label={`Remove ${exercise || `exercise ${index + 1}`}`}
                      onClick={() => {
                        setDraft((current) => ({
                          ...current,
                          routines: current.routines.map((item) => item.id === routine.id
                            ? { ...item, exercises: item.exercises.filter((_, i) => i !== index) }
                            : item),
                        }));
                        setSaved(false);
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => {
                  setDraft((current) => ({
                    ...current,
                    routines: current.routines.map((item) => item.id === routine.id
                      ? { ...item, exercises: [...item.exercises, ''] }
                      : item),
                  }));
                  setSaved(false);
                }}
              >
                <Plus size={16} /> Add exercise
              </Button>
            </section>
          ))}
          {draft.routines.length === 0 && <p className="text-sm text-muted">No workout routines yet. Add one to schedule training days.</p>}
        </div>
      </Card>

      <Card>
        <CardTitle>Appearance</CardTitle>
        <Field label="Theme">
          <Select value={theme} onChange={(e) => setMode(e.target.value as ThemeMode)}>
            <option value="system">Match my device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Field>
        <Field label="Color palette" hint="Choose an accent color set. It works with light, dark, and device themes.">
          <Select value={palette} onChange={(e) => setPalette(e.target.value as ThemePalette)}>
            <option value="forest">Forest green</option>
            <option value="ocean">Bright ocean blue</option>
            <option value="berry">Berry violet</option>
          </Select>
        </Field>
      </Card>

      {errors.length > 0 && (
        <Message tone="error">
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Message>
      )}
      {saved && <Message tone="ok">Settings saved.</Message>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">Save settings</Button>
        <Button variant="ghost" onClick={reset}>Reset to defaults</Button>
      </div>
    </form>
  );
}
