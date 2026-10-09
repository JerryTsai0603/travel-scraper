// web/prices/data.js
// 機票 / 住宿 價格監控子系統的資料層
// 全部用同步 I/O，跟現有 web/lib/data.js 的風格一致。
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRICES_DIR = resolve(__dirname, '..', '..', 'data', 'prices');
const TRIPS_FILE = resolve(PRICES_DIR, 'trips.json');
const STATE_FILE = resolve(PRICES_DIR, 'state.json');
const HISTORY_DIR = resolve(PRICES_DIR, 'history');

mkdirSync(PRICES_DIR, { recursive: true });
mkdirSync(HISTORY_DIR, { recursive: true });

const TRIPS_DEFAULT = { trips: [] };
const STATE_DEFAULT = {
  lastFetchAt: null,        // ISO timestamp
  lastFetchByTrip: {},       // { tripId: ISO timestamp }
  alertsSentByTrip: {},     // { tripId: { thresholdHash: ISO timestamp } } 防止重複推播
};

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function atomicWrite(file, obj) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  renameSync(tmp, file);
}

const tripsCache = { mtime: 0, payload: null };
function readTrips() {
  if (!existsSync(TRIPS_FILE)) return structuredClone(TRIPS_DEFAULT);
  const mtime = statSync(TRIPS_FILE).mtimeMs;
  if (tripsCache.mtime === mtime && tripsCache.payload) return tripsCache.payload;
  const payload = readJson(TRIPS_FILE, TRIPS_DEFAULT);
  if (!payload.trips) payload.trips = [];
  tripsCache.mtime = mtime;
  tripsCache.payload = payload;
  return payload;
}

function writeTrips(payload) {
  atomicWrite(TRIPS_FILE, payload);
  tripsCache.mtime = statSync(TRIPS_FILE).mtimeMs;
  tripsCache.payload = structuredClone(payload);
}

const stateCache = { mtime: 0, payload: null };
function readState() {
  if (!existsSync(STATE_FILE)) return structuredClone(STATE_DEFAULT);
  const mtime = statSync(STATE_FILE).mtimeMs;
  if (stateCache.mtime === mtime && stateCache.payload) return stateCache.payload;
  const payload = readJson(STATE_FILE, STATE_DEFAULT);
  stateCache.mtime = mtime;
  stateCache.payload = payload;
  return payload;
}

function writeState(payload) {
  atomicWrite(STATE_FILE, payload);
  stateCache.mtime = statSync(STATE_FILE).mtimeMs;
  stateCache.payload = structuredClone(payload);
}

// ---- Trip CRUD ----------------------------------------------------------

