// Generate sample data with embedded SVG thumbnails
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '..', 'data');

const palette = {
  jable: { bg: '#0d3d3a', fg: '#4ecdc4' },
  missav: { bg: '#3d2a14', fg: '#ffb86f' }
};

function svgFor(title, site) {
  const c = palette[site] || palette.jable;
  const safe = String(title).replace(/[<>&"']/g, (ch) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c.bg}"/>
      <stop offset="100%" stop-color="#000"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <rect x="20" y="20" width="600" height="360" fill="none" stroke="${c.fg}" stroke-width="2" stroke-opacity="0.4" rx="8"/>
  <text x="320" y="180" text-anchor="middle" font-family="PingFang TC,Microsoft JhengHei,sans-serif" font-size="28" fill="#fff" font-weight="600">${safe}</text>
  <text x="320" y="220" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${c.fg}" opacity="0.7">${site} - sample placeholder</text>
  <text x="320" y="350" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${c.fg}" opacity="0.5">silk stockings + footjob + Chinese subs</text>
</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

const day1 = {
  generatedAt: '2026-09-12T08:01:23.456Z',
  date: '2026-09-12',
  count: 3,
  results: [
    {
      site: 'jable',
      url: 'https://jable.tv/videos/sample-stockings-footjob-001/',
      title: 'Sample Stockings Footjob 001',
      publishedAt: '2026-09-10T03:00:00.000Z',
      duration: '00:18:24',
      thumbnail: svgFor('Sample Stockings Footjob 001', 'jable'),
      tags: ['絲襪', '腳交', '高清', '中字'],
      performers: ['Sample Actress A', 'Sample Actress B'],
      matchedTags: ['絲襪', '腳交'],
      subtitleEvidence: 'page contains "中文字幕"',
      capturedAt: '2026-09-12T08:00:11.123Z'
    },
    {
      site: 'jable',
      url: 'https://jable.tv/videos/sample-stockings-footjob-002/',
      title: 'Sample Stockings Footjob 002',
      publishedAt: '2026-09-09T12:30:00.000Z',
      duration: '00:24:10',
      thumbnail: svgFor('Sample Stockings Footjob 002', 'jable'),
      tags: ['stockings', 'footjob', '1080p'],
      performers: ['Sample Actress A'],
      matchedTags: ['stockings', 'footjob'],
      subtitleEvidence: 'meta language=zh-Hant',
      capturedAt: '2026-09-12T08:00:14.456Z'
    },
    {
      site: 'missav',
      url: 'https://missav123.com/sample-silk-footjob-003/',
      title: 'Sample Silk Footjob 003',
      publishedAt: '2026-09-11T01:15:00.000Z',
      duration: '00:32:50',
      thumbnail: svgFor('Sample Silk Footjob 003', 'missav'),
      tags: ['絲襪', '腳交', '無碼'],
      performers: ['Sample Actress C'],
      matchedTags: ['絲襪', '腳交'],
      subtitleEvidence: 'subtitle track lang=zh-TW',
      capturedAt: '2026-09-12T08:00:21.789Z'
    }
  ]
};

const day2 = {
  generatedAt: '2026-09-11T08:00:42.111Z',
  date: '2026-09-11',
  count: 2,
  results: [
    {
      site: 'missav',
      url: 'https://missav123.com/sample-stockings-009/',
      title: 'Sample Stockings 009',
      publishedAt: '2026-09-08T07:00:00.000Z',
      duration: '00:15:42',
      thumbnail: svgFor('Sample Stockings 009', 'missav'),
      tags: ['stockings', 'foot-fetish'],
      performers: ['Sample Actress D'],
      matchedTags: ['stockings', 'foot-fetish'],
      subtitleEvidence: 'page contains "Chinese"',
      capturedAt: '2026-09-11T08:00:09.111Z'
    },
    {
      site: 'jable',
      url: 'https://jable.tv/videos/sample-stockings-footjob-007/',
      title: 'Sample Stockings Footjob 007',
      publishedAt: '2026-09-07T19:00:00.000Z',
      duration: '00:21:00',
      thumbnail: svgFor('Sample Stockings Footjob 007', 'jable'),
      tags: ['絲襪', '腳交'],
      performers: ['Sample Actress B', 'Sample Actress E'],
      matchedTags: ['絲襪', '腳交'],
      subtitleEvidence: 'meta language=zh-Hans',
      capturedAt: '2026-09-11T08:00:15.555Z'
    }
  ]
};

writeFileSync(resolve(dataDir, 'results-2026-09-12.json'), JSON.stringify(day1, null, 2), 'utf8');
writeFileSync(resolve(dataDir, 'results-2026-09-11.json'), JSON.stringify(day2, null, 2), 'utf8');

console.log(`generated ${day1.results.length + day2.results.length} videos across 2 days`);
