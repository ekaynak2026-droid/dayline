# Dayline Planner - Checklist

Live app: https://ekaynak2026-droid.github.io/dayline/

This branch holds the **built** app that GitHub Pages serves. The source code is on the
[`next-version`](https://github.com/ekaynak2026-droid/dayline/tree/next-version) branch (folder `web/`).
To publish a new version: in `web/`, run `DAYLINE_TEST=0 DAYLINE_BASE=/dayline npm run build`,
then copy the contents of `web/out/` here (keep `test/`, `.nojekyll` and the guides).

- `test/` forwards the old test address to the main app.
- The previous version (plain HTML/JS) is kept on the `live-backup-v1.5.1` branch.
- `SYNC-SETUP.md`: setting up the Firebase sync account. `WALKTHROUGH.md`: how the original version was built.
