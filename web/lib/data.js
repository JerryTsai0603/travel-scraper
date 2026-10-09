import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';

import config from '../../src/lib/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../', config.output.dir);
const thumbCacheDir = resolve(__dirname, '../public/thumbs');
mkdirSync(thumbCacheDir, { recursive: true });

const cache = new Map();
const CACHE_TTL_MS = 5_000;

function readJsonCached(filePath) {
  const mtime = statSync(filePath).mtimeMs;
  const cached = cache.get(filePath);
  if (cached && cached.mtime === mtime) return cached.payload;
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  cache.set(filePath, { mtime, payload: raw });
  return raw;
}

function listDateFiles() {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir)
    .filter((f) => /^results-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => ({
      file: f,
      date: f.match(/(\d{4}-\d{2}-\d{2})/)[1],
      path: resolve(dataDir, f),
      mtime: statSync(resolve(dataDir, f)).mtimeMs
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getAllDates() {
  return listDateFiles().map(({ date, mtime }) => ({ date, mtime }));
}

export function getLatestDate() {
  const all = listDateFiles();
  return all.length ? all[0].date : null;
}

export function getResultsByDate(date) {
  const file = resolve(dataDir, `results-${date}.json`);
  if (!existsSync(file)) return null;
  return readJsonCached(file);
}

export function getAllResults({ onlyFresh = false } = {}) {
  const out = [];
  const seen = new Set();
  for (const { date, path: file } of listDateFiles()) {
    try {
      const payload = readJsonCached(file);
      if (onlyFresh && seen.has(payload.results?.[0]?.url)) continue;
      for (const r of payload.results || []) {
        const key = `${r.site}::${r.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...r, capturedDate: date });
      }
    } catch {
      /* skip broken file */
    }
  }
  return out;
}

export function getAggregate({ site, tag, performer, q, from, to } = {}) {
  const all = getAllResults();
  const filtered = all.filter((r) => {
    if (site && r.site !== site) return false;
    if (from && r.capturedDate < from) return false;
    if (to && r.capturedDate > to) return false;
    if (tag && !(r.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    if (performer && !(r.performers || []).some((p) => p.toLowerCase().includes(performer.toLowerCase()))) return false;
    if (q) {
      const hay = `${r.title || ''} ${(r.performers || []).join(' ')} ${(r.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  return filtered;
}

export function getVideoByUrl(url) {
  for (const { path: file, date } of listDateFiles()) {
    try {
      const payload = readJsonCached(file);
      const found = (payload.results || []).find((r) => r.url === url);
      if (found) return { ...found, capturedDate: date };
    } catch {
      /* skip */
    }
  }
  return null;
}

export function getStats() {
  const all = getAllResults();
  const bySite = {};
  const tagCounts = new Map();
  const performerCounts = new Map();
  const dateCounts = new Map();
  for (const r of all) {
    bySite[r.site] = (bySite[r.site] || 0) + 1;
    for (const t of r.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    for (const p of r.performers || []) performerCounts.set(p, (performerCounts.get(p) || 0) + 1);
    dateCounts.set(r.capturedDate, (dateCounts.get(r.capturedDate) || 0) + 1);
  }
  const top = (m, n = 30) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    total: all.length,
    bySite,
    topTags: top(tagCounts),
    topPerformers: top(performerCounts),
    dates: [...dateCounts.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  };
}

export async function proxyThumbnail(rawUrl) {
  if (!rawUrl) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;

  const ext = (extname(parsed.pathname) || '.jpg').toLowerCase().split('?')[0];
  const safeName = `${Buffer.from(rawUrl).toString('hex').slice(0, 64)}${ext}`;
  const outPath = resolve(thumbCacheDir, safeName);

  if (existsSync(outPath) && Date.now() - statSync(outPath).mtimeMs < 7 * 86_400_000) {
    return `/thumbs/${safeName}`;
  }

  await new Promise((resolveP, rejectP) => {
    const lib = parsed.protocol === 'https:' ? request : httpRequest;
    const req = lib(parsed, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return rejectP(new Error(`status ${res.statusCode}`));
      }
      const file = createWriteStream(outPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolveP));
      file.on('error', rejectP);
    });
    req.setTimeout(10000, () => {
      req.destroy(new Error('thumb timeout'));
    });
    req.on('error', rejectP);
    req.end();
  }).catch(() => {
    /* swallow */
  });

  return existsSync(outPath) ? `/thumbs/${safeName}` : null;
}

export function buildLocalPlaceholder({ title = 'No image', site = 'jable', url = '' } = {}) {
  const palette = {
    jable: { bg: '#0d3d3a', fg: '#4ecdc4', label: 'Jable' },
    missav: { bg: '#3d2a14', fg: '#ffb86f', label: 'missav' }
  };
  const c = palette[site] || palette.jable;
  const safe = String(title).replace(/[<>&"']/g, (ch) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.bg}"/>
        <stop offset="100%" stop-color="#000"/>
      </linearGradient>
    </defs>
    <rect width="640" height="400" fill="url(#g)"/>
    <rect x="20" y="20" width="600" height="360" fill="none" stroke="${c.fg}" stroke-width="2" stroke-opacity="0.4" rx="8"/>
    <text x="320" y="180" text-anchor="middle" font-family="PingFang TC,Microsoft JhengHei,sans-serif" font-size="32" fill="#fff" font-weight="600">${safe}</text>
    <text x="320" y="220" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${c.fg}" opacity="0.7">${c.label}${host ? ' · ' + host : ''}</text>
    <text x="320" y="350" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${c.fg}" opacity="0.5">[offline placeholder]</text>
  </svg>`;
  return svg;
}
