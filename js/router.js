import { renderLessonList, renderLesson } from './renderer.js';

function mountRoot(root) {
  root.innerHTML = `
    <div class="header card">
      <div class="title">Deutsch Knowledge System</div>
      <div class="controls">
        <input id="searchInput" class="input" placeholder="Search…" aria-label="Search lessons" />
        <button id="btnHome" class="btn">Home</button>
        <a href="admin.html" class="btn" style="text-decoration:none;color:#fff">Admin</a>
      </div>
    </div>
    <div id="page"></div>
  `;
  document.getElementById('btnHome').addEventListener('click', () => { location.hash = ''; });
  const si = document.getElementById('searchInput');
  si.addEventListener('keydown', e => {
    if (e.key === 'Enter' && si.value.trim()) {
      location.hash = '#search=' + encodeURIComponent(si.value.trim());
    }
  });
}

export function routerInit(root) {
  mountRoot(root);
  window.addEventListener('hashchange', () => route(root));
  route(root);
}

async function route(root) {
  const page = root.querySelector('#page');
  page.innerHTML = '';
  const hash = location.hash.slice(1);

  if (!hash) {
    const list = await renderLessonList();
    page.appendChild(list);
  } else if (hash.startsWith('lesson=')) {
    const id = decodeURIComponent(hash.split('=')[1]);
    const node = await renderLesson(id);
    page.appendChild(node);
  } else if (hash.startsWith('search=')) {
    const q = decodeURIComponent(hash.split('=')[1]);
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div class="small">Search results for <strong>${escapeHtml(q)}</strong></div><div id="results" class="results"></div>`;
    page.appendChild(div);
    const { search } = await import('./search.js');
    const results = search(q);
    const resultsDiv = div.querySelector('#results');
    if (!results.length) resultsDiv.textContent = 'No results';
    results.forEach(r => {
      const el = document.createElement('div');
      el.className = 'block';
      el.innerHTML = `<a href="#lesson=${encodeURIComponent(r.lessonId)}">${escapeHtml(r.title)}</a> — <span class="small">${escapeHtml(r.snippet)}</span>`;
      resultsDiv.appendChild(el);
    });
  } else {
    page.innerHTML = '<div class="card">Unknown route</div>';
  }

  // Accessibility: move focus to the newly-rendered content after each navigation.
  page.setAttribute('tabindex', '-1');
  page.focus();
}

function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
