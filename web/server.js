import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAllDates,
  getLatestDate,
  getResultsByDate,
  getAllResults,
  getAggregate,
  getVideoByUrl,
  getStats,
  proxyThumbnail,
  buildLocalPlaceholder
} from './lib/data.js';

import { createPricesRouter } from './prices/router.js';

const PRICES_SCHEDULER_ENABLED = (process.env.PRICES_SCHEDULER ?? 'true').toLowerCase() === 'true';
const PRICES_SCHEDULER_IMPORT = process.env.PRICES_SCHEDULER_IMPORT; // 可注入自訂 scheduler module

const __dirname = dirname(fileURLToPath(import.meta.url));
const REQUESTED_PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const AUTO_PORT = (process.env.AUTO_PORT ?? 'true').toLowerCase() !== 'false';
const MAX_PORT_TRIES = 20;

const app = express();
app.set('view engine', 'ejs');
app.set('views', resolve(__dirname, 'views'));
app.use('/static', express.static(resolve(__dirname, 'public'), { maxAge: '1h' }));
app.use('/thumbs', express.static(resolve(__dirname, 'public/thumbs'), { maxAge: '7d' }));

function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;');
}

function decodeVideoParam(site, encoded) {
  try {
    return { site, url: Buffer.from(encoded, 'base64url').toString('utf8') };
  } catch {
    return null;
  }
}

function encodeVideoParam(url) {
  return Buffer.from(url, 'utf8').toString('base64url');
}

function buildFilterQuery(req) {
  return {
    site: (req.query.site || '').toString(),
    tag: (req.query.tag || '').toString(),
    performer: (req.query.performer || '').toString(),
    q: (req.query.q || '').toString(),
    from: (req.query.from || '').toString(),
    to: (req.query.to || '').toString(),
    sort: (req.query.sort || 'published-desc').toString(),
    qf: (req.query.qf || 'all').toString()
  };
}

