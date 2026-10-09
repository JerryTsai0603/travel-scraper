import axios from 'axios';
import config from './config.js';
import { logger } from './logger.js';

function buildMessage(results) {
  if (!results.length) return null;
  const lines = ['每日新片速報'];
  for (const r of results) {
    lines.push(`• [${r.site}] ${r.title}`);
    lines.push(`  ${r.url}`);
    lines.push(`  標籤：${r.matchedTags.join('、')}｜字幕：${r.subtitleEvidence}`);
  }
  return lines.join('\n');
}

export async function notifyAll(results) {
  const msg = buildMessage(results);
  if (!msg) {
    logger.info('no new matches, skip notification');
    return;
  }
  const { telegram, discord } = config.notifications;

  if (telegram.botToken && telegram.chatId) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${telegram.botToken}/sendMessage`,
        { chat_id: telegram.chatId, text: msg, disable_web_page_preview: true },
        { timeout: 10000 }
      );
      logger.info('telegram notification sent');
    } catch (err) {
      logger.warn(`telegram notify failed: ${err.message}`);
    }
  }

  if (discord.webhookUrl) {
    try {
      await axios.post(
        discord.webhookUrl,
        { content: msg },
        { timeout: 10000 }
      );
      logger.info('discord notification sent');
    } catch (err) {
      logger.warn(`discord notify failed: ${err.message}`);
    }
  }
}
