import { scrapeJable } from './scrapers/jable.js';
import { scrapeMissav } from './scrapers/missav.js';
import { writeResults, loadSeen, saveSeen, appendToLatest } from './lib/storage.js';
import { notifyAll } from './lib/notify.js';
import { logger } from './lib/logger.js';

async function runOnce() {
  const startedAt = new Date().toISOString();
  logger.info(`scrape run starting @ ${startedAt}`);

  const all = [];
  if (process.env.SITE_FILTER !== 'missav') {
    try {
      const jable = await scrapeJable();
      all.push(...jable);
    } catch (err) {
      logger.error(`jable scraper failed: ${err.message}`);
    }
  }
  if (process.env.SITE_FILTER !== 'jable') {
    try {
      const missav = await scrapeMissav();
      all.push(...missav);
    } catch (err) {
      logger.error(`missav scraper failed: ${err.message}`);
    }
  }

  const seen = loadSeen();
  const fresh = all.filter((v) => !seen.has(v.url));
  for (const v of all) seen.add(v.url);
  saveSeen(seen);

  const { jsonPath, markdownPath } = writeResults(fresh);
  appendToLatest(fresh);

  logger.info(`scrape run done: ${fresh.length} new / ${all.length} total`, {
    jsonPath,
    markdownPath
  });

  await notifyAll(fresh);
  return { fresh, total: all.length };
}

const once = process.argv.includes('--once');

if (once) {
  runOnce()
    .then((res) => {
      logger.info(`one-shot finished: ${res.fresh.length} new`);
      process.exit(0);
    })
    .catch((err) => {
      logger.error(`one-shot failed: ${err.message}`);
      process.exit(1);
    });
} else {
  import('./scheduler.js').then(() => {
    /* scheduler.js keeps the process alive */
  });
}
