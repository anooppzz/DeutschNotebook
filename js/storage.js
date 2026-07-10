// storage.js - full implementation
let DB_NAME = 'dks-db';
const DB_VERSION = 3;
let db = null;

/* Switches all subsequent storage calls to an isolated test database
   instead of the real 'dks-db' the live app uses. Must be called before
   openDB() (or anything that triggers it) runs for the first time on a
   given page — the intended caller is tests/run-tests.html, once, before
   any spec's run() executes. This exists because tests were previously
   writing fake lessons/progress/mistakes directly into the same database
   real users' data lives in, which showed up as fake entries polluting the
   live Dashboard, lesson list, and Review page. */
export function useTestDatabase() {
  DB_NAME = 'dks-db-test';
  db = null;
}

export function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains('lessons')) idb.createObjectStore('lessons', { keyPath: 'id' });
      if (!idb.objectStoreNames.contains('exercises')) idb.createObjectStore('exercises', { keyPath: 'id' });
      if (!idb.objectStoreNames.contains('progress')) idb.createObjectStore('progress', { keyPath: 'key' });
      if (!idb.objectStoreNames.contains('graph')) idb.createObjectStore('graph', { keyPath: 'id' });
      if (!idb.objectStoreNames.contains('index')) idb.createObjectStore('index', { keyPath: 'key' });
      if (!idb.objectStoreNames.contains('mistakes')) idb.createObjectStore('mistakes', { keyPath: 'concept' });
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  const t = db.transaction(storeName, mode);
  return t.objectStore(storeName);
}

export async function putLesson(lesson) {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('lessons', 'readwrite');
    const req = store.put(lesson);
    req.onsuccess = () => resolve(true);
    req.onerror = e => reject(e.target.error);
  });
}

export async function getLesson(id) {
  await openDB();
  return new Promise((resolve) => {
    const store = tx('lessons');
    const req = store.get(id);
    req.onsuccess = async () => {
      if (req.result) return resolve(req.result);
      // fallback: try to fetch from data/lessons/{id}.json
      try {
        const res = await fetch(`data/lessons/${id}.json`);
        if (!res.ok) return resolve(null);
        const json = await res.json();
        putLesson(json).catch(() => {});
        resolve(json);
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

export async function listLessons() {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('lessons');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e.target.error);
  });
}

export async function putExercise(ex) {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('exercises', 'readwrite');
    const req = store.put(ex);
    req.onsuccess = () => resolve(true);
    req.onerror = e => reject(e.target.error);
  });
}

export async function getExercise(id) {
  await openDB();
  return new Promise((resolve) => {
    const store = tx('exercises');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function putProgress(key, value) {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('progress', 'readwrite');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = e => reject(e.target.error);
  });
}

export async function getProgress(key) {
  await openDB();
  return new Promise((resolve) => {
    const store = tx('progress');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}

/* Returns every stored progress record, as {key, value} pairs. Used for
   dashboard-level aggregation (e.g. counting exercises attempted) where a
   single-key lookup via getProgress() isn't enough. */
export async function getAllProgress() {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('progress');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e.target.error);
  });
}

/* Graph store helpers */
export async function putGraphEdges(edges) {
  // edges: [{from,to,type}]
  await openDB();
  return new Promise((resolve, reject) => {
    if (!edges.length) return resolve(true);
    const store = tx('graph', 'readwrite');
    let count = 0;
    let failed = false;
    edges.forEach(edge => {
      const id = `${edge.from}::${edge.to}::${edge.type}`;
      const req = store.put({ id, ...edge });
      req.onsuccess = () => {
        count++;
        if (count === edges.length && !failed) resolve(true);
      };
      req.onerror = e => {
        failed = true;
        reject(e.target.error);
      };
    });
  });
}

export async function getGraphNeighbors(nodeId) {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('graph');
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const neighbors = all.filter(e => e.from === nodeId || e.to === nodeId);
      resolve(neighbors);
    };
    req.onerror = e => reject(e.target.error);
  });
}

/* Returns every edge in the graph store, unfiltered. Used by the knowledge
   graph visualization, which needs the whole graph at once rather than one
   node's neighbors. */
export async function getAllGraphEdges() {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('graph');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e.target.error);
  });
}

/* Index store helpers (persistent token index, separate from search.js's in-memory index) */
export async function indexLesson(lesson) {
  await openDB();
  const key = `lesson::${lesson.id}`;
  const text = [
    lesson.title,
    ...(lesson.sections || []).map(s => s.text || ''),
    ...(lesson.vocabulary || []).map(v => v.word)
  ].join(' ');
  const tokens = tokenize(text);
  return new Promise((resolve, reject) => {
    const store = tx('index', 'readwrite');
    const req = store.put({ key, lessonId: lesson.id, tokens, snippet: text.slice(0, 160) });
    req.onsuccess = () => resolve(true);
    req.onerror = e => reject(e.target.error);
  });
}

export async function getIndexEntries() {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('index');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e.target.error);
  });
}

function tokenize(s = '') {
  return s.toLowerCase().split(/\W+/).filter(Boolean);
}

/* Mistake pattern tracking: one running counter per concept, incremented
   each time a wrong answer is tagged with that concept. This is separate
   from per-exercise progress (which tracks a single exercise's own history)
   — this aggregates across every exercise sharing a concept, so recurring
   weak spots ("feminine endings") surface even when the mistakes happen on
   different individual questions. */
export async function incrementMistake(concept) {
  if (!concept) return null;
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('mistakes', 'readwrite');
    const getReq = store.get(concept);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      const record = {
        concept,
        count: (existing ? existing.count : 0) + 1,
        lastMissed: Date.now()
      };
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = e => reject(e.target.error);
    };
    getReq.onerror = e => reject(e.target.error);
  });
}

export async function getMistakeStats() {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx('mistakes');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.count - a.count));
    req.onerror = e => reject(e.target.error);
  });
}

/* Utility: bulk import lessons from the data/lessons folder (used for initial seeding) */
export async function importAllLessonsFromDataFolder() {
  try {
    const manifestRes = await fetch('data/lessons/manifest.json');
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      for (const p of manifest.files) {
        const res = await fetch(`data/lessons/${p}`);
        if (res.ok) {
          const lesson = await res.json();
          await putLesson(lesson);
          await indexLesson(lesson);
        }
      }
    } else {
      const sample = ['grammar-possessives.json', 'grammar-articles.json', 'vocab-basic.json'];
      for (const f of sample) {
        try {
          const res = await fetch(`data/lessons/${f}`);
          if (res.ok) {
            const lesson = await res.json();
            await putLesson(lesson);
            await indexLesson(lesson);
          }
        } catch { /* ignore */ }
      }
    }
    return true;
  } catch {
    return false;
  }
}