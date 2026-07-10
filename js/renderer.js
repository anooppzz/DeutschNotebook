import { getLesson, listLessons, getMistakeStats, putProgress, getProgress, getAllProgress } from './storage.js';
import { renderExercise } from './quiz.js';
import { dueItems } from './review.js';

export async function renderLessonList() {
  const container = document.createElement('div');
  container.className = 'card';
  const lessons = await listLessons();
  if (!lessons.length) {
    container.innerHTML = '<div class="small">No lessons found yet.</div>';
    return container;
  }
  lessons.forEach(l => {
    const el = document.createElement('div');
    el.className = 'block';
    el.innerHTML = `<div class="lesson-title"><a href="#lesson=${encodeURIComponent(l.id)}">${escapeHtml(l.title)}</a></div>
      <div class="meta small">${escapeHtml(l.level || '')} • ${l.tags ? l.tags.map(escapeHtml).join(', ') : ''}</div>`;
    container.appendChild(el);
  });
  return container;
}

export async function renderLesson(id) {
  const lesson = await getLesson(id);
  const root = document.createElement('div');
  if (!lesson) {
    root.className = 'card';
    root.textContent = 'Lesson not found';
    return root;
  }

  // Record this as the most recently opened lesson, for the Dashboard's
  // "Continue Learning" card. Stored under the progress store using a
  // non-"ex:"-prefixed key so it doesn't get counted as an exercise by
  // getAllProgress()-based stats elsewhere.
  await putProgress('meta:lastOpened', { lessonId: id, timestamp: Date.now() });

  root.className = 'card';
  const header = document.createElement('div');
  header.innerHTML = `<h2 class="lesson-title">${escapeHtml(lesson.title)}</h2>
    <div class="meta small">${escapeHtml(lesson.level || '')} • ${lesson.estimatedTime || '?'} min
      • <a href="#lessonReview=${encodeURIComponent(lesson.id)}">Review this lesson</a></div>`;
  root.appendChild(header);

  for (const section of lesson.sections || []) {
    const block = document.createElement('div');
    block.className = 'block';
    if (section.type === 'intro' || section.type === 'grammar') {
      if (section.title) block.innerHTML += `<h3>${escapeHtml(section.title)}</h3>`;
      if (section.text) block.innerHTML += `<div>${escapeHtml(section.text)}</div>`;
    } else if (section.type === 'examples') {
      block.innerHTML += `<h3>Examples</h3>`;
      (section.examples || []).forEach(ex => {
        const exEl = document.createElement('div');
        exEl.className = 'example';
        exEl.innerHTML = `<div>${escapeHtml(ex.text)}</div><div class="small">${escapeHtml(ex.translation || '')}</div>`;
        if (ex.audio) {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = ex.audio;
          exEl.appendChild(audio);
        }
        block.appendChild(exEl);
      });
    } else if (section.type === 'exercise') {
      block.innerHTML += `<h3>Exercise</h3>`;
      const exNode = await renderExercise(section.exerciseId, lesson);
      block.appendChild(exNode);
    } else if (section.type === 'checkpoint') {
      // A quick retrieval-practice question interleaved between grammar/
      // examples sections, rather than saved for one big exercise block at
      // the end of the lesson. Reuses the same exercise engine as a full
      // "Exercise" section — only the heading differs, to signal it's a
      // quick check rather than the lesson's main exercise.
      block.innerHTML += `<h3>Quick check</h3>`;
      const cpNode = await renderExercise(section.exerciseId, lesson);
      block.appendChild(cpNode);
    } else {
      // generic
      if (section.title) block.innerHTML += `<h3>${escapeHtml(section.title)}</h3>`;
      if (section.text) block.innerHTML += `<div>${escapeHtml(section.text)}</div>`;
    }
    root.appendChild(block);
  }

  // vocabulary (a lesson-level array, not a "section" — was collected for search
  // indexing but never actually rendered onto the page; adding that here)
  if (lesson.vocabulary && lesson.vocabulary.length) {
    const vocabBlock = document.createElement('div');
    vocabBlock.className = 'block';
    vocabBlock.innerHTML = '<h3>Vocabulary</h3>';
    lesson.vocabulary.forEach(v => {
      const vEl = document.createElement('div');
      vEl.className = 'example';
      const articleWord = v.article ? `${escapeHtml(v.article)} ${escapeHtml(v.word)}` : escapeHtml(v.word);
      vEl.innerHTML = `<div><strong>${articleWord}</strong></div>` +
        (v.plural ? `<div class="small">Plural: ${escapeHtml(v.plural)}</div>` : '');
      if (v.audio) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = v.audio;
        vEl.appendChild(audio);
      }
      vocabBlock.appendChild(vEl);
    });
    root.appendChild(vocabBlock);
  }

  // related
  if (lesson.related && lesson.related.length) {
    const rel = document.createElement('div');
    rel.className = 'block small';
    rel.innerHTML = `<strong>Related:</strong> ${lesson.related.map(r => `<a href="#lesson=${encodeURIComponent(r)}">${escapeHtml(r)}</a>`).join(', ')}`;
    root.appendChild(rel);
  }

  return root;
}

