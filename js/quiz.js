// quiz.js - exercise registry + plugin API
import { recordAnswer } from './review.js';

const registry = {};

export function registerExercise(type, renderer) {
  registry[type] = renderer;
}

export async function renderExercise(exerciseId, lesson) {
  let exercise = null;
  try {
    const res = await fetch(`data/exercises/${exerciseId}.json`);
    if (res.ok) exercise = await res.json();
  } catch { /* ignore */ }

  if (!exercise) {
    const el = document.createElement('div');
    el.className = 'small';
    el.textContent = 'Exercise not found';
    return el;
  }
  const renderer = registry[exercise.type];
  if (!renderer) {
    const el = document.createElement('div');
    el.className = 'small';
    el.textContent = `Unsupported exercise type: ${exercise.type}`;
    return el;
  }
  return renderer(exercise);
}

/* Multiple choice */
registerExercise('multiple_choice', (exercise) => {
  const root = document.createElement('div');
  root.className = 'exercise';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', exercise.prompt || 'Multiple choice question');
  root.innerHTML = `<div class="small">${escapeHtml(exercise.prompt)}</div>`;
  const opts = document.createElement('div');
  opts.style.marginTop = '8px';
  exercise.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.marginRight = '8px';
    btn.textContent = opt;
    btn.setAttribute('data-index', i);
    btn.addEventListener('click', async () => {
      const correct = (i === exercise.answer);
      showFeedback(root, correct);
      await recordAnswer(exercise.id, correct);
    });
    opts.appendChild(btn);
  });
  root.appendChild(opts);
  return root;
});

/* Fill blank */
registerExercise('fill_blank', (exercise) => {
  const root = document.createElement('div');
  root.className = 'exercise';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', exercise.prompt || 'Fill in the blank');
  root.innerHTML = `<div class="small">${escapeHtml(exercise.prompt)}</div>`;
  const input = document.createElement('input');
  input.className = 'input';
  input.style.marginTop = '8px';
  input.setAttribute('aria-label', 'Answer input');
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.marginLeft = '8px';
  btn.textContent = 'Check';
  btn.addEventListener('click', async () => {
    const val = input.value.trim();
    const correct = String(exercise.answer).toLowerCase() === val.toLowerCase();
    showFeedback(root, correct);
    await recordAnswer(exercise.id, correct);
  });
  const row = document.createElement('div');
  row.style.marginTop = '8px';
  row.appendChild(input);
  row.appendChild(btn);
  root.appendChild(row);
  return root;
});

/* Drag and drop: exercise.payload = { items: [...], targets: [{label}], answers: [itemIndex,...] } */
registerExercise('drag_drop', (exercise) => {
  const root = document.createElement('div');
  root.className = 'exercise';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', exercise.prompt || 'Drag and drop exercise');
  root.innerHTML = `<div class="small">${escapeHtml(exercise.prompt)}</div>`;
  const itemsWrap = document.createElement('div');
  itemsWrap.style.display = 'flex';
  itemsWrap.style.gap = '8px';
  itemsWrap.style.marginTop = '8px';
  (exercise.payload.items || []).forEach((it, idx) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.draggable = true;
    el.textContent = it;
    el.dataset.item = idx;
    el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(idx)));
    itemsWrap.appendChild(el);
  });
  const targetsWrap = document.createElement('div');
  targetsWrap.style.display = 'flex';
  targetsWrap.style.gap = '8px';
  targetsWrap.style.marginTop = '8px';
  (exercise.payload.targets || []).forEach((t, i) => {
    const tEl = document.createElement('div');
    tEl.className = 'card';
    tEl.style.minWidth = '120px';
    tEl.textContent = t.label || 'Drop here';
    tEl.dataset.target = i;
    tEl.addEventListener('dragover', (e) => e.preventDefault());
    tEl.addEventListener('drop', (e) => {
      const idx = e.dataTransfer.getData('text/plain');
      tEl.textContent = exercise.payload.items[idx];
      tEl.dataset.assigned = idx;
    });
    targetsWrap.appendChild(tEl);
  });
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.marginTop = '8px';
  btn.textContent = 'Check';
  btn.addEventListener('click', async () => {
    const targets = Array.from(targetsWrap.children);
    let correct = true;
    targets.forEach((t, i) => {
      const assigned = t.dataset.assigned;
      if (String((exercise.payload.answers || [])[i]) !== String(assigned)) correct = false;
    });
    showFeedback(root, correct);
    await recordAnswer(exercise.id, correct);
  });
  root.appendChild(itemsWrap);
  root.appendChild(targetsWrap);
  root.appendChild(btn);
  return root;
});

