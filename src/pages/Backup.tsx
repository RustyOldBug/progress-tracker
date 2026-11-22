import { useRef, useState } from 'react';
import { Download, TriangleAlert, Upload } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardTitle, Message, PageHeader, useConfirm } from '../components/ui';
import { downloadBackup, parseBackup, type MergeReport } from '../lib/backup';
import type { AppData } from '../types';

const counts = (d: AppData) => ({
  'Weight entries': d.weights.length,
  'Food entries': d.foods.length,
  'Daily records': Object.keys(d.daily).length,
  Workouts: d.workouts.length,
  'Workout routines': d.routines.length,
});

type Pending = { name: string; createdAt: string; schemaVersion: number; data: AppData };

export default function Backup() {
  const { data, markBackup, replaceAll, mergeIn, eraseAll } = useStore();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [safetyCopy, setSafetyCopy] = useState(true);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const exportNow = () => {
    try {
      const name = downloadBackup(data);
      markBackup();
      setMsg({ tone: 'ok', text: `Downloaded ${name}. Keep it somewhere safe, such as cloud storage or email.` });
    } catch {
      setMsg({ tone: 'error', text: 'The backup could not be created in this browser.' });
    }
  };

  const onFile = async (file: File | undefined) => {
    setMsg(null);
    setPending(null);
    if (!file) return;
    const text = await file.text().catch(() => null);
    if (text == null) return setMsg({ tone: 'error', text: 'The file could not be read.' });
    const res = parseBackup(text);
    if (!res.ok) return setMsg({ tone: 'error', text: res.error });
    setPending({ name: file.name, createdAt: res.createdAt, schemaVersion: res.schemaVersion, data: res.data });
    setMode('merge');
    setSafetyCopy(true);
  };

  const reportText = (r: MergeReport) => {
    const a = r.added;
    const s = r.skipped;
    return `Merged. Added ${a.weights} weights, ${a.foods} foods, ${a.daily} daily records, ${a.workouts} workouts and ${a.routines} routines. Skipped ${s.weights + s.foods + s.daily + s.workouts + s.routines} records that already existed.`;
  };

  const doImport = () => {
    if (!pending) return;
    try {
      if (mode === 'replace') {
        if (safetyCopy) downloadBackup(data, 'weight-loss-backup-before-restore');
        replaceAll(pending.data);
        setMsg({ tone: 'ok', text: `Restored everything from ${pending.name}.${safetyCopy ? ' A copy of your previous data was downloaded first.' : ''}` });
      } else {
        setMsg({ tone: 'ok', text: reportText(mergeIn(pending.data)) });
      }
    } catch {
      setMsg({ tone: 'error', text: 'The import failed and your existing data was not changed.' });
    }
    setPending(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const erase = async () => {
    const ok = await confirm({
      title: 'Erase all data?',
      message: 'This removes every weight, food, daily and workout record from this browser. Download a backup first if you might want it back.',
      confirmLabel: 'Erase everything',
      danger: true,
    });
    if (ok) {
      eraseAll();
      setMsg({ tone: 'ok', text: 'All data was erased from this browser.' });
    }
  };

  const cur = counts(data);
  return (
    <div className="space-y-4">
      <PageHeader title="Backup & Restore" />

      <Message tone="warn">
        <span className="flex gap-2">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span>Your data lives only in this browser. Clearing site data, switching browsers or changing phones erases it. Download a backup every week and before you switch devices.</span>
        </span>
      </Message>
      {msg && <Message tone={msg.tone}>{msg.text}</Message>}

      <Card>
        <CardTitle>Export backup</CardTitle>
        <p className="mb-3 text-sm text-muted">
          Last backup: {data.lastBackupAt ? new Date(data.lastBackupAt).toLocaleString() : 'none yet on this device'}
        </p>
        <Button variant="primary" onClick={exportNow}><Download size={18} /> Download backup</Button>
      </Card>

      <Card>
        <CardTitle>Restore from file</CardTitle>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Backup file" />
        <Button onClick={() => fileRef.current?.click()}><Upload size={18} /> Choose backup file</Button>

        {pending && (
          <div className="mt-4 space-y-4 rounded-xl border border-line p-4">
            <div>
              <p className="font-medium">{pending.name}</p>
              <p className="text-sm text-muted">
                {pending.createdAt ? `Created ${new Date(pending.createdAt).toLocaleString()} · ` : ''}schema v{pending.schemaVersion}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr><th className="py-1 font-medium">Records</th><th className="py-1 font-medium">In file</th><th className="py-1 font-medium">In app now</th></tr>
              </thead>
              <tbody>
                {Object.entries(counts(pending.data)).map(([k, v]) => (
                  <tr key={k} className="border-t border-line"><td className="py-1.5">{k}</td><td className="tabular-nums">{v}</td><td className="tabular-nums">{cur[k as keyof typeof cur]}</td></tr>
                ))}
              </tbody>
            </table>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">How should this be imported?</legend>
              <label className="flex min-h-11 items-start gap-3 rounded-lg border border-line p-3">
                <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1" />
                <span><span className="block font-medium">Merge with existing records</span><span className="block text-sm text-muted">Keeps everything you have. Adds only records for dates or entries you do not already have. Your current settings stay.</span></span>
              </label>
              <label className="flex min-h-11 items-start gap-3 rounded-lg border border-line p-3">
                <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-1" />
                <span><span className="block font-medium">Replace existing data</span><span className="block text-sm text-muted">Everything in the app is overwritten with the contents of this file, including settings.</span></span>
              </label>
            </fieldset>
            {mode === 'replace' && (
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={safetyCopy} onChange={(e) => setSafetyCopy(e.target.checked)} />
                Download a copy of my current data first (recommended)
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={doImport}>{mode === 'replace' ? 'Replace my data' : 'Merge backup'}</Button>
              <Button onClick={() => { setPending(null); if (fileRef.current) fileRef.current.value = ''; }}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Erase all data</CardTitle>
        <p className="mb-3 text-sm text-muted">Starts the app from scratch on this browser. Your settings return to their defaults.</p>
        <Button variant="danger" onClick={erase}>Erase all data</Button>
      </Card>
    </div>
  );
}