// Condensed per-lesson review view: a one-line rule, a single example, then
// straight into that lesson's own exercises — no full intro/grammar prose,
// no vocabulary block, no related links. This is the per-lesson counterpart
// to the site-wide #review page (which pools due exercises across every
// lesson); this one is reached via "Review this lesson" on the full lesson
// page, for someone who wants a quick refresher on one specific topic.
export async function renderLessonReview(id) {
  const lesson = await getLesson(id);
  const root = document.createElement('div');
  if (!lesson) {
    root.className = 'card';
    root.textContent = 'Lesson not found';
    return root;
  }
  root.className = 'card';
  const header = document.createElement('div');
  header.innerHTML = `<h2 class="lesson-title">${escapeHtml(lesson.title)} — Review</h2>
    <div class="meta small"><a href="#lesson=${encodeURIComponent(lesson.id)}">Full lesson</a></div>`;
  root.appendChild(header);

  const ruleSection = (lesson.sections || []).find(s => (s.type === 'intro' || s.type === 'grammar') && s.text);
  if (ruleSection) {
    const ruleEl = document.createElement('div');
    ruleEl.className = 'block';
    ruleEl.innerHTML = `<div>${escapeHtml(ruleSection.text)}</div>`;
    root.appendChild(ruleEl);
  }

  const examplesSection = (lesson.sections || []).find(s => s.type === 'examples' && s.examples && s.examples.length);
  if (examplesSection) {
    const ex = examplesSection.examples[0];
    const exEl = document.createElement('div');
    exEl.className = 'example';
    exEl.innerHTML = `<div>${escapeHtml(ex.text)}</div><div class="small">${escapeHtml(ex.translation || '')}</div>`;
    root.appendChild(exEl);
  }

  const exerciseIds = lesson.exercises || [];
  if (!exerciseIds.length) {
    const none = document.createElement('div');
    none.className = 'block small';
    none.textContent = 'No exercises yet for this lesson.';
    root.appendChild(none);
  } else {
    for (const exId of exerciseIds) {
      const block = document.createElement('div');
      block.className = 'block';
      const exNode = await renderExercise(exId, lesson);
      block.appendChild(exNode);
      root.appendChild(block);
    }
  }

  return root;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function renderReviewMode() {
  const root = document.createElement('div');

  const header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = '<h2 class="lesson-title">Review</h2>';
  root.appendChild(header);

  // Weak-concept summary, from the mistake-pattern tracking in storage.js.
  // Only shown once at least one mistake has been recorded anywhere.
  const mistakes = await getMistakeStats();
  if (mistakes.length) {
    const mBlock = document.createElement('div');
    mBlock.className = 'card';
    mBlock.innerHTML = '<h3>Often missed</h3>';
    mistakes.slice(0, 5).forEach(m => {
      const line = document.createElement('div');
      line.className = 'block small';
      line.textContent = `${m.concept} — missed ${m.count} time${m.count === 1 ? '' : 's'}`;
      mBlock.appendChild(line);
    });
    root.appendChild(mBlock);
  }

  // Due exercises: new (never attempted) or past their scheduled review date.
  const due = await dueItems();
  const dueBlock = document.createElement('div');
  dueBlock.className = 'card';
  if (!due.length) {
    dueBlock.innerHTML = '<div class="small">Nothing due for review right now. Come back later, or open a lesson from Home to learn something new.</div>';
    root.appendChild(dueBlock);
    return root;
  }
  dueBlock.innerHTML = `<div class="small">${due.length} exercise${due.length === 1 ? '' : 's'} due (${due.filter(d => d.reason === 'new').length} new, ${due.filter(d => d.reason === 'review').length} to review).</div>`;
  root.appendChild(dueBlock);

  for (const item of due) {
    const wrap = document.createElement('div');
    wrap.className = 'block';
    const label = document.createElement('div');
    label.className = 'small';
    label.style.marginBottom = '4px';
    label.textContent = item.reason === 'new' ? 'New' : 'Review';
    wrap.appendChild(label);
    const exNode = await renderExercise(item.id, null);
    wrap.appendChild(exNode);
    root.appendChild(wrap);
  }

  return root;
}

// Dashboard: shown at the top of Home, above the lesson list. Surfaces data
// that Tier 1 already computes (due count, weak concepts) plus a pointer to
// the most recently opened lesson and a small stats strip, rather than
// requiring a separate page visit to see any of it.
export async function renderDashboard() {
  const root = document.createElement('div');

  const lastOpened = await getProgress('meta:lastOpened');
  if (lastOpened && lastOpened.lessonId) {
    const lesson = await getLesson(lastOpened.lessonId);
    if (lesson) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h3>Continue Learning</h3>
        <div class="block"><a href="#lesson=${encodeURIComponent(lesson.id)}">${escapeHtml(lesson.title)}</a></div>`;
      root.appendChild(card);
    }
  }

  const due = await dueItems();
  const reviewCard = document.createElement('div');
  reviewCard.className = 'card';
  reviewCard.innerHTML = `<h3>Today's Review</h3>
    <div class="block small">${due.length} exercise${due.length === 1 ? '' : 's'} due — <a href="#review">Go to Review</a></div>`;
  root.appendChild(reviewCard);

  const mistakes = await getMistakeStats();
  if (mistakes.length) {
    const mCard = document.createElement('div');
    mCard.className = 'card';
    mCard.innerHTML = '<h3>Often Missed</h3>';
    mistakes.slice(0, 3).forEach(m => {
      const line = document.createElement('div');
      line.className = 'block small';
      line.textContent = `${m.concept} — missed ${m.count} time${m.count === 1 ? '' : 's'}`;
      mCard.appendChild(line);
    });
    root.appendChild(mCard);
  }

  const lessons = await listLessons();
  const allProgress = await getAllProgress();
  const exercisesAttempted = allProgress.filter(p => p.key && p.key.startsWith('ex:')).length;
  const statsCard = document.createElement('div');
  statsCard.className = 'card';
  statsCard.innerHTML = `<h3>Stats</h3>
    <div class="block small">${lessons.length} lesson${lessons.length === 1 ? '' : 's'} • ${exercisesAttempted} exercise${exercisesAttempted === 1 ? '' : 's'} attempted</div>`;
  root.appendChild(statsCard);

  return root;
}