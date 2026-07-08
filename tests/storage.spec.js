import { openDB, putLesson, getLesson, listLessons, putGraphEdges, getGraphNeighbors } from '../js/storage.js';

async function assert(cond, msg) {
  const out = document.getElementById('out');
  const p = document.createElement('div');
  p.textContent = (cond ? 'PASS: ' : 'FAIL: ') + msg;
  p.style.color = cond ? 'green' : 'red';
  out.appendChild(p);
  if (!cond) throw new Error(msg);
}

(async () => {
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

  const done = document.createElement('div');
  done.textContent = 'Storage tests completed';
  done.style.marginTop = '12px';
  document.getElementById('out').appendChild(done);
})();
