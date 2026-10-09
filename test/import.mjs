import { scrapeJable } from '../src/scrapers/jable.js';
import { scrapeMissav } from '../src/scrapers/missav.js';
import { writeResults, loadSeen, saveSeen } from '../src/lib/storage.js';
import { notifyAll } from '../src/lib/notify.js';
import config from '../src/lib/config.js';

console.log('config loaded:');
console.log('  sites.jable.tagPages =', config.sites.jable.tagPages.length);
console.log('  sites.missav.tagPages =', config.sites.missav.tagPages.length);
console.log('  requiredTags.zh-Hant =', config.filters.requiredTags['zh-Hant']);
console.log('  schedule.cron =', config.schedule.cron, 'tz=', config.schedule.timezone);

console.log('\nimports OK:', {
  scrapeJable: typeof scrapeJable,
  scrapeMissav: typeof scrapeMissav,
  writeResults: typeof writeResults,
  loadSeen: typeof loadSeen,
  saveSeen: typeof saveSeen,
  notifyAll: typeof notifyAll
});

console.log('\nstatic smoke test passed');
