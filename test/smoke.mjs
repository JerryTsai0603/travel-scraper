import { matchesAllRequired } from '../src/filters/tags.js';
import { isChineseSubtitle } from '../src/filters/subtitle.js';

const tagCases = [
  { in: ['絲襪', '腳交', '高清'], expected: true },
  { in: ['stockings', 'footjob', '1080p'], expected: true },
  { in: ['絲襪', 'footjob'], expected: true },
  { in: ['stockings', '腳交'], expected: true },
  { in: ['絲襪', '高清'], expected: false },
  { in: ['腳交', '高清'], expected: false },
  { in: [], expected: false }
];

let pass = 0, fail = 0;
for (const c of tagCases) {
  const r = matchesAllRequired(c.in);
  const ok = r.ok === c.expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  tags=${JSON.stringify(c.in).padEnd(40)} expected=${c.expected} got=${r.ok}`);
  ok ? pass++ : fail++;
}

const subCases = [
  { in: { pageText: '本片含中文字幕', meta: {} }, expected: true },
  { in: { pageText: '', meta: { language: 'zh-Hant' } }, expected: true },
  { in: { pageText: 'Japanese only', meta: {} }, expected: false },
  { in: { subtitleTracks: [{ lang: 'zh-TW' }], pageText: '', meta: {} }, expected: true },
  { in: { subtitleTracks: [{ lang: 'en' }], pageText: 'no', meta: {} }, expected: false }
];
for (const c of subCases) {
  const r = isChineseSubtitle(c.in);
  const ok = r.ok === c.expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  subtitle input ok=${r.ok} (expected ${c.expected})`);
  ok ? pass++ : fail++;
}

console.log(`\nresult: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
