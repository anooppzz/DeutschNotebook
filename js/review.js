import { getProgress, putProgress, listLessons, incrementMistake } from './storage.js';

const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Very small SM-2-lite spaced repetition rule:
 * - Any incorrect answer resets the interval to 1 day (start over).
 * - The first correct answer schedules a review in 1 day.
 * - Each subsequent correct answer doubles the interval, capped at
 *   MAX_INTERVAL_DAYS, so well-known items get reviewed less and less often.
 * Pure function (no I/O) so it's trivially testable on its own.
 */
export function nextInterval(existing, correct) {
  const prevInterval = existing && existing.interval ? existing.interval : 0;
  if (!correct) return MIN_INTERVAL_DAYS;
  if (prevInterval <= 0) return MIN_INTERVAL_DAYS;
  return Math.min(prevInterval * 2, MAX_INTERVAL_DAYS);
}

/**
 * Called by quiz.js whenever an exercise is answered. Reads the exercise's
 * existing progress record, computes the next spaced-repetition interval
 * and due date, and persists the updated record. Replaces the old
 * quiz.js behavior of overwriting progress with a fresh {attempts:1, ...}
 * on every answer (which never actually accumulated attempts or scheduled
 * anything).
 */
export async function recordAnswer(exerciseId, correct, concept) {
  const key = `ex:${exerciseId}`;
  const existing = await getProgress(key);
  const attempts = (existing && existing.attempts ? existing.attempts : 0) + 1;
  const interval = nextInterval(existing, correct);
  const now = Date.now();
  const record = {
    attempts,
    correct,
    last: now,
    interval,
    dueDate: now + interval * DAY_MS
  };
  await putProgress(key, record);
  if (!correct && concept) {
    await incrementMistake(concept);
  }
  return record;
}

/**
 * Returns every exercise that's due for review right now: either never
 * attempted ("new") or past its scheduled dueDate ("review"). Exercise IDs
 * are gathered from each lesson's own `exercises` array rather than a
 * hardcoded sample list, so this automatically covers every lesson in the
 * database, including ones imported later via the Admin UI.
 */
export async function dueItems() {
  const lessons = await listLessons();
  const exerciseIds = new Set();
  lessons.forEach(l => (l.exercises || []).forEach(id => exerciseIds.add(id)));

  const now = Date.now();
  const due = [];
  for (const id of exerciseIds) {
    const p = await getProgress(`ex:${id}`);
    if (!p) {
      due.push({ id, reason: 'new' });
    } else if (typeof p.dueDate === 'number' && p.dueDate <= now) {
      due.push({ id, reason: 'review', dueDate: p.dueDate });
    }
  }
  return due;
}