/* Ordering: exercise.payload = { items: [...], answers: [orderedStrings] } */
registerExercise('ordering', (exercise) => {
  const root = document.createElement('div');
  root.className = 'exercise';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', exercise.prompt || 'Ordering exercise');
  root.innerHTML = `<div class="small">${escapeHtml(exercise.prompt)}</div>`;
  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.padding = '0';
  list.style.marginTop = '8px';

  function renderItems(items) {
    list.innerHTML = '';
    items.forEach((itm) => {
      const li = document.createElement('li');
      li.className = 'card';
      li.draggable = true;
      li.style.marginBottom = '6px';
      li.textContent = itm;
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', Array.from(list.children).indexOf(li));
      });
      li.addEventListener('dragover', (e) => e.preventDefault());
      li.addEventListener('drop', (e) => {
        const from = Number(e.dataTransfer.getData('text/plain'));
        const to = Array.from(list.children).indexOf(li);
        const current = Array.from(list.children).map(n => n.textContent);
        const [moved] = current.splice(from, 1);
        current.splice(to, 0, moved);
        renderItems(current);
      });
      list.appendChild(li);
    });
  }
  renderItems(exercise.payload.items || []);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.marginTop = '8px';
  btn.textContent = 'Check';
  btn.addEventListener('click', async () => {
    const items = Array.from(list.children).map(n => n.textContent);
    const correct = JSON.stringify(items) === JSON.stringify(exercise.payload.answers);
    showFeedback(root, correct);
    await recordAnswer(exercise.id, correct);
  });
  root.appendChild(list);
  root.appendChild(btn);
  return root;
});

/* Matching: exercise.payload = { left: [...], right: [...], answers: [rightIndexForEachLeft] } */
registerExercise('matching', (exercise) => {
  const root = document.createElement('div');
  root.className = 'exercise';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', exercise.prompt || 'Matching exercise');
  root.innerHTML = `<div class="small">${escapeHtml(exercise.prompt)}</div>`;
  const wrap = document.createElement('div');
  wrap.style.marginTop = '8px';
  const left = document.createElement('div');
  const right = document.createElement('div');
  left.style.display = right.style.display = 'inline-block';
  left.style.verticalAlign = right.style.verticalAlign = 'top';
  left.style.width = '45%';
  right.style.width = '45%';
  right.style.marginLeft = '4%';
  (exercise.payload.left || []).forEach((l, i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = l;
    el.dataset.left = i;
    left.appendChild(el);
  });
  (exercise.payload.right || []).forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.cursor = 'pointer';
    el.textContent = r;
    el.dataset.right = i;
    el.addEventListener('click', () => {
      const leftChildren = Array.from(left.children);
      const target = leftChildren.find(c => !c.dataset.match);
      if (target) {
        target.dataset.match = i;
        target.textContent = `${exercise.payload.left[target.dataset.left]} → ${r}`;
      }
    });
    right.appendChild(el);
  });
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.marginTop = '8px';
  btn.textContent = 'Check';
  btn.addEventListener('click', async () => {
    const leftChildren = Array.from(left.children);
    let correct = true;
    leftChildren.forEach((c, idx) => {
      if (String((exercise.payload.answers || [])[idx]) !== String(c.dataset.match)) correct = false;
    });
    showFeedback(root, correct);
    await recordAnswer(exercise.id, correct);
  });
  wrap.appendChild(left);
  wrap.appendChild(right);
  root.appendChild(wrap);
  root.appendChild(btn);
  return root;
});

/* Listening: play audio, answer a text question */
registerExercise('listening', (exercise) => {
  const root = document.createElement('div');
  root.className = 'exercise';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', exercise.prompt || 'Listening exercise');
  root.innerHTML = `<div class="small">${escapeHtml(exercise.prompt)}</div>`;
  if (exercise.audio) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = exercise.audio;
    audio.style.marginTop = '8px';
    audio.style.display = 'block';
    root.appendChild(audio);
  }
  const input = document.createElement('input');
  input.className = 'input';
  input.style.marginTop = '8px';
  input.setAttribute('aria-label', 'Answer input');
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.marginLeft = '8px';
  btn.textContent = 'Check';
  btn.addEventListener('click', async () => {
    const val = input.value.trim();
    const correct = String(exercise.answer).toLowerCase() === val.toLowerCase();
    showFeedback(root, correct);
    await recordAnswer(exercise.id, correct);
  });
  const row = document.createElement('div');
  row.style.marginTop = '8px';
  row.appendChild(input);
  row.appendChild(btn);
  root.appendChild(row);
  return root;
});

function showFeedback(root, correct) {
  let fb = root.querySelector('.fb');
  if (!fb) {
    fb = document.createElement('div');
    fb.className = 'fb small';
    fb.style.marginTop = '8px';
    fb.setAttribute('role', 'status');
    root.appendChild(fb);
  }
  fb.textContent = correct ? 'Correct ✓' : 'Incorrect ✗';
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Export registry for plugins/admin tooling */
export { registry as exerciseRegistry };