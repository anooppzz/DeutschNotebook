import { openDB, putLesson, listLessons, putGraphEdges } from './storage.js';
import { routerInit } from './router.js';
import { indexAllLessons } from './search.js';

const BUNDLED_LESSONS = [
  'grammar-articles-01',
  'grammar-possessives-01',
  'vocab-basic-01'
];

/* Always re-fetches and overwrites the bundled lessons from their JSON
   source on every boot, rather than only once when the database was empty.
   The previous "seed only if empty" approach meant any future edit to a
   bundled lesson's content (e.g. adding new exercise sections) would never
   reach a browser that already had an older cached copy from a prior
   session — the old lesson object just sat in IndexedDB forever. Bundled
   files are the source of truth for bundled lessons, so re-syncing them is
   cheap (3 small fetches) and safe; lessons added via the Admin import
   flow (not in BUNDLED_LESSONS) are untouched here, since those are
   user-added content this shouldn't silently overwrite. */
async function syncBundledLessons() {
  for (const id of BUNDLED_LESSONS) {
    try {
      const res = await fetch(`data/lessons/${lessonFileFor(id)}`);
      if (!res.ok) continue;
      const json = await res.json();
      await putLesson(json);
    } catch (err) {
      console.warn('Could not sync bundled lesson', id, err);
    }
  }
}

/* Writes dependsOn/related graph edges for every lesson currently in the
   database — bundled or Admin-imported — on every boot. Runs independently
   of seeding/syncing above rather than being bundled into it, because a
   version of this that only ran during first-time seeding would never
   backfill edges for lessons a returning user already had cached from
   before this existed (exactly what happened: Possessive Articles' edge to
   Articles never got written for anyone who'd already seeded that lesson
   in an earlier session). putGraphEdges() is idempotent — the same
   from/to/type always overwrites the same record — so writing the same
   edges again every boot is a harmless no-op, not accumulating duplicates.
*/
async function ensureGraphEdges() {
  const lessons = await listLessons();
  for (const lesson of lessons) {
    const edges = [];
    (lesson.dependsOn || []).forEach(dep => edges.push({ from: lesson.id, to: dep, type: 'dependsOn' }));
    (lesson.related || []).forEach(rel => edges.push({ from: lesson.id, to: rel, type: 'related' }));
    if (edges.length) await putGraphEdges(edges);
  }
}

function lessonFileFor(id) {
  // maps lesson id -> filename (Phase 1 lessons are named by topic, not id)
  const map = {
    'grammar-articles-01': 'grammar-articles.json',
    'grammar-possessives-01': 'grammar-possessives.json',
    'vocab-basic-01': 'vocab-basic.json'
  };
  return map[id] || `${id}.json`;
}

async function boot() {
  await openDB();
  await syncBundledLessons();
  await ensureGraphEdges();
  await indexAllLessons(); // index lessons currently in IndexedDB
  routerInit(document.getElementById('app'));
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

boot().catch(err => {
  console.error('Boot error', err);
  document.getElementById('app').textContent = 'Initialization error';
});