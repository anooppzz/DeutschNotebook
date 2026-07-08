import { getProgress } from './storage.js';

// Very small scheduler: return items with no progress or last older than 1 day
export async function dueItems() {
  // Demo: scan a small set of known exercise ids.
  // A future version should store the exercise list in IndexedDB and query it.
  const sample = ['ex-pos-01'];
  const due = [];
  for (const id of sample) {
    const p = await getProgress(`ex:${id}`);
    if (!p) due.push({ id, reason: 'new' });
    else if (Date.now() - (p.last || 0) > 24 * 3600 * 1000) due.push({ id, reason: 'review' });
  }
  return due;
}
