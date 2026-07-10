import Ajv from 'https://esm.sh/ajv@8';

async function assert(cond, msg) {
  const out = document.getElementById('out');
  const p = document.createElement('div');
  p.textContent = (cond ? 'PASS: ' : 'FAIL: ') + msg;
  p.style.color = cond ? 'green' : 'red';
  out.appendChild(p);
  if (!cond) throw new Error(msg);
}

export async function run() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const lessonSchema = await (await fetch('../schema/lesson.schema.json')).json();
  ajv.addSchema(lessonSchema, 'lesson');

  const validLesson = { id: 't1', title: 'T', level: 'A1', sections: [{ type: 'intro' }], version: '1.0' };
  const ok = ajv.validate('lesson', validLesson);
  await assert(ok, 'valid lesson passes schema');

  const bad = { id: 't2', title: 'T', sections: [], version: '1.0' }; // missing level
  const ok2 = ajv.validate('lesson', bad);
  await assert(!ok2, 'invalid lesson fails schema');

  const done = document.createElement('div');
  done.textContent = 'Validator tests completed';
  done.style.marginTop = '12px';
  document.getElementById('out').appendChild(done);
}