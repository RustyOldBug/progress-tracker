import { useState } from 'react';
import { Check, ChevronDown, Plus, Trash2, Undo2 } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, DateNav, EmptyState, Field, IconButton, Input, Message, Select, Textarea, cx, useConfirm } from '../components/ui';
import { lastExerciseSets, lastPerformance, weekDates } from '../lib/calc';
import { addDays, formatLong, formatMedium, weekdayOf } from '../lib/dates';
import { uid } from '../lib/schema';
import { PLAN_LABELS, routineLabel } from '../constants';
import WorkoutProgressChart from '../components/WorkoutProgressChart';
import type { ExerciseLog, SessionType, WorkoutRecord, WorkoutStatus } from '../types';

const STATUS_STYLE: Record<WorkoutStatus, string> = {
  planned: 'bg-bg text-muted',
  completed: 'bg-accent-soft text-accent',
  skipped: 'bg-warn-soft text-warn',
  rescheduled: 'bg-warn-soft text-warn',
};

const toNum = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function Gym() {
  const { data, selectedDate: date, setSelectedDate, saveWorkout, updateWorkout, deleteWorkout, rescheduleWorkout } = useStore();
  const confirm = useConfirm();
  const { profile } = data;
  const [newType, setNewType] = useState<SessionType | ''>('');
  const [customSessionName, setCustomSessionName] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = profile.schedule[weekdayOf(date)];
  const selectedType = newType || (plan === 'rest' ? data.routines[0]?.id ?? '' : plan);
  const selectedRoutine = data.routines.find((routine) => routine.id === selectedType);
  const record = data.workouts.find((w) => w.date === date);

  const weekSet = new Set(weekDates(date));
  const weekDone = data.workouts.filter((w) => weekSet.has(w.date) && w.status === 'completed').length;
  const weekPlanned = profile.schedule.filter((p) => p !== 'rest' && p !== 'recovery').length;
  const history = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const pastExercises = [...new Set(data.workouts
    .filter((workout) => workout.status === 'completed' && workout.date < date)
    .flatMap((workout) => workout.exercises
      .filter((exercise) => exercise.sets.some((set) => (set.weight ?? 0) > 0 || (set.reps ?? 0) > 0))
      .map((exercise) => exercise.name.trim()))
    .filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const create = () => {
    if (!selectedType) return;
    const type: SessionType = selectedType;
    if (type === 'custom' && !customSessionName.trim()) {
      setError('Enter a name for this custom session.');
      return;
    }
    setError(null);
    const exerciseNames = selectedRoutine?.exercises ?? [];
    saveWorkout({
      id: uid(),
      date,
      workoutType: type,
      routineName: type === 'custom' ? customSessionName.trim() : routineLabel(type, data.routines),
      exercises: exerciseNames.map((name) => ({
        id: uid(),
        name,
        sets: lastExerciseSets(data.workouts, name, date) ?? [
          { reps: null, weight: null },
          { reps: null, weight: null },
          { reps: null, weight: null },
        ],
      })),
      duration: null,
      status: 'planned',
      notes: '',
    });
  };

  const patch = (p: Partial<WorkoutRecord> | ((workout: WorkoutRecord) => Partial<WorkoutRecord>)) =>
    record && updateWorkout(record.id, (workout) => ({ ...workout, ...(typeof p === 'function' ? p(workout) : p) }));
  const patchExercise = (id: string, fn: (e: ExerciseLog) => ExerciseLog) =>
    patch((workout) => ({ exercises: workout.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

  const complete = () => {
    if (!record) return;
    if (record.duration != null && (record.duration < 0 || record.duration > 600)) return setError('Duration must be between 0 and 600 minutes.');
    setError(null);
    patch({ status: 'completed', rescheduledTo: undefined });
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Gym</h1>
          <p className="text-sm text-muted">{formatLong(date)}</p>
        </div>
        <DateNav date={date} onChange={(d) => { setSelectedDate(d); setMoving(false); setError(null); }} />
      </header>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Scheduled for this day</p>
            <p className="font-display text-2xl font-bold">{PLAN_LABELS[plan] ?? routineLabel(plan, data.routines)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">Sessions this week</p>
            <p className="font-display text-2xl font-bold tabular-nums">{weekDone} <span className="text-base font-semibold text-muted">/ {weekPlanned}</span></p>
          </div>
        </div>
      </Card>

      {!record ? (
        <Card>
          <CardTitle>{plan === 'rest' ? 'Rest day' : 'Start this session'}</CardTitle>
          <p className="mb-3 text-sm text-muted">
            {plan === 'rest' ? 'Nothing is scheduled. You can still log a session if you train today.' : 'This creates the session with the usual exercises, ready to fill in.'}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56">
              <Field label="Session type">
                <Select value={selectedType} onChange={(e) => setNewType(e.target.value as SessionType)}>
                  <option value="recovery">Active recovery</option>
                  {data.routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
                  <option value="custom">Custom session</option>
                </Select>
              </Field>
            </div>
            {selectedType === 'custom' && (
              <div className="w-full sm:w-56">
                <Field label="Session name">
                  <Input value={customSessionName} onChange={(event) => setCustomSessionName(event.target.value)} placeholder="e.g. Full body" />
                </Field>
              </div>
            )}
            <Button variant="primary" onClick={create} disabled={!selectedType}><Plus size={18} /> {plan === 'rest' ? 'Log a session' : 'Start session'}</Button>
          </div>
          {error && <div className="mt-3"><Message tone="error">{error}</Message></div>}
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle
              right={<span className={cx('rounded-full px-3 py-1 text-sm font-medium', STATUS_STYLE[record.status])}>{record.status === 'rescheduled' && record.rescheduledTo ? `Moved to ${formatMedium(record.rescheduledTo)}` : record.status[0].toUpperCase() + record.status.slice(1)}</span>}
            >
              {routineLabel(record.workoutType, data.routines, record.routineName)}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {record.status === 'planned' && (
                <>
                  <Button variant="primary" onClick={complete}><Check size={18} /> Mark completed</Button>
                  <Button onClick={() => patch({ status: 'skipped' })}>Skip</Button>
                  <Button onClick={() => { setMoving((m) => !m); setMoveTo(addDays(date, 1)); }}>Reschedule</Button>
                </>
              )}
              {record.status !== 'planned' && (
                <Button onClick={() => patch({ status: 'planned', rescheduledTo: undefined })}><Undo2 size={18} /> {record.status === 'completed' ? 'Undo completion' : 'Back to planned'}</Button>
              )}
              <Button
                variant="ghost"
                onClick={async () => {
                  if (await confirm({ title: 'Delete this session?', message: 'Its exercises, sets and notes will be removed. Use Skip or Reschedule to keep a record instead.', confirmLabel: 'Delete', danger: true })) deleteWorkout(record.id);
                }}
              >
                <Trash2 size={18} /> Delete
              </Button>
            </div>
            {moving && (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-bg p-3">
                <Field label="Move to"><Input type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} /></Field>
                <Button variant="primary" disabled={!moveTo || moveTo === date} onClick={() => { rescheduleWorkout(record.id, moveTo); setMoving(false); }}>Move session</Button>
              </div>
            )}
            {error && <div className="mt-3"><Message tone="error">{error}</Message></div>}
          </Card>

          <Card>
            <CardTitle>Exercises</CardTitle>
            {record.exercises.length === 0 && <EmptyState title="No exercises yet" hint="Add one below, for example a walk or mobility work." />}
            <div className="space-y-5">
              {record.exercises.map((ex) => {
                const last = lastPerformance(data.workouts, ex.name, date);
                return (
                  <div key={ex.id} className="rounded-xl border border-line p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Select
                        aria-label={`Past exercises for ${ex.name || 'new exercise'}`}
                        value={pastExercises.some((name) => name.toLocaleLowerCase() === ex.name.trim().toLocaleLowerCase()) ? ex.name : '__custom__'}
                        onChange={(event) => {
                          const selected = event.target.value;
                          if (selected === '__custom__') {
                            patchExercise(ex.id, (item) => ({ ...item, name: '' }));
                            return;
                          }
                          const sets = lastExerciseSets(data.workouts, selected, date);
                          patchExercise(ex.id, (item) => ({
                            ...item,
                            name: selected,
                            sets: sets ?? item.sets,
                          }));
                        }}
                      >
                        <option value="__custom__">Custom exercise…</option>
                        {pastExercises.map((name) => <option key={name} value={name}>{name}</option>)}
                      </Select>
                      <IconButton label={`Remove ${ex.name}`} onClick={() => patch((workout) => ({ exercises: workout.exercises.filter((e) => e.id !== ex.id) }))}><Trash2 size={18} /></IconButton>
                    </div>
                    {(!pastExercises.some((name) => name.toLocaleLowerCase() === ex.name.trim().toLocaleLowerCase())) && (
                      <Input
                        value={ex.name}
                        onChange={(event) => patchExercise(ex.id, (item) => ({ ...item, name: event.target.value }))}
                        aria-label="Exercise name"
                        className="mt-2 font-medium"
                        placeholder="Enter exercise name"
                      />
                    )}
                    {last && <p className="mt-1 text-xs text-muted">Last time: {last}</p>}
                    <div className="mt-2 space-y-2">
                      {ex.sets.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-12 text-sm text-muted">Set {i + 1}</span>
                          <Input type="number" inputMode="decimal" min={0} placeholder="kg" aria-label={`Set ${i + 1} weight in kg`} value={s.weight ?? ''} onChange={(e) => patchExercise(ex.id, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === i ? { ...y, weight: toNum(e.target.value) } : y)) }))} />
                          <span className="text-muted">×</span>
                          <Input type="number" inputMode="numeric" min={0} placeholder="reps" aria-label={`Set ${i + 1} reps`} value={s.reps ?? ''} onChange={(e) => patchExercise(ex.id, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === i ? { ...y, reps: toNum(e.target.value) } : y)) }))} />
                          <IconButton label={`Remove set ${i + 1}`} onClick={() => patchExercise(ex.id, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== i) }))}><Trash2 size={16} /></IconButton>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" className="mt-2" onClick={() => patchExercise(ex.id, (x) => ({ ...x, sets: [...x.sets, { reps: null, weight: null }] }))}><Plus size={16} /> Add set</Button>
                  </div>
                );
              })}
            </div>
            <Button className="mt-4" onClick={() => patch((workout) => ({ exercises: [...workout.exercises, { id: uid(), name: '', sets: [{ reps: null, weight: null }] }] }))}><Plus size={18} /> Add exercise</Button>
          </Card>

          <Card>
            <CardTitle>Duration and notes</CardTitle>
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <Field label="Duration (minutes)">
                <Input type="number" inputMode="numeric" min={0} max={600} value={record.duration ?? ''} onChange={(e) => patch({ duration: toNum(e.target.value) })} />
              </Field>
              <Field label="Notes">
                <Textarea rows={2} value={record.notes} onChange={(e) => patch({ notes: e.target.value })} />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted">Changes save as you type.</p>
          </Card>
        </>
      )}

      <Card>
        <CardTitle>Exercise progress</CardTitle>
        <WorkoutProgressChart workouts={data.workouts} />
      </Card>

      <Card>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold marker:hidden">
            <span>Workout history <span className="ml-1 text-sm font-normal text-muted">({history.length})</span></span>
            <ChevronDown size={18} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            {history.length === 0 ? (
              <EmptyState title="No sessions yet" hint="Sessions you start, complete, skip or move will be listed here." />
            ) : (
              <ul className="divide-y divide-line">
                {history.map((w) => (
                  <li key={w.id}>
                    <button type="button" onClick={() => setSelectedDate(w.date)} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:bg-bg">
                      <span>
                        <span className="block font-medium">{routineLabel(w.workoutType, data.routines, w.routineName)}</span>
                        <span className="block text-sm text-muted">{formatMedium(w.date)}{w.duration ? ` · ${w.duration} min` : ''}</span>
                      </span>
                      <span className={cx('rounded-full px-3 py-1 text-xs font-medium', STATUS_STYLE[w.status])}>{w.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </Card>
    </div>
  );
}
