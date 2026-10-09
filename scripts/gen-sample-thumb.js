// Generate a local SVG data URI placeholder for sample data.
// Usage: node scripts/gen-sample-thumb.js "Sample Title" jable
// Returns: data:image/svg+xml;base64,... (paste into JSON as "thumbnail")

const [, , title = 'Sample', site = 'jable'] = process.argv;

const palette = {
  jable: { bg: '#0d3d3a', fg: '#4ecdc4' },
  missav: { bg: '#3d2a14', fg: '#ffb86f' }
};
const colors = palette[site] || palette.jable;
const safe = String(title).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="100%" stop-color="#000"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <rect x="20" y="20" width="600" height="360" fill="none" stroke="${colors.fg}" stroke-width="2" stroke-opacity="0.4" rx="8"/>
  <text x="320" y="190" text-anchor="middle" font-family="PingFang TC, Microsoft JhengHei, sans-serif" font-size="32" fill="#fff" font-weight="600">${safe}</text>
  <text x="320" y="230" text-anchor="middle" font-family="sans-serif" font-size="18" fill="${colors.fg}" opacity="0.7">[sample placeholder]</text>
  <text x="320" y="340" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${colors.fg}" opacity="0.5">${site} · 絲襪 · 腳交</text>
</svg>`;

console.log('data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64'));
