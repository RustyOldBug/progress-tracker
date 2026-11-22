import { useState } from 'react';
import { Check, Plus, Trash2, Undo2 } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, DateNav, EmptyState, Field, IconButton, Input, Message, Select, Textarea, cx, useConfirm } from '../components/ui';
import { lastPerformance, weekDates } from '../lib/calc';
import { addDays, formatLong, formatMedium, weekdayOf } from '../lib/dates';
import { newExercises, uid } from '../lib/schema';
import { PLAN_LABELS, SESSION_LABELS } from '../constants';
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
  const { data, selectedDate: date, setSelectedDate, saveWorkout, deleteWorkout, rescheduleWorkout } = useStore();
  const confirm = useConfirm();
  const { profile } = data;
  const plan = profile.schedule[weekdayOf(date)];
  const record = data.workouts.find((w) => w.date === date);
  const [newType, setNewType] = useState<SessionType | ''>('');
  const [moveTo, setMoveTo] = useState('');
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekSet = new Set(weekDates(date));
  const weekDone = data.workouts.filter((w) => weekSet.has(w.date) && w.status === 'completed').length;
  const weekPlanned = profile.schedule.filter((p) => p !== 'rest' && p !== 'recovery').length;
  const history = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);

  const create = () => {
    const type: SessionType = newType || (plan === 'rest' ? 'upper-a' : plan);
    saveWorkout({ id: uid(), date, workoutType: type, exercises: newExercises(type), duration: null, status: 'planned', notes: '' });
  };

  const patch = (p: Partial<WorkoutRecord>) => record && saveWorkout({ ...record, ...p });
  const patchExercise = (id: string, fn: (e: ExerciseLog) => ExerciseLog) =>
    record && patch({ exercises: record.exercises.map((e) => (e.id === id ? fn(e) : e)) });

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
            <p className="font-display text-2xl font-bold">{PLAN_LABELS[plan]}</p>
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
                <Select value={newType || (plan === 'rest' ? 'upper-a' : plan)} onChange={(e) => setNewType(e.target.value as SessionType)}>
                  {(Object.keys(SESSION_LABELS) as SessionType[]).map((t) => <option key={t} value={t}>{SESSION_LABELS[t]}</option>)}
                </Select>
              </Field>
            </div>
            <Button variant="primary" onClick={create}><Plus size={18} /> {plan === 'rest' ? 'Log a session' : 'Start session'}</Button>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle
              right={<span className={cx('rounded-full px-3 py-1 text-sm font-medium', STATUS_STYLE[record.status])}>{record.status === 'rescheduled' && record.rescheduledTo ? `Moved to ${formatMedium(record.rescheduledTo)}` : record.status[0].toUpperCase() + record.status.slice(1)}</span>}
            >
              {SESSION_LABELS[record.workoutType]}
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
                    <div className="flex items-center gap-2">
                      <Input value={ex.name} onChange={(e) => patchExercise(ex.id, (x) => ({ ...x, name: e.target.value }))} aria-label="Exercise name" className="font-medium" />
                      <IconButton label={`Remove ${ex.name}`} onClick={() => patch({ exercises: record.exercises.filter((e) => e.id !== ex.id) })}><Trash2 size={18} /></IconButton>
                    </div>
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
            <Button className="mt-4" onClick={() => patch({ exercises: [...record.exercises, { id: uid(), name: '', sets: [{ reps: null, weight: null }] }] })}><Plus size={18} /> Add exercise</Button>
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
        <CardTitle>Workout history</CardTitle>
        {history.length === 0 ? (
          <EmptyState title="No sessions yet" hint="Sessions you start, complete, skip or move will be listed here." />
        ) : (
          <ul className="divide-y divide-line">
            {history.map((w) => (
              <li key={w.id}>
                <button type="button" onClick={() => setSelectedDate(w.date)} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:bg-bg">
                  <span>
                    <span className="block font-medium">{SESSION_LABELS[w.workoutType]}</span>
                    <span className="block text-sm text-muted">{formatMedium(w.date)}{w.duration ? ` · ${w.duration} min` : ''}</span>
                  </span>
                  <span className={cx('rounded-full px-3 py-1 text-xs font-medium', STATUS_STYLE[w.status])}>{w.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
