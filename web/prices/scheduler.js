// web/prices/scheduler.js
// node-cron 背景抓取所有 trip。可單獨啟動：
//   node web/prices/scheduler.js
// 或經由 web server import 做內嵌式（已預設不啟動，需在 server.js 明確呼叫）。
import cron from 'node-cron';
import { listTrips } from './data.js';
import { runFetchForTrip } from './router.js';

const DEFAULT_CRON = process.env.PRICES_CRON || '0 */6 * * *';   // 每 6 小時
const TIMEZONE = process.env.PRICES_TZ || 'Asia/Taipei';

let task = null;

export function startPricesScheduler({ logger = console } = {}) {
  if (task) return task;
  task = cron.schedule(DEFAULT_CRON, async () => {
    const trips = listTrips();
    logger.log?.(`[prices] scheduled fetch · ${trips.length} trips`);
    for (const trip of trips) {
      try {
        const { snapshot } = await runFetchForTrip(trip);
        logger.log?.(`[prices] · ${trip.name} → ${snapshot.bestPrice ?? snapshot.error ?? 'no data'}`);
      } catch (err) {
        logger.error?.(`[prices] fetch failed for ${trip.name}: ${err.message}`);
      }
    }
  }, { timezone: TIMEZONE });
  logger.log?.(`[prices] scheduler started · cron="${DEFAULT_CRON}" tz=${TIMEZONE}`);
  return task;
}

export function stopPricesScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
}

// 直接 node 啟動時常駐
if (import.meta.url === `file://${process.argv[1]}`) {
  startPricesScheduler();
}