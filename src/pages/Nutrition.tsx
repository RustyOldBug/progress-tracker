import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, DateNav, EmptyState, Field, IconButton, Input, Message, ProgressBar, Select, useConfirm } from '../components/ui';
import { dayTotals, sum } from '../lib/calc';
import { formatLong } from '../lib/dates';
import { fmt } from '../lib/format';
import { MEALS } from '../constants';
import type { MealType } from '../types';

export default function Nutrition() {
  const { data, selectedDate: date, setSelectedDate, addFood, updateFood, deleteFood } = useStore();
  const confirm = useConfirm();
  const { profile } = data;
  const [name, setName] = useState('');
  const [meal, setMeal] = useState<MealType>('Breakfast');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const totals = dayTotals(data.foods, date);
  const items = data.foods.filter((f) => f.date === date);
  const kcalLeft = profile.calorieTarget - totals.calories;
  const protLeft = profile.proteinTarget - totals.protein;

  // Most recently used distinct foods, for one-tap re-entry.
  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof data.foods = [];
    for (const f of [...data.foods].reverse().sort((a, b) => b.date.localeCompare(a.date))) {
      const k = f.foodName.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(f);
      if (out.length >= 12) break;
    }
    return out;
  }, [data.foods]);

  const reset = () => {
    setName('');
    setKcal('');
    setProtein('');
    setEditing(null);
    setError(null);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const c = Number(kcal);
    const p = protein.trim() === '' ? 0 : Number(protein);
    if (!name.trim()) return setError('Enter a food name.');
    if (!Number.isFinite(c) || kcal === '' || c < 0 || c > 10000) return setError('Calories must be between 0 and 10,000.');
    if (!Number.isFinite(p) || p < 0 || p > 1000) return setError('Protein must be between 0 and 1,000 g.');
    const entry = { date, meal, foodName: name.trim(), calories: Math.round(c), protein: Math.round(p * 10) / 10 };
    if (editing) updateFood(editing, entry);
    else addFood(entry);
    reset();
    nameRef.current?.focus();
  };

  const startEdit = (id: string) => {
    const f = data.foods.find((x) => x.id === id);
    if (!f) return;
    setEditing(id);
    setName(f.foodName);
    setMeal(f.meal);
    setKcal(String(f.calories));
    setProtein(String(f.protein));
    setError(null);
    nameRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Nutrition</h1>
          <p className="text-sm text-muted">{formatLong(date)}</p>
        </div>
        <DateNav date={date} onChange={(d) => { setSelectedDate(d); reset(); }} />
      </header>

      <Card>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between">
              <p className="font-medium">Calories</p>
              <p className="tabular-nums text-muted"><span className="font-display text-2xl font-bold text-ink">{fmt(totals.calories)}</span> / {fmt(profile.calorieTarget)} kcal</p>
            </div>
            <div className="my-2"><ProgressBar value={totals.calories} max={profile.calorieTarget} tone={kcalLeft < 0 ? 'warn' : 'accent'} /></div>
            <p className={kcalLeft < 0 ? 'text-sm font-medium text-warn' : 'text-sm text-muted'}>
              {kcalLeft < 0 ? `${fmt(-kcalLeft)} kcal over target` : `${fmt(kcalLeft)} kcal remaining`}
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <p className="font-medium">Protein</p>
              <p className="tabular-nums text-muted"><span className="font-display text-2xl font-bold text-ink">{fmt(totals.protein)}</span> / {fmt(profile.proteinTarget)} g</p>
            </div>
            <div className="my-2"><ProgressBar value={totals.protein} max={profile.proteinTarget} /></div>
            <p className="text-sm text-muted">{protLeft <= 0 ? 'Protein target reached' : `${fmt(protLeft)} g remaining`}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          Planned daily deficit: {fmt(profile.tdee - profile.calorieTarget)} kcal (TDEE {fmt(profile.tdee)} − target {fmt(profile.calorieTarget)}).
        </p>
      </Card>

      <Card>
        <CardTitle right={editing ? <Button variant="ghost" onClick={reset}><X size={16} /> Cancel edit</Button> : undefined}>
          {editing ? 'Edit food' : 'Add food'}
        </CardTitle>
        {recents.length > 0 && !editing && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-muted">Recent foods. Tap one to fill the form.</p>
            <div className="flex flex-wrap gap-2">
              {recents.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { setName(f.foodName); setMeal(f.meal); setKcal(String(f.calories)); setProtein(String(f.protein)); setError(null); }}
                  className="min-h-9 rounded-full border border-line px-3 text-sm hover:bg-bg"
                >
                  {f.foodName}
                </button>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Food name">
              <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paneer bhurji with 2 rotis" />
            </Field>
          </div>
          <Field label="Meal">
            <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
              {MEALS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories (kcal)">
              <Input type="number" inputMode="numeric" min={0} value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </Field>
            <Field label="Protein (g)">
              <Input type="number" inputMode="decimal" step="any" min={0} value={protein} onChange={(e) => setProtein(e.target.value)} />
            </Field>
          </div>
          <div className="space-y-2 sm:col-span-2">
            {error && <Message tone="error">{error}</Message>}
            <Button type="submit" variant="primary" className="w-full sm:w-auto">{editing ? 'Save changes' : 'Add food'}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Meals</CardTitle>
        {items.length === 0 ? (
          <EmptyState title="Nothing logged for this day" hint="Add your first food above and the totals update everywhere." />
        ) : (
          <div className="space-y-5">
            {MEALS.map((m) => {
              const list = items.filter((f) => f.meal === m);
              if (list.length === 0) return null;
              return (
                <div key={m}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <h3 className="font-display font-semibold">{m}</h3>
                    <span className="text-sm tabular-nums text-muted">{fmt(sum(list.map((f) => f.calories)))} kcal · {fmt(sum(list.map((f) => f.protein)))} g protein</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {list.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{f.foodName}</p>
                          <p className="text-sm tabular-nums text-muted">{fmt(f.calories)} kcal · {fmt(f.protein)} g protein</p>
                        </div>
                        <div className="flex shrink-0">
                          <IconButton label={`Edit ${f.foodName}`} onClick={() => startEdit(f.id)}><Pencil size={18} /></IconButton>
                          <IconButton
                            label={`Delete ${f.foodName}`}
                            onClick={async () => {
                              if (await confirm({ title: 'Delete this food?', message: `${f.foodName} will be removed from ${m}.`, confirmLabel: 'Delete', danger: true })) {
                                deleteFood(f.id);
                                if (editing === f.id) reset();
                              }
                            }}
                          >
                            <Trash2 size={18} />
                          </IconButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
