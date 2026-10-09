import config from '../lib/config.js';

const LANGS = new Set(config.filters.subtitle.languages.map((l) => l.toLowerCase()));
const LABELS = config.filters.subtitle.labels;

const HANT_RE = /[㐀-鿿豈-﫿]/;
const HANS_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

function detectLanguageFromText(text) {
  if (!text) return null;
  const sample = String(text).slice(0, 4000);
  const hasHant = HANT_RE.test(sample);
  const hasHans = HANS_RE.test(sample) && !HANT_RE.test(sample);
  if (hasHant) return 'zh-Hant';
  if (hasHans) return 'zh-Hans';
  return null;
}

export function isChineseSubtitle({ subtitleTracks = [], pageText = '', meta = {} } = {}) {
  const evidence = [];

  for (const track of subtitleTracks) {
    const lang = (track.lang || track.language || track.srclang || '').toLowerCase();
    const label = track.label || track.name || '';
    if (LANGS.has(lang) || LANGS.has(label.toLowerCase())) {
      evidence.push(`subtitle track lang=${lang || label}`);
      return { ok: true, evidence: evidence.join('; ') };
    }
  }

  const metaBlob = JSON.stringify(meta).toLowerCase();
  for (const lbl of LABELS) {
    if (metaBlob.includes(lbl.toLowerCase())) {
      evidence.push(`meta contains "${lbl}"`);
      return { ok: true, evidence: evidence.join('; ') };
    }
  }

  for (const lbl of LABELS) {
    if (pageText.includes(lbl)) {
      evidence.push(`page contains "${lbl}"`);
      return { ok: true, evidence: evidence.join('; ') };
    }
  }

  const langMeta = (meta.language || meta.languages || '').toString().toLowerCase();
  for (const code of LANGS) {
    if (langMeta.includes(code)) {
      evidence.push(`meta language=${code}`);
      return { ok: true, evidence: evidence.join('; ') };
    }
  }

  return { ok: false, evidence: '' };
}

export { detectLanguageFromText };
