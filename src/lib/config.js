import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, '../../config.json');

const raw = JSON.parse(readFileSync(configPath, 'utf8'));

if (process.env.HTTP_USER_AGENT) {
  raw.http.userAgent = process.env.HTTP_USER_AGENT;
}

raw.notifications = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || ''
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || ''
  },
  daemon: (process.env.DAILY_SCRAPER_DAEMON ?? 'true').toLowerCase() !== 'false'
};

export default raw;
