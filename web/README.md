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

Two build settings (environment variables):

| Setting | Test copy (default) | Main app |
| --- | --- | --- |
| `DAYLINE_BASE` | `/dayline/test` | `/dayline` |
| `DAYLINE_TEST` | `1` | `0` |

The **test copy** keeps its own data (database `dayline-test`, online collections starting with
`test_`). On first start it copies the main app's data once, read-only. Built as the **main app**
(`DAYLINE_TEST=0 DAYLINE_BASE=/dayline npm run build`) it uses the real data directly.

## Where things are

- `src/lib/store.ts`: app state and saving (IndexedDB)
- `src/lib/sync.ts`: Firebase sync
- `src/lib/vault.ts`: locked notes
- `src/lib/files.ts`: attached files
- `src/lib/device.ts`: reminders, install, calendar export
- `src/components/`: the screens and edit windows
- `public/sw.js` + `scripts/sw-shell.mjs`: offline support
