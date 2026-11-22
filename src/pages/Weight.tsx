import { useState, type FormEvent } from 'react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, EmptyState, Field, IconButton, Input, Message, PageHeader, Textarea, useConfirm } from '../components/ui';
import WeightChart from '../components/WeightChart';
import { avgWeeklyChange, latestWeight, sortedWeights } from '../lib/calc';
import { formatMedium, isValidISO, todayISO } from '../lib/dates';
import { fmt, fmtKg, fmtSigned } from '../lib/format';

export default function Weight() {
  const { data, saveWeight, deleteWeight } = useStore();
  const confirm = useConfirm();
  const { profile } = data;
  const [date, setDate] = useState(todayISO);
  const initialEntry = data.weights.find((entry) => entry.date === date);
  const [weight, setWeight] = useState(() => initialEntry ? String(initialEntry.weight) : '');
  const [waist, setWaist] = useState(() => initialEntry?.waist != null ? String(initialEntry.waist) : '');
  const [notes, setNotes] = useState(() => initialEntry?.notes ?? '');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const existing = data.weights.find((w) => w.date === date);
  const asc = sortedWeights(data.weights);
  const rows = [...asc].reverse();
  const latest = latestWeight(data.weights);
  const latestWaist = [...asc].reverse().find((w) => w.waist != null)?.waist ?? null;
  const weekly = avgWeeklyChange(data.weights);

  const load = (d: string) => {
    setDate(d);
    const e = data.weights.find((w) => w.date === d);
    setWeight(e ? String(e.weight) : '');
    setWaist(e?.waist != null ? String(e.waist) : '');
    setNotes(e?.notes ?? '');
    setMsg(null);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const w = Number(weight);
    const ws = waist.trim() === '' ? null : Number(waist);
    if (!isValidISO(date)) return setMsg({ tone: 'error', text: 'Choose a valid date.' });
    if (!weight || !Number.isFinite(w) || w < 20 || w > 400)
      return setMsg({ tone: 'error', text: 'Enter a weight between 20 and 400 kg.' });
    if (ws != null && (!Number.isFinite(ws) || ws < 30 || ws > 250))
      return setMsg({ tone: 'error', text: 'Waist must be between 30 and 250 cm, or left empty.' });
    saveWeight({ date, weight: Math.round(w * 10) / 10, waist: ws, notes: notes.trim() });
    setMsg({ tone: 'ok', text: existing ? `Updated the entry for ${formatMedium(date)}.` : `Saved ${fmt(w, 1)} kg for ${formatMedium(date)}.` });
  };

  const remove = async (id: string, d: string) => {
    if (await confirm({ title: 'Delete this entry?', message: `The weigh-in for ${formatMedium(d)} will be removed.`, confirmLabel: 'Delete', danger: true })) {
      deleteWeight(id);
      if (d === date) load(d);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Weight" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Current', fmtKg(latest?.weight)],
          ['Total lost', fmtKg(latest ? profile.startingWeight - latest.weight : null)],
          ['Average per week', weekly == null ? '–' : `${fmtSigned(weekly)} kg`],
          ['Waist', latestWaist == null ? '–' : `${fmt(latestWaist, 1)} cm`],
        ].map(([k, v]) => (
          <Card key={k} className="!p-4">
            <p className="text-sm text-muted">{k}</p>
            <p className="font-display text-2xl font-bold tabular-nums">{v}</p>
          </Card>
        ))}
      </div>
      {weekly == null && <p className="text-sm text-muted">The weekly average appears once you have weigh-ins in two different weeks.</p>}

      <Card>
        <CardTitle>{existing ? 'Edit entry' : 'Log weight'}</CardTitle>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => e.target.value && load(e.target.value)} required />
          </Field>
          <Field label="Morning weight (kg)">
            <Input type="number" inputMode="decimal" step="0.1" min={20} max={400} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 101.4" required />
          </Field>
          <Field label="Waist (cm), optional">
            <Input type="number" inputMode="decimal" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="e.g. 120" />
          </Field>
          <Field label="Notes, optional">
            <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            {existing && <p className="text-sm text-muted">An entry already exists for this date. Saving will update it.</p>}
            {msg && <Message tone={msg.tone}>{msg.text}</Message>}
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              {existing ? 'Update entry' : 'Save entry'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Weight trend</CardTitle>
        <WeightChart weights={data.weights} profile={profile} />
      </Card>

      <Card>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold marker:hidden">
            <span>History <span className="ml-1 text-sm font-normal text-muted">({rows.length})</span></span>
            <ChevronDown size={18} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            {rows.length === 0 ? (
              <EmptyState title="No weigh-ins yet" hint="Your entries will be listed here, newest first." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-2 font-medium">Date</th>
                      <th className="py-2 font-medium">Weight</th>
                      <th className="hidden py-2 font-medium sm:table-cell">Change</th>
                      <th className="hidden py-2 font-medium sm:table-cell">Waist</th>
                      <th className="py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r, i) => {
                      const prev = rows[i + 1];
                      return (
                        <tr key={r.id}>
                          <td className="py-2 pr-2">
                            {formatMedium(r.date)}
                            {r.notes && <span className="block max-w-[10rem] truncate text-xs text-muted">{r.notes}</span>}
                          </td>
                          <td className="py-2 pr-2 font-semibold tabular-nums">{fmt(r.weight, 1)}</td>
                          <td className="hidden py-2 pr-2 tabular-nums text-muted sm:table-cell">{prev ? fmtSigned(r.weight - prev.weight) : '–'}</td>
                          <td className="hidden py-2 pr-2 tabular-nums text-muted sm:table-cell">{r.waist == null ? '–' : fmt(r.waist, 1)}</td>
                          <td className="py-1 text-right">
                            <div className="flex justify-end">
                              <IconButton
                                label={`Edit entry for ${r.date}`}
                                onClick={() => {
                                  load(r.date);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              >
                                <Pencil size={18} />
                              </IconButton>
                              <IconButton label={`Delete entry for ${r.date}`} onClick={() => remove(r.id, r.date)}>
                                <Trash2 size={18} />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </Card>
    </div>
  );
}
