// admin.js
import Ajv from 'https://esm.sh/ajv@8';
import { putLesson, indexLesson, putGraphEdges } from './storage.js';
import { indexAllLessons } from './search.js';

const ajv = new Ajv({ allErrors: true, strict: false });
let lessonSchema = null;

async function loadSchema() {
  if (!lessonSchema) {
    lessonSchema = await (await fetch('schema/lesson.schema.json')).json();
    ajv.addSchema(lessonSchema, 'lesson');
  }
}

export async function mountAdmin(root) {
  await loadSchema();
  root.innerHTML = `
    <div class="card">
      <h3>AI Drafts</h3>
      <div id="draftList" class="small">Loading drafts…</div>
      <div id="preview" style="margin-top:12px"></div>
    </div>
  `;
  const draftList = root.querySelector('#draftList');
  const preview = root.querySelector('#preview');

  // Load drafts from data/drafts/manifest.json, falling back to known sample names.
  let drafts = [];
  try {
    const res = await fetch('data/drafts/manifest.json');
    if (res.ok) {
      drafts = await res.json();
    } else {
      const sample = ['ai-possessives.json', 'ai-articles.json', 'ai-vocab.json'];
      for (const s of sample) {
        try {
          const r = await fetch(`data/drafts/${s}`);
          if (r.ok) drafts.push({ file: s });
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }

  if (!drafts.length) {
    draftList.textContent = 'No drafts found in data/drafts/.';
    return;
  }
  draftList.innerHTML = '';
  for (const d of drafts) {
    const fileName = d.file || d;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.marginRight = '8px';
    btn.textContent = fileName;
    btn.addEventListener('click', async () => {
      preview.innerHTML = 'Loading…';
      const res = await fetch(`data/drafts/${fileName}`);
      const json = await res.json();
      const valid = ajv.validate('lesson', json);
      preview.innerHTML = `<h4>${escapeHtml(json.title || json.id)}</h4>
        <div class="small" role="status">Validation: ${valid ? 'OK' : 'Invalid'}</div>
        <pre style="white-space:pre-wrap;background:#fff;padding:8px;border-radius:8px">${escapeHtml(JSON.stringify(json, null, 2))}</pre>
        <div style="margin-top:8px"><button id="accept" class="btn">Accept</button> <button id="edit" class="btn">Edit</button></div>`;
      preview.querySelector('#accept').addEventListener('click', async () => {
        if (!valid) {
          alert('Draft invalid. Fix before accepting.');
          return;
        }
        await putLesson(json);
        await indexLesson(json);
        const edges = [];
        (json.dependsOn || []).forEach(dep => edges.push({ from: json.id, to: dep, type: 'dependsOn' }));
        (json.related || []).forEach(rel => edges.push({ from: json.id, to: rel, type: 'related' }));
        if (edges.length) await putGraphEdges(edges);
        await indexAllLessons();
        alert('Draft accepted and indexed.');
      });
      preview.querySelector('#edit').addEventListener('click', () => {
        preview.innerHTML += `<div style="margin-top:8px"><textarea id="editor" style="width:100%;height:240px" aria-label="Edit draft JSON">${escapeHtml(JSON.stringify(json, null, 2))}</textarea>
          <div style="margin-top:8px"><button id="saveEdit" class="btn">Save Edits</button></div></div>`;
        preview.querySelector('#saveEdit').addEventListener('click', async () => {
          try {
            const edited = JSON.parse(preview.querySelector('#editor').value);
            const ok = ajv.validate('lesson', edited);
            if (!ok) {
              alert('Edited JSON invalid: ' + ajv.errors.map(e => e.message).join('; '));
              return;
            }
            await putLesson(edited);
            await indexLesson(edited);
            alert('Edited draft saved and indexed.');
          } catch (err) {
            alert('JSON parse error: ' + err.message);
          }
        });
      });
    });
    draftList.appendChild(btn);
  }
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
