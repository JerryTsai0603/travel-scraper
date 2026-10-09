import cron from 'node-cron';
import config from './lib/config.js';
import { logger } from './lib/logger.js';
import { runOnce } from './index.js';

const expr = config.schedule.cron;
const tz = config.schedule.timezone || 'Asia/Taipei';

if (!cron.validate(expr)) {
  logger.error(`invalid cron expression: ${expr}`);
  process.exit(1);
}

logger.info(`scheduler registered: cron='${expr}' timezone='${tz}'`);

cron.schedule(expr, async () => {
  try {
    await runOnce();
  } catch (err) {
    logger.error(`scheduled run failed: ${err.message}`);
  }
}, { timezone: tz });

async function shutdown(signal) {
  logger.info(`received ${signal}, exiting`);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (config.notifications.daemon === false) {
  logger.info('daemon disabled (DAILY_SCRAPER_DAEMON=false), running once and exiting');
  runOnce().then(() => process.exit(0)).catch((err) => {
    logger.error(`run failed: ${err.message}`);
    process.exit(1);
  });
}