export function listTrips() {
  const { trips } = readTrips();
  return [...trips].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function getTrip(id) {
  const { trips } = readTrips();
  return trips.find((t) => t.id === id) || null;
}

export function upsertTrip(input) {
  const payload = readTrips();
  const now = new Date().toISOString();
  const trip = normalizeTrip(input);
  if (trip.id) {
    const idx = payload.trips.findIndex((t) => t.id === trip.id);
    if (idx >= 0) {
      trip.createdAt = payload.trips[idx].createdAt || now;
      trip.updatedAt = now;
      payload.trips[idx] = trip;
    } else {
      trip.createdAt = now;
      trip.updatedAt = now;
      payload.trips.push(trip);
    }
  } else {
    trip.id = randomUUID();
    trip.createdAt = now;
    trip.updatedAt = now;
    payload.trips.push(trip);
  }
  writeTrips(payload);
  return trip;
}

export function deleteTrip(id) {
  const payload = readTrips();
  const before = payload.trips.length;
  payload.trips = payload.trips.filter((t) => t.id !== id);
  writeTrips(payload);
  // 順便清掉對應歷史
  try {
    const hist = resolve(HISTORY_DIR, `${id}.json`);
    if (existsSync(hist)) renameSync(hist, `${hist}.deleted-${Date.now()}`);
  } catch { /* noop */ }
  return payload.trips.length < before;
}

function normalizeTrip(input) {
  const trip = { ...input };
  if (!trip.name || !String(trip.name).trim()) {
    throw new Error('trip.name 不可為空');
  }
  if (!['flight', 'hotel'].includes(trip.kind)) {
    throw new Error('trip.kind 必須是 flight 或 hotel');
  }
  trip.name = String(trip.name).trim().slice(0, 80);
  trip.adults = clampInt(trip.adults, 1, 9, 1);
  trip.currency = String(trip.currency || 'TWD').toUpperCase().slice(0, 6);
  trip.providers = Array.isArray(trip.providers) && trip.providers.length
    ? [...new Set(trip.providers.map(String))]
    : ['mock'];
  trip.notes = String(trip.notes || '').slice(0, 600);
  if (trip.kind === 'flight') {
    trip.origin = String(trip.origin || '').toUpperCase().slice(0, 8);
    trip.destination = String(trip.destination || '').toUpperCase().slice(0, 8);
    trip.departDate = trip.departDate || null;
    trip.returnDate = trip.returnDate || null;
    trip.cabinClass = ['economy', 'premium_economy', 'business', 'first'].includes(trip.cabinClass)
      ? trip.cabinClass : 'economy';
    trip.threshold = numberOrNull(trip.threshold);
  } else {
    trip.hotelCity = String(trip.hotelCity || '').trim().slice(0, 60);
    trip.hotelCheckIn = trip.hotelCheckIn || null;
    trip.hotelCheckOut = trip.hotelCheckOut || null;
    trip.roomType = String(trip.roomType || 'standard').slice(0, 30);
    trip.threshold = numberOrNull(trip.threshold);
    // 經緯度 + 半徑（可選；提供時讓 mock / 真實 provider 可在地圖上框選）
    trip.hotelLat = numberOrNull(trip.hotelLat);
    trip.hotelLng = numberOrNull(trip.hotelLng);
    trip.hotelRadiusKm = numberOrNull(trip.hotelRadiusKm);
    if (trip.hotelRadiusKm == null) trip.hotelRadiusKm = 3;
    if (trip.hotelRadiusKm > 0) trip.hotelRadiusKm = Math.min(50, Math.max(0.1, trip.hotelRadiusKm));
  }
  return trip;
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function numberOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ---- History -------------------------------------------------------------

export function appendHistory(tripId, snapshot) {
  const file = resolve(HISTORY_DIR, `${tripId}.json`);
  let arr = [];
  if (existsSync(file)) {
    try { arr = JSON.parse(readFileSync(file, 'utf8')); } catch { arr = []; }
  }
  arr.push({ ...snapshot, capturedAt: snapshot.capturedAt || new Date().toISOString() });
  // 限制最大條數（保留最近 1500 筆避免單檔膨脹）
  if (arr.length > 1500) arr = arr.slice(arr.length - 1500);
  atomicWrite(file, arr);
  return arr.length;
}

export function getHistory(tripId) {
  const file = resolve(HISTORY_DIR, `${tripId}.json`);
  if (!existsSync(file)) return [];
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return []; }
}

export function listAllHistoryFiles() {
  if (!existsSync(HISTORY_DIR)) return [];
  return readdirSync(HISTORY_DIR).filter((f) => /^[0-9a-f-]+\.json$/.test(f));
}

// ---- 統計 / 摘要 --------------------------------------------------------

export function summarizeTrip(trip) {
  if (!trip) return null;
  const hist = getHistory(trip.id);
  const last = hist[hist.length - 1] || null;
  const cheapest = pickCheapest(hist);
  const lastFetched = getLastFetchedAt(trip.id);
  return {
    trip,
    historyCount: hist.length,
    lastSnapshot: last,
    lastFetchedAt: lastFetched,
    cheapestSnapshot: cheapest,
    daysToDepart: daysUntil(trip.kind === 'flight' ? trip.departDate : trip.hotelCheckIn),
  };
}

export function pickCheapest(history) {
  if (!history || !history.length) return null;
  const valid = history.filter((h) => Number.isFinite(h.bestPrice) && h.bestPrice > 0);
  if (!valid.length) return null;
  return valid.reduce((min, p) => (p.bestPrice < min.bestPrice ? p : min), valid[0]);
}

export function getLastFetchedAt(tripId) {
  const s = readState();
  return s.lastFetchByTrip[tripId] || null;
}

export function getGlobalState() {
  return readState();
}

export function recordFetch(tripId, at) {
  const s = readState();
  s.lastFetchByTrip[tripId] = at;
  s.lastFetchAt = at;
  writeState(s);
}

export function recordAlert(tripId, thresholdHash, at) {
  const s = readState();
  if (!s.alertsSentByTrip[tripId]) s.alertsSentByTrip[tripId] = {};
  s.alertsSentByTrip[tripId][thresholdHash] = at;
  writeState(s);
}

export function shouldAlert(tripId, thresholdHash, cooldownMs = 12 * 3600 * 1000) {
  const s = readState();
  const lastSent = s.alertsSentByTrip[tripId]?.[thresholdHash];
  if (!lastSent) return true;
  return Date.now() - new Date(lastSent).getTime() > cooldownMs;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr + 'T00:00:00Z').getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

export const PRICES_DIR_PATH = PRICES_DIR;