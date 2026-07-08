// import-ui.js
// Usage: import { mountImportUI } from './import-ui.js' and call mountImportUI(container)
import Ajv from 'https://esm.sh/ajv@8';
import { putLesson, indexLesson, putGraphEdges } from './storage.js';
import { indexAllLessons } from './search.js';

const ajv = new Ajv({ allErrors: true, strict: false });
let lessonSchema = null;
let exerciseSchema = null;

async function loadSchemas() {
  if (!lessonSchema) {
    lessonSchema = await (await fetch('schema/lesson.schema.json')).json();
    exerciseSchema = await (await fetch('schema/exercise.schema.json')).json();
    ajv.addSchema(lessonSchema, 'lesson');
    ajv.addSchema(exerciseSchema, 'exercise');
  }
}

function formatAjvErrors(errors) {
  if (!errors) return 'Unknown validation error';
  return errors.map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
}

export function mountImportUI(container) {
  const root = document.createElement('div');
  root.className = 'card';
  root.innerHTML = `
    <h3>Import Lesson</h3>
    <div class="small">Drop a lesson.json file or paste JSON below.</div>
    <div style="margin-top:8px;">
      <input id="fileInput" type="file" accept=".json" aria-label="Lesson JSON file" />
      <button id="btnPaste" class="btn" style="margin-left:8px">Focus paste area</button>
    </div>
    <textarea id="jsonArea" class="input" style="width:100%;height:160px;margin-top:8px" aria-label="Lesson JSON"></textarea>
    <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
      <button id="btnValidate" class="btn">Validate</button>
      <button id="btnImport" class="btn" disabled>Import</button>
      <div id="status" class="small" role="status"></div>
    </div>
    <div id="validationErrors" class="small" style="color:#b91c1c;margin-top:8px" role="alert"></div>
  `;
  container.appendChild(root);

  const fileInput = root.querySelector('#fileInput');
  const jsonArea = root.querySelector('#jsonArea');
  const btnValidate = root.querySelector('#btnValidate');
  const btnImport = root.querySelector('#btnImport');
  const status = root.querySelector('#status');
  const validationErrors = root.querySelector('#validationErrors');

  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    jsonArea.value = await f.text();
    validationErrors.textContent = '';
    btnImport.disabled = true;
  });

  root.querySelector('#btnPaste').addEventListener('click', () => jsonArea.focus());

  btnValidate.addEventListener('click', async () => {
    validationErrors.textContent = '';
    status.textContent = 'Validating…';
    try {
      await loadSchemas();
      const parsed = JSON.parse(jsonArea.value);
      const valid = ajv.validate('lesson', parsed);
      if (!valid) {
        validationErrors.textContent = formatAjvErrors(ajv.errors);
        status.textContent = 'Validation failed';
        btnImport.disabled = true;
        return;
      }
      if (parsed.exercises && parsed.exercises.length) {
        for (const exId of parsed.exercises) {
          if (typeof exId === 'object') {
            const ok = ajv.validate('exercise', exId);
            if (!ok) {
              validationErrors.textContent = `Exercise validation failed: ${formatAjvErrors(ajv.errors)}`;
              status.textContent = 'Validation failed';
              btnImport.disabled = true;
              return;
            }
          } else {
            try {
              const res = await fetch(`data/exercises/${exId}.json`);
              if (res.ok) {
                const exJson = await res.json();
                const ok = ajv.validate('exercise', exJson);
                if (!ok) {
                  validationErrors.textContent = `Exercise ${exId} invalid: ${formatAjvErrors(ajv.errors)}`;
                  status.textContent = 'Validation failed';
                  btnImport.disabled = true;
                  return;
                }
              }
            } catch { /* missing external exercise: allow import, warn skipped */ }
          }
        }
      }
      status.textContent = 'Valid';
      btnImport.disabled = false;
    } catch (err) {
      validationErrors.textContent = 'JSON parse error: ' + err.message;
      status.textContent = 'Validation error';
      btnImport.disabled = true;
    }
  });

  btnImport.addEventListener('click', async () => {
    validationErrors.textContent = '';
    status.textContent = 'Importing…';
    try {
      const parsed = JSON.parse(jsonArea.value);
      // Note: this stores into the browser's IndexedDB only. It does not write a
      // file back into data/lessons/ on disk (that would need a backend endpoint).
      await putLesson(parsed);
      await indexLesson(parsed);
      const edges = [];
      (parsed.dependsOn || []).forEach(dep => edges.push({ from: parsed.id, to: dep, type: 'dependsOn' }));
      (parsed.related || []).forEach(rel => edges.push({ from: parsed.id, to: rel, type: 'related' }));
      if (edges.length) await putGraphEdges(edges);
      await indexAllLessons();
      status.textContent = 'Imported';
      btnImport.disabled = true;
    } catch (err) {
      validationErrors.textContent = 'Import error: ' + err.message;
      status.textContent = 'Import failed';
    }
  });
}