function applyFilterToResults(results, f) {
  return results.filter((r) => {
    if (f.site && r.site !== f.site) return false;
    if (f.from && r.capturedDate < f.from) return false;
    if (f.to && r.capturedDate > f.to) return false;
    if (f.tag && !(r.tags || []).some((t) => t.toLowerCase() === f.tag.toLowerCase())) return false;
    if (f.performer && !(r.performers || []).some((p) => p.toLowerCase().includes(f.performer.toLowerCase()))) return false;
    if (f.q) {
      const hay = `${r.title || ''} ${(r.performers || []).join(' ')} ${(r.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
}

function applyQuickFilter(results, qf) {
  if (!qf || qf === 'all') return results;
  const today = new Date().toISOString().slice(0, 10);
  if (qf === 'today') return results.filter((r) => r.capturedDate === today);
  if (qf === 'week') {
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    return results.filter((r) => r.capturedDate >= cutoff);
  }
  return results;
}

function parseDuration(d) {
  if (!d) return 0;
  const parts = String(d).split(':').map((x) => parseInt(x, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

const VALID_SORTS = new Set([
  'published-desc', 'published-asc',
  'captured-desc', 'captured-asc',
  'duration-desc', 'duration-asc',
  'title-asc', 'title-desc'
]);

function applySort(results, mode) {
  if (!VALID_SORTS.has(mode)) mode = 'published-desc';
  const sorted = [...results];
  switch (mode) {
    case 'published-desc': return sorted.sort((a,b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    case 'published-asc':  return sorted.sort((a,b) => (a.publishedAt || '').localeCompare(b.publishedAt || ''));
    case 'captured-desc':  return sorted.sort((a,b) => (b.capturedDate || '').localeCompare(a.capturedDate || ''));
    case 'captured-asc':   return sorted.sort((a,b) => (a.capturedDate || '').localeCompare(b.capturedDate || ''));
    case 'duration-desc':  return sorted.sort((a,b) => parseDuration(b.duration) - parseDuration(a.duration));
    case 'duration-asc':   return sorted.sort((a,b) => parseDuration(a.duration) - parseDuration(b.duration));
    case 'title-asc':      return sorted.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
    case 'title-desc':     return sorted.sort((a,b) => (b.title || '').localeCompare(a.title || ''));
    default:               return sorted;
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get('/', (req, res) => {
  const filter = buildFilterQuery(req);
  const dates = getAllDates();
  const latest = dates[0]?.date || null;
  const all = getAllResults();
  let results = applyFilterToResults(all, filter);
  results = applyQuickFilter(results, filter.qf);
  results = applySort(results, filter.sort);
  const stats = getStats();
  res.render('index', {
    title: '每日爬蟲結果',
    dates,
    latestDate: latest,
    results,
    filter,
    stats,
    enc: encodeVideoParam
  });
});

app.get('/date/:date', (req, res) => {
  const payload = getResultsByDate(req.params.date);
  if (!payload) return res.status(404).render('empty', { title: '無資料', message: `找不到 ${req.params.date} 的結果` });
  const filter = buildFilterQuery(req);
  let results = applyFilterToResults(payload.results, filter);
  results = applySort(results, filter.sort);
  res.render('date', {
    title: `結果 ${req.params.date}`,
    payload,
    results,
    filter,
    enc: encodeVideoParam
  });
});

app.get('/history', (req, res) => {
  const dates = getAllDates();
  const stats = getStats();
  res.render('history', { title: '歷史彙總', dates, stats });
});

app.get('/video/:site/:encoded', (req, res) => {
  const decoded = decodeVideoParam(req.params.site, req.params.encoded);
  if (!decoded) return res.status(400).render('empty', { title: '錯誤', message: '參數錯誤' });
  const video = getVideoByUrl(decoded.url);
  if (!video) return res.status(404).render('empty', { title: '找不到影片', message: '該影片未在結果中' });
  res.render('video', { title: video.title || '影片', video });
});

app.get('/api/results', (req, res) => {
  const filter = buildFilterQuery(req);
  let results = applyFilterToResults(getAllResults(), filter);
  results = applyQuickFilter(results, filter.qf);
  results = applySort(results, filter.sort);
  res.json({ count: results.length, results, sort: filter.sort, qf: filter.qf });
});

app.get('/api/results/:date', (req, res) => {
  const payload = getResultsByDate(req.params.date);
  if (!payload) return res.status(404).json({ error: 'not found' });
  res.json(payload);
});

app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

app.get('/api/dates', (req, res) => {
  res.json(getAllDates());
});

app.get('/api/export', (req, res) => {
  const filter = buildFilterQuery(req);
  const format = (req.query.format || 'txt').toString().toLowerCase();
  const results = applyFilterToResults(getAllResults(), filter);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="daily-scraper-${new Date().toISOString().slice(0,10)}.json"`);
    res.send(JSON.stringify({ count: results.length, results }, null, 2));
    return;
  }

  if (format === 'csv') {
    const headers = ['site', 'title', 'url', 'thumbnail', 'publishedAt', 'duration', 'performers', 'tags', 'subtitleEvidence', 'capturedDate'];
    const escape = (v) => {
      const s = Array.isArray(v) ? v.join('; ') : (v == null ? '' : String(v));
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [headers.join(',')];
    for (const r of results) {
      rows.push(headers.map((h) => escape(r[h])).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="daily-scraper-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send('﻿' + rows.join('\n'));
    return;
  }

  // default: txt
  const lines = [];
  lines.push(`# daily-scraper export — ${new Date().toISOString()}`);
  lines.push(`# filter: ${JSON.stringify(filter)}`);
  lines.push(`# count: ${results.length}`);
  lines.push('');
  for (const r of results) {
    lines.push(`[${r.site}] ${r.title || '(未命名)'}`);
    lines.push(`  url:      ${r.url}`);
    if (r.thumbnail) lines.push(`  thumb:    ${r.thumbnail}`);
    if (r.publishedAt) lines.push(`  pub:      ${r.publishedAt}`);
    if (r.duration) lines.push(`  duration: ${r.duration}`);
    if (r.performers && r.performers.length) lines.push(`  actors:   ${r.performers.join(', ')}`);
    if (r.tags && r.tags.length) lines.push(`  tags:     ${r.tags.join(', ')}`);
    if (r.subtitleEvidence) lines.push(`  subtitle: ${r.subtitleEvidence}`);
    lines.push(`  captured: ${r.capturedDate}`);
    lines.push('');
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="daily-scraper-${new Date().toISOString().slice(0,10)}.txt"`);
  res.send(lines.join('\n'));
});

app.get('/thumb', async (req, res) => {
  const url = (req.query.url || '').toString();
  if (!url) return res.status(400).end();
  const proxied = await proxyThumbnail(url);
  if (proxied) {
    res.redirect(proxied);
    return;
  }
  // Offline fallback: try to find the video in our data and serve a local SVG
  const all = getAllResults();
  const video = all.find((r) => r.thumbnail === url);
  const svg = buildLocalPlaceholder({
    title: video?.title || 'No image',
    site: video?.site || 'jable',
    url
  });
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
});

app.use('/prices', createPricesRouter());

app.use((req, res) => {
  res.status(404).render('empty', { title: '找不到', message: `路徑 ${req.originalUrl} 不存在` });
});

import { createServer } from 'node:net';

function tryListen(host, port) {
  return new Promise((resolveP, rejectP) => {
    const srv = createServer();
    srv.once('error', rejectP);
    srv.once('listening', () => {
      const addr = srv.address();
      srv.close(() => resolveP(addr));
    });
    srv.listen(port, host);
  });
}

async function listenWithFallback() {
  let port = REQUESTED_PORT;
  for (let i = 0; i < MAX_PORT_TRIES; i += 1) {
    try {
      const addr = await tryListen(HOST, port);
      if (port !== REQUESTED_PORT) {
        // eslint-disable-next-line no-console
        console.log(`[web] port ${REQUESTED_PORT} busy, switched to ${port}`);
      }
      return app.listen(addr.port, HOST, () => {
        // eslint-disable-next-line no-console
        console.log(`[web] listening on http://${HOST}:${addr.port}`);
      });
    } catch (err) {
      if (!AUTO_PORT || err.code !== 'EADDRINUSE') throw err;
      port += 1;
    }
  }
  throw new Error(`could not bind after ${MAX_PORT_TRIES} tries from ${REQUESTED_PORT}`);
}

listenWithFallback().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[web] failed to start: ${err.message}`);
  process.exit(1);
});

if (PRICES_SCHEDULER_ENABLED) {
  import('./prices/scheduler.js').then(({ startPricesScheduler }) => {
    startPricesScheduler();
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[prices] scheduler bootstrap failed:', err.message);
  });
}
