# Dayline Planner - Checklist

Live app: https://ekaynak2026-droid.github.io/dayline/

This branch holds the **published** app that GitHub Pages serves. Do not edit it by hand:
it is filled automatically every time the `live` branch changes.

- [`dev`](https://github.com/ekaynak2026-droid/dayline/tree/dev): all development happens here (source code in `web/`).
- [`live`](https://github.com/ekaynak2026-droid/dayline/tree/live): the released version. To release, merge `dev` into `live`;
  GitHub Actions then builds the app and puts it on this branch within a couple of minutes.
- `dev-build`: an automatic preview build of `dev`.

Files kept on this branch: `test/` (forwards the old test address to the main app), `.nojekyll`,
`SYNC-SETUP.md` (setting up the Firebase sync account) and `WALKTHROUGH.md` (how the original version was built).
The previous plain HTML/JS version can still be recovered from commit `b928b80` in this branch's history.
