import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WorkoutRecord } from '../types';
import { formatLong, formatShort } from '../lib/dates';
import { EmptyState, Field, Select } from './ui';

type Metric = 'weight' | 'reps' | 'volume';

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'weight', label: 'Best weight', unit: 'kg' },
  { id: 'reps', label: 'Total reps', unit: 'reps' },
  { id: 'volume', label: 'Total volume', unit: 'kg-reps' },
];

export default function WorkoutProgressChart({ workouts }: { workouts: WorkoutRecord[] }) {
  const [exercise, setExercise] = useState('');
  const [metric, setMetric] = useState<Metric>('weight');

  const exercises = useMemo(() => {
    const names = new Map<string, string>();
    for (const workout of workouts) {
      if (workout.status !== 'completed') continue;
      for (const item of workout.exercises) {
        const key = item.name.trim().toLocaleLowerCase();
        if (key && !names.has(key)) names.set(key, item.name.trim());
      }
    }
    return [...names.entries()].map(([key, name]) => ({ key, name }));
  }, [workouts]);

  const selectedExercise = exercises.find((item) => item.key === exercise)?.key ?? exercises[0]?.key ?? '';
  const points = useMemo(() => {
    if (!selectedExercise) return [];
    return workouts
      .filter((workout) => workout.status === 'completed')
      .flatMap((workout) => {
        const sets = workout.exercises
          .filter((item) => item.name.trim().toLocaleLowerCase() === selectedExercise)
          .flatMap((item) => item.sets);
        if (!sets.length) return [];

        const values = sets.flatMap((set) => {
          if (metric === 'weight') return set.weight == null ? [] : [set.weight];
          if (metric === 'reps') return set.reps == null ? [] : [set.reps];
          return set.weight == null || set.reps == null ? [] : [set.weight * set.reps];
        });
        if (!values.length) return [];
        const value = metric === 'weight'
          ? values.reduce((best, current) => Math.max(best, current), Number.NEGATIVE_INFINITY)
          : values.reduce((total, current) => total + current, 0);
        return [{ date: workout.date, label: formatShort(workout.date), value }];
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [workouts, selectedExercise, metric]);

  const metricInfo = METRICS.find((item) => item.id === metric)!;

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Exercise">
          <Select
            aria-label="Progress exercise"
            value={selectedExercise}
            onChange={(event) => setExercise(event.target.value)}
            disabled={exercises.length === 0}
          >
            {exercises.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
          </Select>
        </Field>
        <Field label="Metric">
          <Select
            aria-label="Progress metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
          >
            {METRICS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
        </Field>
      </div>
      {exercises.length === 0 ? (
        <EmptyState title="No completed exercises yet" hint="Complete a workout with exercise sets logged to see progress here." />
      ) : points.length === 0 ? (
        <EmptyState title={`No ${metricInfo.label.toLowerCase()} data for this exercise`} hint="Enter sets for this metric in a completed workout to see its trend." />
      ) : (
        <div className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} stroke="rgb(var(--line))" />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
                stroke="rgb(var(--line))"
                width={64}
                unit={` ${metricInfo.id === 'volume' ? 'kg·reps' : metricInfo.unit}`}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString()} ${metricInfo.unit}`, metricInfo.label]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatLong(payload[0].payload.date) : ''}
                contentStyle={{
                  background: 'rgb(var(--surface))',
                  border: '1px solid rgb(var(--line))',
                  borderRadius: 12,
                  color: 'rgb(var(--ink))',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="rgb(var(--accent))"
                strokeWidth={3}
                dot={{ r: 4, fill: 'rgb(var(--accent))' }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        Volume is the sum of weight × reps for logged sets. Trends include completed workouts only.
      </p>
    </div>
  );
}
