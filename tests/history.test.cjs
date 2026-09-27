const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../lib/history.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiled = { exports: {} };
new Function('exports', source)(compiled.exports);
const { parseHistory, mergeHistory, serializeHistory, inputsFromHash, inputsToHash } = compiled.exports;
const inputs = { name: 'Semester தமிழ் 🎓', previousCGPA: 8.25, subjects: [
  { name: 'Math & logic #1', credits: 3, grade: 'A+' }, { name: '', credits: 0, grade: '' },
] };
const entry = { ...inputs, id: 'one', savedAt: '2026-09-27T10:00:00.000Z', result: { sgpa: 9, cgpa: 8.63 } };
test('backup round trip preserves all inputs and results', () => {
  assert.deepEqual(parseHistory(JSON.parse(serializeHistory([entry]))), [entry]);
});
test('rejects unsupported versions and malformed history without partial imports', () => {
  for (const value of [null, {}, { version: 0, entries: [] }, { version: 1, entries: [entry, {}] },
    { version: 1, entries: [{ ...entry, savedAt: 'bad' }] },
    { version: 1, entries: [{ ...entry, result: { sgpa: null, cgpa: 9 } }] },
    { version: 1, entries: [{ ...entry, subjects: [{ name: 'Math', credits: '3', grade: 'A' }] }] },
    { version: 1, entries: [{ ...entry, subjects: [{ name: 'Math', credits: 3, grade: 'X' }] }] },
  ]) assert.throws(() => parseHistory(value));
});
test('merge skips duplicate IDs and keeps only the latest 20 by timestamp', () => {
  const entries = Array.from({ length: 25 }, (_, i) => ({ ...entry, id: String(i), savedAt: new Date(i * 1000).toISOString() }));
  const merged = mergeHistory(entries, [{ ...entries[24], name: 'duplicate' }]);
  assert.equal(merged.length, 20);
  assert.equal(merged[0].id, '24');
  assert.equal(merged[19].id, '5');
  assert.equal(merged[0].name, inputs.name);
});
test('share hash preserves Unicode and every calculator input', () => {
  assert.deepEqual(inputsFromHash(inputsToHash(inputs)), inputs);
  assert.equal(inputsFromHash('#unrelated'), null);
  assert.throws(() => inputsFromHash('#calculator=%invalid'));
  assert.throws(() => inputsFromHash('#calculator=' + encodeURIComponent('{"version":0}')));
});
