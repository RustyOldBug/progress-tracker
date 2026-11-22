import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { checkedCount, completionPct, dayTotals } from '../lib/calc';
import { formatMedium } from '../lib/dates';
import { fmt } from '../lib/format';
import { navigate } from '../lib/router';
import { CHECKLIST_ITEMS, routineLabel } from '../constants';

export default function HistoryPage() {
  const { data, setSelectedDate } = useStore();
  const [limit, setLimit] = useState(30);

  const dates = useMemo(() => {
    const s = new Set<string>();
    data.weights.forEach((w) => s.add(w.date));
    data.foods.forEach((f) => s.add(f.date));
    data.workouts.forEach((w) => s.add(w.date));
    Object.entries(data.daily).forEach(([d, record]) => {
      const hasChecklist = Object.values(record.checklist).some(Boolean);
      const hasSteps = record.steps != null && record.steps > 0;
      const hasWater = record.water > 0;
      const hasNotes = record.notes.trim().length > 0;
      if (hasChecklist || hasSteps || hasWater || hasNotes) s.add(d);
    });
    return [...s].filter(Boolean).sort().reverse();
  }, [data]);

  const open = (d: string, path: string) => {
    setSelectedDate(d);
    navigate(path);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="History" />
      {dates.length === 0 ? (
        <Card>
          <EmptyState title="Nothing recorded yet" hint="Once you log weight, food, steps or workouts, each day appears here." />
        </Card>
      ) : (
        <>
          <ul className="space-y-3">
            {dates.slice(0, limit).map((d) => {
              const w = data.weights.find((x) => x.date === d);
              const t = dayTotals(data.foods, d);
              const r = data.daily[d];
              const g = data.workouts.find((x) => x.date === d);
              return (
                <li key={d}>
                  <Card className="!p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-display text-lg font-semibold">{formatMedium(d)}</h2>
                      <span className="text-sm tabular-nums text-muted">
                        {r ? `${checkedCount(r)} / ${CHECKLIST_ITEMS.length} checklist · ${fmt(completionPct(r))}%` : 'No checklist'}
                      </span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3 md:grid-cols-6">
                      {[
                        ['Weight', w ? `${fmt(w.weight, 1)} kg` : '–'],
                        ['Calories', t.count ? `${fmt(t.calories)} kcal` : '–'],
                        ['Protein', t.count ? `${fmt(t.protein)} g` : '–'],
                        ['Steps', r?.steps != null ? fmt(r.steps) : '–'],
                        ['Water', r && r.water > 0 ? `${fmt(r.water / 1000, 2)} L` : '–'],
                        ['Gym', g ? `${routineLabel(g.workoutType, data.routines, g.routineName)} (${g.status})` : '–'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-muted">{k}</dt>
                          <dd className="font-medium tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="ghost" className="!min-h-9" onClick={() => open(d, '/daily')}>Daily tracker</Button>
                      <Button variant="ghost" className="!min-h-9" onClick={() => open(d, '/nutrition')}>Food</Button>
                      <Button variant="ghost" className="!min-h-9" onClick={() => open(d, '/gym')}>Gym</Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          {dates.length > limit && (
            <Button className="w-full" onClick={() => setLimit((l) => l + 30)}>
              Show older days ({dates.length - limit} more)
            </Button>
          )}
        </>
      )}
    </div>
  );
}
