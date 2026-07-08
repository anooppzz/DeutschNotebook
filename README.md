# Deutsch Knowledge System (Phase 1)

A minimal offline-capable PWA for German lessons and exercises.

## Run locally
From this folder, start any static server (fetch() requires http://, not file://):

```
python -m http.server 8000
```

Then open http://localhost:8000 in a browser.

## Try it
- Home page lists the three bundled lessons (seeded into IndexedDB on first load).
- Click a lesson, e.g. **Possessive Articles**, to see grammar text, an example, and a multiple-choice exercise.
- Use the search box (top right) and press Enter to search lesson text/vocabulary.
- Open DevTools → Application → Service Workers to confirm offline caching after the first load.

## Add a new lesson
1. Drop a new `<id>.json` file into `data/lessons/` (matching `schema/lesson.schema.json`).
2. Add the filename mapping in `js/app.js` (`lessonFileFor`) and its id to `BUNDLED_LESSONS`,
   or load it manually via `putLesson()` in the console.
3. Reload the page.

## Validate lesson/exercise JSON
```
npm install -g ajv-cli
ajv validate -s schema/lesson.schema.json -d "data/lessons/*.json"
ajv validate -s schema/exercise.schema.json -d "data/exercises/*.json"
```
This also runs automatically in CI on push/PR (`.github/workflows/ci.yml`).

## Notes on fixes vs. the original Copilot draft
- All `fetch()` paths were changed from absolute (`/data/...`) to relative (`data/...`) so the app works
  from any subfolder — including a synced OneDrive folder opened via a local server, or a GitHub Pages
  project site (not just a domain root).
- `js/app.js` now seeds the three bundled lessons into IndexedDB on first run — the original code only
  read from IndexedDB and never populated it, so the lesson list would always show "No lessons found."
- Removed a duplicate/invalid re-export line in `js/search.js`.
- Added basic HTML-escaping for user-visible strings (lesson titles, search query) in the router and
  renderer to avoid unintended HTML injection.
- Dropped a `dependsOn` reference to a lesson (`personal-pronouns-01`) that doesn't exist in this Phase 1
  bundle, to avoid a dangling reference.

## Admin tools (import + AI draft review)
Open `admin.html` (also linked from the "Admin" button on the main app header) to get:
- **Import Lesson** — paste or drop a `lesson.json`, validate it against the schema (AJV, loaded from
  `https://esm.sh/ajv@8` — requires internet access), and store it into IndexedDB with search indexing
  and dependency/related graph edges. Note this only writes into the browser's IndexedDB, not back to a
  file on disk — there's no backend here to do that.
- **AI Drafts** — lists lessons in `data/drafts/` (via `data/drafts/manifest.json`), lets you preview,
  edit, and validate before accepting one into the canonical lesson set. One sample draft
  (`ai-perfekt.json`, a Perfekt-tense lesson) is included so you can try the flow immediately.

## Exercise types
`js/quiz.js` now supports: `multiple_choice`, `fill_blank`, `drag_drop`, `ordering`, `matching`, and
`listening`. New types can be added via `registerExercise(type, rendererFn)`.

## Tests
Open `tests/run-tests.html` from a running local server (not `file://`) to run basic storage and AJV
validator checks in-browser; results show as PASS/FAIL on the page.

## Accessibility
- A "Skip to content" link appears on Tab focus at the top of the page.
- Focus moves to the page content automatically after every navigation (route change).
- Visible focus outlines are enforced site-wide.
- Exercises use `role="group"` / `aria-label` and real `<button>`/`<input>` elements for keyboard access.

## Notes on fixes vs. the Copilot draft for this batch
- Swapped the AJV import from `cdn.jsdelivr.net/.../ajv.min.js` (a UMD bundle, not real ESM — `import Ajv from`
  would fail in a browser) to `https://esm.sh/ajv@8`, which serves a proper ES module.
- Changed all `/schema/...`, `/data/...` absolute fetch paths in `import-ui.js`, `admin.js`, and the tests
  to relative paths, consistent with the rest of the app.
- The original snippet suggested mounting the import/admin UI directly into `#app` inside `index.html`,
  which the router immediately overwrites on every route change. Built a separate `admin.html` page instead
  so the tooling doesn't fight the router.
- `tests/validator.spec.js` originally fetched `/schema/lesson.schema.json`; since the test page lives
  under `tests/`, that path is now `../schema/lesson.schema.json` so it actually resolves.
- Fixed the `ordering` exercise's drag handler, which read a stale index after list mutation; it now
  fully re-renders the list on each drop so indices stay correct.
- `putGraphEdges` no longer risks calling `resolve()` after a `reject()` if one `put` fails mid-batch.

## Uploading to OneDrive
Unzip this folder and drop the whole `DeutschNotebook` folder into your OneDrive "Project" folder via the
OneDrive desktop app or the web uploader (upload the folder, not individual files, to keep the structure).
Note that OneDrive sync alone won't "run" the app — you still need to serve it locally (see above) or
host it somewhere (e.g. GitHub Pages) for the service worker and fetch() calls to work, since browsers
block those on `file://` paths.

## Also available in Google Drive
This same project (all files, same folder hierarchy) has been uploaded to
`Claude/Projects/DeutschNotebook` in Google Drive. As with OneDrive, Drive sync alone won't run the app —
download the folder and serve it locally, or push it to GitHub Pages, to actually use it in a browser.
