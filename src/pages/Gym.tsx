import { useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Trash2, Undo2 } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, DateNav, EmptyState, Field, IconButton, Input, Message, Select, Textarea, cx, useConfirm } from '../components/ui';
import { lastExerciseSets, lastPerformance, weekDates } from '../lib/calc';
import { addDays, formatLong, formatMedium, isFutureISO, todayISO, weekdayOf } from '../lib/dates';
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
  const sessionDetailsRef = useRef<HTMLDivElement>(null);
  const plan = profile.schedule[weekdayOf(date)];
  const futureDate = isFutureISO(date);
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

  const createRecord = (status: WorkoutStatus, started: boolean, includeExercises: boolean) => {
    if (!selectedType) return;
    const type: SessionType = selectedType;
    if (type === 'custom' && !customSessionName.trim()) {
      setError('Enter a name for this custom session.');
      return null;
    }
    setError(null);
    const exerciseNames = selectedRoutine?.exercises ?? [];
    const workout: WorkoutRecord = {
      id: uid(),
      date,
      workoutType: type,
      routineName: type === 'custom' ? customSessionName.trim() : routineLabel(type, data.routines),
      exercises: includeExercises ? exerciseNames.map((name) => ({
        id: uid(),
        name,
        sets: lastExerciseSets(data.workouts, name, date) ?? [
          { reps: null, weight: null },
          { reps: null, weight: null },
          { reps: null, weight: null },
        ],
      })) : [],
      duration: null,
      status,
      started,
      notes: '',
    };
    saveWorkout(workout);
    return workout;
  };
  const create = () => { createRecord('planned', !futureDate, !futureDate); };
  const startRecord = () => {
    if (!record || futureDate) return;
    const routine = data.routines.find((item) => item.id === record.workoutType);
    const names = routine?.exercises ?? [];
    patch({
      status: 'planned',
      started: true,
      exercises: names.map((name) => ({
        id: uid(),
        name,
        sets: lastExerciseSets(data.workouts, name, date) ?? [
          { reps: null, weight: null },
          { reps: null, weight: null },
          { reps: null, weight: null },
        ],
      })),
    });
  };
  const skipBeforeStart = () => {
    if (record?.status === 'planned' && record.started === false) {
      patch({ status: 'skipped' });
      return;
    }
    createRecord('skipped', false, false);
  };
  const beginReschedule = () => {
    setMoveTo(addDays(date, 1));
    setMoving(true);
    setError(null);
  };
  const moveBeforeStart = () => {
    if (!moveTo || moveTo === date) return;
    if (data.workouts.some((workout) => workout.date === moveTo)) {
      setError('There is already a session on that date. Choose another date.');
      return;
    }
    if (record) {
      rescheduleWorkout(record.id, moveTo);
    } else {
      const workout = createRecord('planned', false, false);
      if (!workout) return;
      rescheduleWorkout(workout.id, moveTo);
    }
    setSelectedDate(moveTo);
    setMoving(false);
    setError(null);
  };

  const patch = (p: Partial<WorkoutRecord> | ((workout: WorkoutRecord) => Partial<WorkoutRecord>)) =>
    record && !futureDate && updateWorkout(record.id, (workout) => ({ ...workout, ...(typeof p === 'function' ? p(workout) : p) }));
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
        <DateNav date={date} onChange={(d) => { setSelectedDate(d); setNewType(''); setMoving(false); setError(null); }} />
      </header>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Scheduled for this day</p>
            <p className="font-display text-2xl font-bold">{plan === 'rest' ? PLAN_LABELS.rest : routineLabel(plan, data.routines)}</p>
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
            <Button variant="primary" onClick={create} disabled={!selectedType}><Plus size={18} /> {futureDate ? 'Schedule session' : plan === 'rest' ? 'Log a session' : 'Start session'}</Button>
          </div>
          {plan !== 'rest' && !futureDate && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={skipBeforeStart} disabled={futureDate}>Skip session</Button>
              <Button onClick={beginReschedule}>Reschedule</Button>
            </div>
          )}
          {moving && (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-bg p-3">
              <Field label="Move to"><Input type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} /></Field>
              <Button variant="primary" disabled={!moveTo || moveTo === date} onClick={moveBeforeStart}>Move session</Button>
              <Button onClick={() => setMoving(false)}>Cancel</Button>
            </div>
          )}
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
            {record.status === 'planned' && record.started === false ? (
              <>
                <p className="mb-3 text-sm text-muted">This session is scheduled but has not been started.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={startRecord} disabled={futureDate}><Plus size={18} /> {futureDate ? 'Scheduled' : 'Start session'}</Button>
                  <Button onClick={skipBeforeStart} disabled={futureDate}>Skip session</Button>
                  <Button onClick={beginReschedule}>Reschedule</Button>
                </div>
                {moving && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-bg p-3">
                    <Field label="Move to"><Input type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} /></Field>
                    <Button variant="primary" disabled={!moveTo || moveTo === date} onClick={moveBeforeStart}>Move session</Button>
                    <Button onClick={() => setMoving(false)}>Cancel</Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {record.status === 'planned' && (
                <>
                  <Button variant="primary" onClick={complete} disabled={futureDate}><Check size={18} /> Mark completed</Button>
                </>
                )}
                {record.status !== 'planned' && record.status !== 'rescheduled' && (
                <Button onClick={() => patch({ status: 'planned', rescheduledTo: undefined })}><Undo2 size={18} /> {record.status === 'completed' ? 'Undo completion' : 'Back to planned'}</Button>
                )}
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const started = record.status === 'planned' && record.started !== false;
                    if (await confirm({
                      title: started ? 'Cancel this session?' : 'Delete this session?',
                      message: started
                        ? 'This will permanently remove this session and all exercises, sets, duration and notes logged for it.'
                        : 'Its exercises, sets and notes will be removed.',
                      confirmLabel: started ? 'Cancel session' : 'Delete',
                      danger: true,
                    })) deleteWorkout(record.id);
                  }}
                >
                  <Trash2 size={18} /> {record.status === 'planned' && record.started !== false ? 'Cancel session' : 'Delete'}
                </Button>
              </div>
            )}
            {error && <div className="mt-3"><Message tone="error">{error}</Message></div>}
          </Card>

          {record.status === 'completed' && (
            <div ref={sessionDetailsRef} className="scroll-mt-4">
              <Card>
                <CardTitle>Completed session details</CardTitle>
                {record.exercises.length === 0 ? (
                  <EmptyState title="No exercise details recorded" hint="This completed session has no saved exercises or sets." />
                ) : (
                  <ul className="space-y-3">
                    {record.exercises.map((exercise) => (
                      <li key={exercise.id} className="rounded-xl border border-line p-3">
                        <h3 className="font-semibold">{exercise.name || 'Unnamed exercise'}</h3>
                        {exercise.sets.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-sm text-muted">
                            {exercise.sets.map((set, index) => (
                              <li key={index}>
                                Set {index + 1}: {set.weight ?? '–'} kg × {set.reps ?? '–'} reps
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-sm text-muted">No sets recorded.</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {(record.duration != null || record.notes.trim()) && (
                  <dl className="mt-3 grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
                    {record.duration != null && (
                      <div><dt className="text-muted">Duration</dt><dd>{record.duration} minutes</dd></div>
                    )}
                    {record.notes.trim() && (
                      <div><dt className="text-muted">Notes</dt><dd className="whitespace-pre-wrap">{record.notes}</dd></div>
                    )}
                  </dl>
                )}
              </Card>
            </div>
          )}

          {record.status === 'planned' && record.started !== false && !futureDate && <>
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
          </>}
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
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(w.date);
                        setNewType('');
                        requestAnimationFrame(() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          sessionDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        });
                      }}
                      className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:bg-bg"
                    >
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
