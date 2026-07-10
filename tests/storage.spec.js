import { openDB, putLesson, getLesson, listLessons, putGraphEdges, getGraphNeighbors, putProgress, getAllProgress } from '../js/storage.js';

async function assert(cond, msg) {
  const out = document.getElementById('out');
  const p = document.createElement('div');
  p.textContent = (cond ? 'PASS: ' : 'FAIL: ') + msg;
  p.style.color = cond ? 'green' : 'red';
  out.appendChild(p);
  if (!cond) throw new Error(msg);
}

export async function run() {
  await openDB();
  const sample = { id: 'test-lesson-1', title: 'Test Lesson', sections: [{ type: 'intro', text: 'Hello' }], version: '1.0' };
  await putLesson(sample);
  const got = await getLesson('test-lesson-1');
  await assert(got && got.id === 'test-lesson-1', 'put/get lesson');

  const list = await listLessons();
  await assert(Array.isArray(list), 'listLessons returns array');

  const edges = [{ from: 'test-lesson-1', to: 'other', type: 'related' }];
  await putGraphEdges(edges);
  const neigh = await getGraphNeighbors('test-lesson-1');
  await assert(Array.isArray(neigh) && neigh.length >= 1, 'graph neighbors');

  // Note: getLesson('non-existent') would otherwise try a network fallback fetch
  // to data/lessons/non-existent.json relative to this test page, which doesn't
  // exist under /tests/, so this correctly exercises the "not found" path too.
  const got2 = await getLesson('non-existent');
  await assert(got2 === null, 'getLesson returns null for missing lesson');

  // getAllProgress() should return every stored progress record, including
  // one written under a run-unique key so this doesn't collide with
  // leftover data from a previous run of this page.
  const progressTestKey = `test-progress-key-${Date.now()}`;
  await putProgress(progressTestKey, { attempts: 1 });
  const allProgress = await getAllProgress();
  const found = allProgress.find(p => p.key === progressTestKey);
  await assert(found && found.value && found.value.attempts === 1, 'getAllProgress includes a freshly written record');

  const done = document.createElement('div');
  done.textContent = 'Storage tests completed';
  done.style.marginTop = '12px';
  document.getElementById('out').appendChild(done);
}