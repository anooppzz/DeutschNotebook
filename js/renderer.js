import { getLesson, listLessons } from './storage.js';
import { renderExercise } from './quiz.js';

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
  root.className = 'card';
  const header = document.createElement('div');
  header.innerHTML = `<h2 class="lesson-title">${escapeHtml(lesson.title)}</h2><div class="meta small">${escapeHtml(lesson.level || '')} • ${lesson.estimatedTime || '?'} min</div>`;
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

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}