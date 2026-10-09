import axios from 'axios';
import pLimit from 'p-limit';
import { setTimeout as sleep } from 'node:timers/promises';

import config from './config.js';

const {
  concurrency,
  requestDelayMs,
  timeoutMs,
  maxRetries,
  userAgent
} = config.http;

const BROWSER_HEADERS = {
  'User-Agent': userAgent,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh-Hant;q=0.9,zh-Hans;q=0.8,en-US;q=0.7,en;q=0.6,ja;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Sec-Ch-Ua': '"Chromium";v="127", "Not(A:Brand";v="24", "Google Chrome";v="127"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'DNT': '1',
  'sec-ch-ua': '"Chromium";v="127", "Not(A:Brand";v="24", "Google Chrome";v="127"'
};

const axiosInstance = axios.create({
  timeout: timeoutMs,
  headers: { ...BROWSER_HEADERS },
  maxRedirects: 5,
  decompress: true,
  validateStatus: (status) => status >= 200 && status < 400
});

// ----- Cookie jar (per host) -----
const cookieJar = new Map();  // host -> Map<name, value>

function getCookies(host) {
  const jar = cookieJar.get(host);
  if (!jar || jar.size === 0) return '';
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function setCookies(host, headers) {
  const raw = headers['set-cookie'];
  if (!raw) return;
  const list = Array.isArray(raw) ? raw : [raw];
  let jar = cookieJar.get(host);
  if (!jar) { jar = new Map(); cookieJar.set(host, jar); }
  for (const sc of list) {
    const first = sc.split(';')[0];
    const eq = first.indexOf('=');
    if (eq < 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (value === '' || /deleted/i.test(value)) jar.delete(name);
    else jar.set(name, value);
  }
}

// ----- Warmup (visit homepage first to seed cookies) -----
const warmedUp = new Set();
export async function warmup(baseUrl) {
  let host;
  try { host = new URL(baseUrl).host; } catch { return; }
  if (warmedUp.has(host)) return;
  warmedUp.add(host);
  try {
    const res = await axiosInstance.get(baseUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Dest': 'document'
      }
    });
    setCookies(host, res.headers);
  } catch (err) {
    // warmup is best-effort; ignore errors
  }
}

// ----- Request with cookie injection + capture -----
async function doRequest(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error(`bad url ${url}`); }
  const host = parsed.host;
  const cookies = getCookies(host);

  const headers = { ...BROWSER_HEADERS };
  if (cookies) headers['Cookie'] = cookies;
  // Sec-Fetch-Site: same-origin for tags, cross-origin for warmup
  headers['Sec-Fetch-Site'] = (warmedUp.has(host) ? 'same-origin' : 'none');
  headers['Referer'] = `${parsed.protocol}//${host}/`;

  const res = await axiosInstance.get(url, { headers, responseType: 'text' });
  setCookies(host, res.headers);
  return res.data;
}

// ----- Public fetchHtml with rate limiting + retry on 403 -----
const limit = pLimit(concurrency);
let lastRequestAt = 0;

async function throttledDelay() {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + requestDelayMs - now);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export async function fetchHtml(url, { retries = maxRetries, allowWarmup = true } = {}) {
  // First time we see this host, warmup
  if (allowWarmup) {
    try {
      const u = new URL(url);
      await warmup(`${u.protocol}//${u.host}/`);
    } catch { /* ignore */ }
  }

  return limit(async () => {
    let attempt = 0;
    while (attempt <= retries) {
      try {
        await throttledDelay();
        const data = await doRequest(url);
        return data;
      } catch (err) {
        attempt += 1;
        const status = err.response?.status;
        const retriable = !status || status >= 500 || status === 429 || status === 408 || status === 403;
        if (attempt > retries || !retriable) {
          throw new Error(`fetch failed ${url} (${err.message})`);
        }
        // On 403, invalidate cookies and try harder backoff
        if (status === 403) {
          try {
            const u = new URL(url);
            cookieJar.delete(u.host);
            warmedUp.delete(u.host);
          } catch { /* ignore */ }
          await sleep(3000 * attempt);  // longer backoff for 403
        } else {
          await sleep(1000 * 2 ** attempt);
        }
      }
    }
    throw new Error(`unreachable: fetchHtml ${url}`);
  });
}

export async function fetchText(url, opts = {}) {
  return fetchHtml(url, opts);
}

export function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}
