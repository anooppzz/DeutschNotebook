import { openDB, putLesson, listLessons, putGraphEdges } from './storage.js';
import { routerInit } from './router.js';
import { indexAllLessons } from './search.js';

const BUNDLED_LESSONS = [
  'grammar-articles-01',
  'grammar-possessives-01',
  'vocab-basic-01'
];

async function seedLessonsIfEmpty() {
  const existing = await listLessons();
  if (existing.length > 0) return;
  for (const id of BUNDLED_LESSONS) {
    try {
      const res = await fetch(`data/lessons/${lessonFileFor(id)}`);
      if (!res.ok) continue;
      const json = await res.json();
      await putLesson(json);

      // Bundled lessons' dependsOn/related arrays were previously only
      // written into the graph store when a lesson was imported through
      // the Admin UI (import-ui.js / admin.js) — bundled seeding here never
      // did the same, so the knowledge graph store stayed empty for the
      // lessons most people would actually see first. Mirroring that same
      // edge-building logic here so seeded lessons show up in the graph too.
      const edges = [];
      (json.dependsOn || []).forEach(dep => edges.push({ from: json.id, to: dep, type: 'dependsOn' }));
      (json.related || []).forEach(rel => edges.push({ from: json.id, to: rel, type: 'related' }));
      if (edges.length) await putGraphEdges(edges);
    } catch (err) {
      console.warn('Could not seed lesson', id, err);
    }
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
  await seedLessonsIfEmpty();
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