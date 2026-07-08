import { listLessons, getLesson } from './storage.js';

let index = []; // array of {lessonId, title, snippet, tokens}

export async function indexAllLessons() {
  index = [];
  const lessons = await listLessons();
  for (const l of lessons) {
    const lesson = await getLesson(l.id);
    if (!lesson) continue;
    const text = [
      lesson.title,
      ...(lesson.sections || []).map(s => s.text || ''),
      ...(lesson.vocabulary || []).map(v => v.word)
    ].join(' ');
    const tokens = tokenize(text);
    index.push({ lessonId: lesson.id, title: lesson.title, snippet: text.slice(0, 160), tokens });
  }
}

export function search(q) {
  const qTokens = tokenize(q);
  const results = [];
  for (const entry of index) {
    let score = 0;
    for (const t of qTokens) {
      if (entry.tokens.includes(t)) score += 1;
    }
    if (score > 0) results.push({ lessonId: entry.lessonId, title: entry.title, snippet: entry.snippet, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

function tokenize(s = '') {
  return s.toLowerCase().split(/\W+/).filter(Boolean);
}
