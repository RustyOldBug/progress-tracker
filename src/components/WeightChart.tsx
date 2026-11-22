import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { UserProfile, WeightEntry } from '../types';
import { addDays, daysBetween, formatLong, formatShort, todayISO } from '../lib/dates';
import { sortedWeights, trendSeries } from '../lib/calc';
import { cx, EmptyState } from './ui';

const RANGES = [
  { id: '7', label: 'Week', days: 7 },
  { id: '30', label: 'Month', days: 30 },
  { id: '90', label: '3 months', days: 90 },
  { id: 'all', label: 'All time', days: null },
] as const;

const EPOCH = '2000-01-01';

export default function WeightChart({ weights, profile }: { weights: WeightEntry[]; profile: UserProfile }) {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('30');

  const points = useMemo(() => {
    const series = trendSeries(sortedWeights(weights));
    const days = RANGES.find((r) => r.id === range)?.days ?? null;
    const from = days ? addDays(todayISO(), -(days - 1)) : '0000-00-00';
    return series.filter((p) => p.date >= from).map((p) => ({ ...p, t: daysBetween(EPOCH, p.date) }));
  }, [weights, range]);

  const { start: startW, target: targetW } = { start: profile.startingWeight, target: profile.targetWeight };
  const lo = Math.floor(Math.min(targetW, ...points.map((p) => p.weight)) - 1);
  const hi = Math.ceil(Math.max(startW, ...points.map((p) => p.weight)) + 1);
  const tMin = points.length ? points[0].t : 0;
  const tMax = points.length ? points[points.length - 1].t : 1;
  const pad = tMin === tMax ? 3 : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Chart range">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            aria-pressed={range === r.id}
            className={cx(
              'min-h-9 rounded-lg px-3 text-sm font-medium transition',
              range === r.id ? 'bg-accent text-on-accent' : 'text-muted hover:bg-bg hover:text-ink'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      {points.length === 0 ? (
        <EmptyState
          title="No weigh-ins in this range"
          hint="Log your morning weight on the Weight page to see your trend."
        />
      ) : (
        <div className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[tMin - pad, tMax + pad]}
                tickCount={5}
                tickFormatter={(t) => formatShort(addDays(EPOCH, Number(t)))}
                tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
                stroke="rgb(var(--line))"
              />
              <YAxis
                domain={[lo, hi]}
                tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
                stroke="rgb(var(--line))"
                unit=" kg"
                width={64}
              />
              <Tooltip
                formatter={(v, name) => [`${Number(v).toFixed(1)} kg`, name === 'trend' ? '7-day average' : 'Weight']}
                labelFormatter={(t) => formatLong(addDays(EPOCH, Number(t)))}
                contentStyle={{
                  background: 'rgb(var(--surface))',
                  border: '1px solid rgb(var(--line))',
                  borderRadius: 12,
                  color: 'rgb(var(--ink))',
                }}
              />
              <ReferenceLine
                y={startW}
                stroke="rgb(var(--muted))"
                strokeDasharray="4 4"
                label={{ value: 'Start', position: 'insideTopRight', fontSize: 11, fill: 'rgb(var(--muted))' }}
              />
              <ReferenceLine
                y={targetW}
                stroke="rgb(var(--accent))"
                strokeDasharray="4 4"
                label={{ value: 'Target', position: 'insideBottomRight', fontSize: 11, fill: 'rgb(var(--accent))' }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="rgb(var(--muted))"
                strokeWidth={1.5}
                dot={{ r: 3, fill: 'rgb(var(--muted))' }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="trend"
                stroke="rgb(var(--accent))"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">The green line is your 7-day average. It smooths out daily water swings.</p>
    </div>
  );
}
