import { useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { Button, Card, CardTitle, Field, Input, Message, PageHeader, Select, useConfirm } from '../components/ui';
import { isValidISO, WEEKDAY_NAMES } from '../lib/dates';
import { setMode, useThemeMode, type ThemeMode } from '../lib/theme';
import { defaultProfile, PLAN_LABELS } from '../constants';
import type { DayPlan, UserProfile } from '../types';

type Draft = Record<Exclude<keyof UserProfile, 'schedule'>, string> & { schedule: DayPlan[] };

const toDraft = (p: UserProfile): Draft => ({
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
  const { data, setProfile, resetProfile } = useStore();
  const confirm = useConfirm();
  const theme = useThemeMode();
  const [draft, setDraft] = useState<Draft>(() => toDraft(data.profile));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

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
    setErrors(errs);
    if (errs.length) return setSaved(false);
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
    setSaved(true);
  };

  const reset = async () => {
    if (await confirm({ title: 'Reset settings to defaults?', message: 'Targets, profile values and the weekly gym schedule go back to the original values. Your logged data is not affected.', confirmLabel: 'Reset settings', danger: true })) {
      resetProfile();
      setDraft(toDraft({ ...defaultProfile(), startDate: data.profile.startDate }));
      setErrors([]);
      setSaved(true);
    }
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
          <Field label="Start date" hint="Used for the day count on the dashboard.">
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
                {(Object.keys(PLAN_LABELS) as DayPlan[]).map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
              </Select>
            </Field>
          ))}
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
