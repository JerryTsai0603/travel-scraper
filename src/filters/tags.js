import config from '../lib/config.js';

const required = config.filters.requiredTags;
const allKeywords = [
  ...required['zh-Hant'],
  ...required.en
];

const normCache = new Map();
export function normalize(text) {
  if (!text) return '';
  if (normCache.has(text)) return normCache.get(text);
  const out = String(text)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  normCache.set(text, out);
  return out;
}

export function matchesAllRequired(tagList) {
  const tagsNorm = new Set((tagList || []).map(normalize));
  const matched = [];
  for (const kw of allKeywords) {
    if (tagsNorm.has(normalize(kw))) matched.push(kw);
  }
  // Require BOTH themes present (at least one keyword from each group).
  const zhHit = required['zh-Hant'].some((k) => tagsNorm.has(normalize(k)));
  const enHit = required.en.some((k) => tagsNorm.has(normalize(k)));
  const hasSilk = tagsNorm.has(normalize('絲襪')) || tagsNorm.has(normalize('stockings'));
  const hasFoot = tagsNorm.has(normalize('腳交')) || tagsNorm.has(normalize('footjob')) || tagsNorm.has(normalize('foot-fetish'));
  const ok = hasSilk && hasFoot;
  return { ok, matched: Array.from(new Set(matched)) };
}
