# Progress Tracker

A personal weight-loss tracker. React + TypeScript + Vite + Tailwind. No backend, no accounts, no paid services.
Everything is stored in your browser (`localStorage`) and can be exported to or restored from a JSON file.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then builds into dist/
npm run preview    # serve the production build locally
```

Needs Node 18 or newer (Node 20 recommended).

## Deploy to GitHub Pages (free)

1. Push this folder and its `.github/workflows/deploy.yml` file to the repository's `main` branch.
2. In the repository go to **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. The workflow builds with Node.js 20 and deploys on every push to `main`. You can also start it manually from **Actions → Deploy to GitHub Pages → Run workflow**. When it finishes, the site is at
   `https://<your-username>.github.io/<repository-name>/`.
4. Open that address on your phone and choose **Add to Home Screen** (or **Install app** in Chrome) to use it like an app.

The build uses relative asset paths (`base: './'`) and hash-based navigation, so it works under a repository sub-path with no extra configuration.
After your first `npm install`, commit the generated `package-lock.json` so deployments are reproducible.

## Backups (important)

Browser storage belongs to one browser on one device. Clearing site data, switching browsers or changing phones removes it.

- **Export:** Backup & Restore → **Download backup**. The file is named `weight-loss-backup-YYYY-MM-DD.json`. Do this weekly and before changing devices.
- **Restore:** Backup & Restore → **Choose backup file**. The file is validated, then you see how many records it holds compared with what is in the app, and choose:
  - **Merge**: keeps everything you have and adds only records you do not already have (weights, daily records and workouts match by date; food entries by ID). Your current settings stay.
  - **Replace**: overwrites everything with the file. By default a copy of your current data is downloaded first.
- Backups work across devices and browsers. Export on one, import on the other.

## Project layout

```
src/
  store.tsx        central state, auto-save to localStorage, cross-tab sync
  lib/schema.ts    schema version, defaults, migration of stored/imported data
  lib/backup.ts    export, validation, merge rules
  lib/calc.ts      all calculations (progress, weekly averages, trends)
  pages/           Dashboard, Daily, Weight, Nutrition, Gym, History, Backup, Settings
  components/      Layout (sidebar / bottom nav), WeightChart, shared UI
public/            manifest, service worker, icons
```

Storage is versioned (`schemaVersion` in `src/lib/schema.ts`). When the data shape changes, bump the version and add a step to `migrate`.

## Calculation rules

- Current weight is the latest weigh-in. Total lost = starting − current. Remaining = current − target.
- Progress = (starting − current) ÷ (starting − target) × 100, kept between 0 and 100.
- Weekly weight change compares this week's average weight with last week's (weeks run Monday to Sunday).
- Weight chart axes adapt to the selected date range. Weight and workout history sections are collapsed initially.
- Gym exercise trends use completed workouts and only offer metrics with recorded values; zero-weight bodyweight sets do not count as lifted weight or volume.
- Gym sessions can be custom named, and exercises can be added from prior workouts with their latest sets prefilled.
- Appearance settings include light/dark/system modes and Forest, Ocean, and Berry color palettes.
- Nutrition patterns chart daily calorie and protein totals against their targets; averages include only days with food entries.
- Averages use only days that have data. A day with no food logged is never counted as 0 kcal.
- Daily checklist completion = ticked items ÷ 8.

## Ideas for later

Reusable meals, copying a previous day's food, IndexedDB if you start storing photos, optional cloud sync.
