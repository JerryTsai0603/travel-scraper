// web/prices/notify.js
// 價格警報專用通知：直接讀 .env 的 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / DISCORD_WEBHOOK_URL。
// 不重用 src/lib/notify.js（它的簽名鎖在「每日新片 results 陣列」）。
import axios from 'axios';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile() {
  try {
    const file = resolve(process.cwd(), '.env');
    if (!existsSync(file)) return {};
    const raw = readFileSync(file, 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function getEnv() {
  const fromProcess = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  };
  if (fromProcess.TELEGRAM_BOT_TOKEN || fromProcess.DISCORD_WEBHOOK_URL) return fromProcess;
  return loadEnvFile();
}

export async function notifyPriceAlert({ trip, snapshot, threshold }) {
  if (!snapshot || !Number.isFinite(snapshot.bestPrice)) return;
  const env = getEnv();
  const currency = snapshot.currency || trip.currency || 'TWD';
  const fmt = (n) => new Intl.NumberFormat('zh-Hant').format(Math.round(n));
  const lines = [];
  lines.push(`💰 價格警報：${trip.name}`);
  lines.push(`類型：${trip.kind === 'flight' ? '機票' : '住宿'}`);
  lines.push(`目前最低：${currency} ${fmt(snapshot.bestPrice)}`);
  if (threshold) lines.push(`你的門檻：${currency} ${fmt(threshold)}`);
  lines.push(`供應商：${snapshot.provider}`);
  lines.push(`抓取時間：${snapshot.capturedAt}`);
  if (Array.isArray(snapshot.flights) && snapshot.flights.length) {
    const f = snapshot.flights[0];
    lines.push(`航班：${f.carrier} ${f.flightNo}（${fmt(f.durationMin)} 分 / ${f.stops === 0 ? '直飛' : f.stops + ' 轉'}）`);
  }
  if (Array.isArray(snapshot.hotels) && snapshot.hotels.length) {
    const h = snapshot.hotels[0];
    lines.push(`住宿：${h.name}（${fmt(h.pricePerNight)} / 晚，共 ${fmt(h.totalPrice)}）`);
  }
  const message = lines.join('\n');

  const sends = [];
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    sends.push(axios.post(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: env.TELEGRAM_CHAT_ID, text: message, disable_web_page_preview: true },
      { timeout: 10000 }
    ).then(() => 'telegram').catch((err) => `telegram:${err.message}`));
  }
  if (env.DISCORD_WEBHOOK_URL) {
    sends.push(axios.post(
      env.DISCORD_WEBHOOK_URL,
      { content: message },
      { timeout: 10000 }
    ).then(() => 'discord').catch((err) => `discord:${err.message}`));
  }
  const results = await Promise.all(sends);
  for (const r of results) {
    if (typeof r === 'string' && r.includes(':')) {
      // eslint-disable-next-line no-console
      console.warn(`[prices] notify ${r}`);
    }
  }
}