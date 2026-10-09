import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import config from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../', config.output.dir);

mkdirSync(dataDir, { recursive: true });

function dateStamp(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function jsonPath(date) {
  return resolve(dataDir, `results-${date}.json`);
}

function markdownPath(date) {
  return resolve(dataDir, `results-${date}.md`);
}

function statePath() {
  return resolve(dataDir, 'state.json');
}

export function loadSeen() {
  if (!existsSync(statePath())) return new Set();
  try {
    const raw = JSON.parse(readFileSync(statePath(), 'utf8'));
    return new Set(Array.isArray(raw.seen) ? raw.seen : []);
  } catch {
    return new Set();
  }
}

export function saveSeen(seenSet) {
  // No cap: keep all seen URLs so dedup notifications never re-fire.
  writeFileSync(statePath(), JSON.stringify({
    updatedAt: new Date().toISOString(),
    seen: Array.from(seenSet)
  }, null, 2));
}

export function writeResults(results, { date = dateStamp() } = {}) {
  const payload = {
    generatedAt: new Date().toISOString(),
    date,
    count: results.length,
    results
  };

  if (config.output.writeJson) {
    writeFileSync(jsonPath(date), JSON.stringify(payload, null, 2), 'utf8');
  }
  if (config.output.writeMarkdown) {
    writeFileSync(markdownPath(date), renderMarkdown(payload), 'utf8');
  }

  return { jsonPath: jsonPath(date), markdownPath: markdownPath(date) };
}

function renderMarkdown(payload) {
  const { date, count, results, generatedAt } = payload;
  const lines = [];
  lines.push(`# 每日結果 — ${date}`);
  lines.push('');
  lines.push(`- 生成時間：${generatedAt}`);
  lines.push(`- 命中影片數：**${count}**`);
  lines.push(`- 篩選條件：絲襪 + 腳交 + 中文字幕`);
  lines.push('');

  if (!count) {
    lines.push('_本次未命中任何影片。_');
    return lines.join('\n');
  }

  const bySite = new Map();
  for (const r of results) {
    if (!bySite.has(r.site)) bySite.set(r.site, []);
    bySite.get(r.site).push(r);
  }

  for (const [site, list] of bySite.entries()) {
    lines.push(`## ${site} (${list.length})`);
    lines.push('');
    for (const item of list) {
      lines.push(`### [${item.title}](${item.url})`);
      lines.push('');
      lines.push(`- 站點：${item.site}`);
      lines.push(`- 發佈：${item.publishedAt || '未知'}`);
      lines.push(`- 時長：${item.duration || '未知'}`);
      lines.push(`- 字幕：${item.subtitleEvidence || '未標示'}`);
      lines.push(`- 命中標籤：${item.matchedTags.join('、')}`);
      if (item.performers && item.performers.length) {
        lines.push(`- 演員：${item.performers.join('、')}`);
      }
      if (item.thumbnail) lines.push(`- 縮圖：${item.thumbnail}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function appendToLatest(results, { maxKeep = 30 } = {}) {
  const indexPath = resolve(dataDir, 'index.json');
  let history = [];
  if (existsSync(indexPath)) {
    try {
      history = JSON.parse(readFileSync(indexPath, 'utf8'));
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
  }

  history.unshift({
    date: dateStamp(),
    generatedAt: new Date().toISOString(),
    count: results.length,
    results
  });
  history = history.slice(0, maxKeep);
  writeFileSync(indexPath, JSON.stringify(history, null, 2), 'utf8');
}
