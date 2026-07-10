import { recordAnswer, nextInterval, dueItems } from '../js/review.js';
import { openDB, putLesson } from '../js/storage.js';

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

  // Pure scheduling math
  await assert(nextInterval(null, true) === 1, 'first correct answer schedules a 1-day interval');
  await assert(nextInterval({ interval: 1 }, true) === 2, 'second correct answer doubles the interval');
  await assert(nextInterval({ interval: 8 }, false) === 1, 'a wrong answer resets the interval to 1 day');
  await assert(nextInterval({ interval: 40 }, true) === 60, 'interval is capped at 60 days');

  // recordAnswer persists a growing interval across repeated correct answers
  const testExerciseId = 'test-review-ex-1';
  const r1 = await recordAnswer(testExerciseId, true);
  await assert(r1.interval === 1 && r1.attempts === 1, 'recordAnswer #1: interval 1, attempts 1');
  const r2 = await recordAnswer(testExerciseId, true);
  await assert(r2.interval === 2 && r2.attempts === 2, 'recordAnswer #2: interval doubles, attempts increments');
  const r3 = await recordAnswer(testExerciseId, false);
  await assert(r3.interval === 1 && r3.attempts === 3, 'recordAnswer #3 (wrong): interval resets, attempts still increments');

  // dueItems picks up a lesson's declared exercises that have never been attempted
  const sampleLesson = {
    id: 'test-review-lesson-1',
    title: 'Review Test Lesson',
    version: '1.0',
    level: 'A1',
    sections: [],
    exercises: ['test-review-new-ex']
  };
  await putLesson(sampleLesson);
  const due = await dueItems();
  const found = due.find(d => d.id === 'test-review-new-ex');
  await assert(found && found.reason === 'new', 'dueItems lists a never-attempted exercise as "new"');

  const done = document.createElement('div');
  done.textContent = 'Review scheduler tests completed';
  done.style.marginTop = '12px';
  document.getElementById('out').appendChild(done);
})();