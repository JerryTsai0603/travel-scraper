// web/prices/scheduler.js
// 預設每分鐘醒來一次，掃描所有 trip：若到達該 trip 的 fetchIntervalMinutes，就跑 fetch。
// 這樣 per-trip 頻率才有作用。
// 全域 fallback 由 PRICES_DEFAULT_INTERVAL 控制（分鐘），預設 360 (6 小時)。
//
// 也支援舊行為：直接設 PRICES_CRON 強制每 N 分鐘跑所有 trip（向後相容）。
import cron from 'node-cron';
import { listTrips, computeNextFetchAt, getLastFetchedAt } from './data.js';
import { runFetchForTrip } from './router.js';

const DEFAULT_TICK_CRON = '* * * * *';  // 每分鐘醒一次（輕量）
const TIMEZONE = process.env.PRICES_TZ || 'Asia/Taipei';

let task = null;

export function startPricesScheduler({ logger = console, defaultIntervalMinutes = 360 } = {}) {
  if (task) return task;
  // 兼容舊 PRICES_CRON：若使用者顯式設了，優先用那個（強制一次抓全部）
  const useLegacyCron = !!process.env.PRICES_CRON && process.env.PRICES_CRON !== DEFAULT_TICK_CRON;
  const cronExpr = useLegacyCron ? process.env.PRICES_CRON : DEFAULT_TICK_CRON;
  const mode = useLegacyCron ? 'legacy' : 'per-trip-interval';

  task = cron.schedule(cronExpr, async () => {
    const trips = listTrips();
    const now = Date.now();
    if (mode === 'legacy') {
      logger.log?.(`[prices] legacy tick (${cronExpr}) · ${trips.length} trips`);
      for (const trip of trips) {
        try {
          const { snapshot } = await runFetchForTrip(trip);
          logger.log?.(`[prices] · ${trip.name} → ${snapshot.bestPrice ?? snapshot.error ?? 'no data'}`);
        } catch (err) {
          logger.error?.(`[prices] fetch failed for ${trip.name}: ${err.message}`);
        }
      }
      return;
    }
    // per-trip mode: 掃描，只抓取「已到期」的
    for (const trip of trips) {
      const lastFetchedAt = getLastFetchedAt(trip.id);
      const nextAt = computeNextFetchAt(trip, lastFetchedAt);
      if (!nextAt) continue;
      const dueMs = new Date(nextAt).getTime();
      if (dueMs > now) continue; // 還沒到
      const interval = trip.fetchIntervalMinutes || parseInt(process.env.PRICES_DEFAULT_INTERVAL || String(defaultIntervalMinutes), 10);
      try {
        const { snapshot } = await runFetchForTrip(trip);
        logger.log?.(`[prices] · ${trip.name} (every ${interval}m) → ${snapshot.bestPrice ?? snapshot.error ?? 'no data'}`);
      } catch (err) {
        logger.error?.(`[prices] fetch failed for ${trip.name}: ${err.message}`);
      }
    }
  }, { timezone: TIMEZONE });

  logger.log?.(`[prices] scheduler started · mode=${mode} cron="${cronExpr}" tz=${TIMEZONE} defaultInterval=${parseInt(process.env.PRICES_DEFAULT_INTERVAL || String(defaultIntervalMinutes), 10)}m`);
  return task;
}

export function stopPricesScheduler() {
  if (task) { task.stop(); task = null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startPricesScheduler();
}