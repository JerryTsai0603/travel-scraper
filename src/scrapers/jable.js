import * as cheerio from 'cheerio';
import { fetchHtml, absoluteUrl } from '../lib/http.js';
import { matchesAllRequired } from '../filters/tags.js';
import { isChineseSubtitle } from '../filters/subtitle.js';
import { logger } from '../lib/logger.js';
import config from '../lib/config.js';

const siteKey = 'jable';
const baseUrl = config.sites.jable.baseUrl;
const maxPages = config.sites.jable.maxPagesPerTag;
const maxAgeDays = config.filters.maxAgeDays;

function buildPageUrl(tagPath, page) {
  const sep = tagPath.includes('?') ? '&' : '?';
  return page > 1 ? `${tagPath}${sep}page=${page}` : tagPath;
}

function extractVideoLinks(html, base) {
  const $ = cheerio.load(html);
  const out = new Set();
  $('a[href*="/videos/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (/\/videos\/[a-z0-9-]+\/?$/i.test(href)) {
      const abs = absoluteUrl(base, href);
      if (abs) out.add(abs.split('#')[0]);
    }
  });
  return [...out];
}

function parsePublishedAt(text) {
  if (!text) return null;
  const rel = text.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2].toLowerCase();
    const map = { minute: 60_000, hour: 3.6e6, day: 8.64e7, week: 6.048e8, month: 2.63e9, year: 3.156e10 };
    return new Date(Date.now() - n * (map[unit] || 0)).toISOString();
  }
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function withinMaxAge(iso) {
  if (!maxAgeDays) return true;
  if (!iso) return true;
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs <= maxAgeDays * 86_400_000;
}

function parseDetail(html, url) {
  const $ = cheerio.load(html);
  const title = $('h1.video-title, h1[class*="title"]').first().text().trim()
    || $('meta[property="og:title"]').attr('content') || '';

  const tags = new Set();
  $('a[href*="/tags/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) tags.add(t);
  });
  $('meta[name="keywords"]').attr('content')?.split(',').forEach((t) => tags.add(t.trim()));

  const publishedAt = parsePublishedAt(
    $('time[datetime]').attr('datetime')
    || $('meta[property="article:published_time"]').attr('content')
    || ''
  );

  const duration = $('i.fa-clock').parent().text().trim()
    || $('.video-meta .duration, .info .duration').text().trim()
    || '';

  const thumbnail = $('meta[property="og:image"]').attr('content')
    || $('video').attr('poster')
    || '';

  const pageText = $('body').text();

  const performers = new Set();
  $('a[href*="/models/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 60) performers.add(t);
  });
  $('meta[itemprop="actor"]').each((_, el) => {
    const name = $(el).attr('content') || $(el).text().trim();
    if (name) performers.add(name);
  });
  const descMatch = pageText.match(/Models?[:：]\s*([^\n]+)/i);
  if (descMatch) {
    descMatch[1].split(/[、,，/／&]/).map((s) => s.trim()).filter(Boolean).forEach((s) => performers.add(s));
  }

  const meta = {
    keywords: $('meta[name="keywords"]').attr('content') || '',
    description: $('meta[name="description"]').attr('content') || ''
  };

  return {
    title,
    tags: [...tags],
    publishedAt,
    duration,
    thumbnail,
    performers: [...performers],
    pageText,
    meta,
    url
  };
}

async function collectVideoUrls() {
  const urls = new Set();
  for (const tagPath of config.sites.jable.tagPages) {
    for (let page = 1; page <= maxPages; page += 1) {
      const fullUrl = absoluteUrl(baseUrl, buildPageUrl(tagPath, page));
      try {
        const html = await fetchHtml(fullUrl);
        const links = extractVideoLinks(html, baseUrl);
        if (!links.length) break;
        for (const l of links) urls.add(l);
      } catch (err) {
        logger.warn(`jable list failed: ${fullUrl} (${err.message})`);
        break;
      }
    }
  }
  return [...urls];
}

export async function scrapeJable({ onProgress } = {}) {
  const results = [];
  const urls = await collectVideoUrls();
  logger.info(`jable: collected ${urls.length} candidate urls`);

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const detail = parseDetail(html, url);
      const tagMatch = matchesAllRequired(detail.tags);
      if (!tagMatch.ok) {
        onProgress?.({ site: siteKey, url, status: 'skip-tags' });
        continue;
      }
      if (!withinMaxAge(detail.publishedAt)) {
        onProgress?.({ site: siteKey, url, status: 'skip-age' });
        continue;
      }
      const sub = isChineseSubtitle({ pageText: detail.pageText, meta: detail.meta });
      if (!sub.ok) {
        onProgress?.({ site: siteKey, url, status: 'skip-subtitle' });
        continue;
      }

      results.push({
        site: siteKey,
        url: detail.url,
        title: detail.title,
        publishedAt: detail.publishedAt,
        duration: detail.duration,
        thumbnail: detail.thumbnail,
        tags: detail.tags,
        performers: detail.performers,
        matchedTags: tagMatch.matched,
        subtitleEvidence: sub.evidence,
        capturedAt: new Date().toISOString()
      });
      onProgress?.({ site: siteKey, url, status: 'match' });
    } catch (err) {
      logger.warn(`jable detail failed: ${url} (${err.message})`);
      onProgress?.({ site: siteKey, url, status: 'error', error: err.message });
    }
  }

  logger.info(`jable: matched ${results.length} videos`);
  return results;
}
