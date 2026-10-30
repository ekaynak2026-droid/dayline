# Dayline web (Next.js)

The Dayline planner as a Next.js app: Tasks, Calendar and Notes, with sync between devices,
📂 files and photos with an in-app viewer (PDF, Word, Excel), PIN-locked encrypted notes,
reminders, backup and restore, and offline use. It uses the same data format as the original
Dayline app, so the same data and the same sync account work in both.

## Build

```bash
npm ci
npm run build          # static files in out/, ready for GitHub Pages
```

The default build is the real app for https://ekaynak2026-droid.github.io/dayline/ . Copy the
contents of `out/` to the `main` branch of the `dayline` repository to publish it.

`DAYLINE_TEST=1 DAYLINE_BASE=/dayline/test npm run build` makes a separate test copy that keeps
its own data (database `dayline-test`, online collections starting with `test_`).
The real app brings in anything entered in a test copy automatically, once per device.

Running `npm run dev` opens it at http://localhost:3000/dayline/

## Where things are

- `src/lib/store.ts`: app state and saving (IndexedDB)
- `src/lib/sync.ts`: Firebase sync
- `src/lib/vault.ts`: locked notes
- `src/lib/files.ts`: attached files
- `src/lib/device.ts`: reminders, install, calendar export
- `src/components/`: the screens and edit windows
- `public/sw.js` + `scripts/sw-shell.mjs`: offline support
