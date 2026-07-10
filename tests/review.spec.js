import { recordAnswer, nextInterval, dueItems } from '../js/review.js';
import { openDB, putLesson, getMistakeStats } from '../js/storage.js';

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

  // Every test id below is scoped to this run (Date.now()) so repeated runs
  // of this page never collide with leftover IndexedDB data from a previous
  // run — unlike a typical test framework, the browser's IndexedDB persists
  // across reloads, so fixed ids would accumulate stale state over time.
  const runId = Date.now();

  // Pure scheduling math
  await assert(nextInterval(null, true) === 1, 'first correct answer schedules a 1-day interval');
  await assert(nextInterval({ interval: 1 }, true) === 2, 'second correct answer doubles the interval');
  await assert(nextInterval({ interval: 8 }, false) === 1, 'a wrong answer resets the interval to 1 day');
  await assert(nextInterval({ interval: 40 }, true) === 60, 'interval is capped at 60 days');

  // recordAnswer persists a growing interval across repeated correct answers
  const testExerciseId = `test-review-ex-${runId}`;
  const r1 = await recordAnswer(testExerciseId, true);
  await assert(r1.interval === 1 && r1.attempts === 1, 'recordAnswer #1: interval 1, attempts 1');
  const r2 = await recordAnswer(testExerciseId, true);
  await assert(r2.interval === 2 && r2.attempts === 2, 'recordAnswer #2: interval doubles, attempts increments');
  const r3 = await recordAnswer(testExerciseId, false);
  await assert(r3.interval === 1 && r3.attempts === 3, 'recordAnswer #3 (wrong): interval resets, attempts still increments');

  // dueItems picks up a lesson's declared exercises that have never been attempted
  const sampleLesson = {
    id: `test-review-lesson-${runId}`,
    title: 'Review Test Lesson',
    version: '1.0',
    level: 'A1',
    sections: [],
    exercises: [`test-review-new-ex-${runId}`]
  };
  await putLesson(sampleLesson);
  const due = await dueItems();
  const found = due.find(d => d.id === `test-review-new-ex-${runId}`);
  await assert(found && found.reason === 'new', 'dueItems lists a never-attempted exercise as "new"');

  // Wrong answers tagged with a concept accumulate in the mistakes store
  const concept = `test-concept-feminine-endings-${runId}`;
  await recordAnswer(`test-mistake-ex-a-${runId}`, false, concept);
  await recordAnswer(`test-mistake-ex-b-${runId}`, false, concept);
  const stats = await getMistakeStats();
  const entry = stats.find(s => s.concept === concept);
  await assert(entry && entry.count === 2, 'mistakes accumulate across different exercises sharing a concept');

  const correctAnswerConcept = `test-concept-should-not-appear-${runId}`;
  await recordAnswer(`test-correct-ex-${runId}`, true, correctAnswerConcept);
  const statsAfterCorrect = await getMistakeStats();
  await assert(!statsAfterCorrect.find(s => s.concept === correctAnswerConcept), 'a correct answer does not record a mistake');

  const done = document.createElement('div');
  done.textContent = 'Review scheduler tests completed';
  done.style.marginTop = '12px';
  document.getElementById('out').appendChild(done);
})();