// web/prices/providers/mock.js
// 預設裝載的 mock provider。
// 目的：即使沒有外部 API key、即使目標網站被 Cloudflare 擋，也能展示完整 UI。
// 特性：
//  - 同一 trip 的「最佳價」是確定性 pseudo-random（基於 trip.id 雜湊），讓趨勢圖有平滑曲線
//  - 加上 ±8% 高頻雜訊 + 偶發事件（搶票潮 / 限時殺價），趨勢更真實
//  - 機票：根據艙等 / 距離 / 出發日產生基準價
//  - 住宿：根據星級 / 房型 / 入住房晚數產生基準價
import { createHash } from 'node:crypto';

const id = 'mock';
const label = 'Mock (離線示範)';
const capabilities = { flight: true, hotel: true };

// 機票基準：艙等係數 × 距離係數 × 出發日係數
const CABIN_FACTOR = { economy: 1.0, premium_economy: 1.6, business: 3.4, first: 5.2 };
const AIRPORTS = {
  TPE: { name: '台北桃園', region: 'tw' }, HKG: { name: '香港', region: 'hk' },
  NRT: { name: '東京成田', region: 'jp' }, HND: { name: '東京羽田', region: 'jp' },
  KIX: { name: '大阪關西', region: 'jp' }, ICN: { name: '首爾仁川', region: 'kr' },
  SIN: { name: '新加坡', region: 'sg' }, BKK: { name: '曼谷', region: 'th' },
  LAX: { name: '洛杉磯', region: 'us' }, SFO: { name: '舊金山', region: 'us' },
};
const CARRIERS = [
  { code: 'BR', name: '長榮', hub: 'TPE' },
  { code: 'CI', name: '華航', hub: 'TPE' },
  { code: 'JL', name: 'JAL', hub: 'HND' },
  { code: 'NH', name: 'ANA', hub: 'NRT' },
  { code: 'KE', name: '大韓', hub: 'ICN' },
  { code: 'SQ', name: '新加坡航空', hub: 'SIN' },
  { code: 'TG', name: '泰航', hub: 'BKK' },
];
const HOTEL_BRANDS = [
  { name: '東京灣希爾頓', stars: 4.5, currency: 'TWD' },
  { name: '新宿王子大飯店', stars: 4.0, currency: 'TWD' },
  { name: '上野不忍可可大飯店', stars: 3.5, currency: 'TWD' },
  { name: '成田日航', stars: 4.0, currency: 'TWD' },
  { name: '難波光芒飯店', stars: 4.0, currency: 'TWD' },
];

// 簡易城市 → 預設座標（OSM Nominatim 找不到城市時的 fallback）
const CITY_DEFAULTS = {
  Tokyo:    { lat: 35.6895, lng: 139.6917 },
  Osaka:    { lat: 34.6937, lng: 135.5023 },
  Kyoto:    { lat: 35.0116, lng: 135.7681 },
  Seoul:    { lat: 37.5665, lng: 126.9780 },
  Taipei:   { lat: 25.0330, lng: 121.5654 },
  Taichung: { lat: 24.1477, lng: 120.6736 },
  Kaohsiung:{ lat: 22.6273, lng: 120.3014 },
  HongKong: { lat: 22.3193, lng: 114.1694 },
  Singapore: { lat: 1.3521,  lng: 103.8198 },
  Bangkok:  { lat: 13.7563, lng: 100.5018 },
};

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat); const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function stableHash(s) {
  return parseInt(createHash('sha1').update(s).digest('hex').slice(0, 8), 16);
}

function dayFactor(dateStr) {
  if (!dateStr) return 1.0;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime())) return 1.0;
  // 出發日越近越貴（最後一週 +15%；60 天前最便宜 -8%）
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 1.1; // 已過期 → 沒意義但保留
  if (days < 7) return 1.18;
  if (days < 14) return 1.08;
  if (days < 30) return 1.0;
  if (days < 60) return 0.94;
  return 0.92;
}

function distanceFactor(origin, dest) {
  if (!origin || !dest) return 1.0;
  const o = AIRPORTS[origin.toUpperCase()]; const x = AIRPORTS[dest.toUpperCase()];
  if (!o || !x) return 1.0;
  // 簡化地區 → 距離係數
  const map = { tw: { jp: 0.8, hk: 0.5, sg: 0.9, th: 0.85, kr: 0.8, us: 1.8 }, jp: { jp: 0.4, sg: 0.95, th: 0.9, kr: 0.5, us: 1.7 } };
  return map[o.region]?.[x.region] ?? 1.0;
}

function baseFlightPrice(trip) {
  const cabin = CABIN_FACTOR[trip.cabinClass || 'economy'] || 1.0;
  const dist = distanceFactor(trip.origin, trip.destination);
  const day = dayFactor(trip.departDate);
  // 經濟艙 TPEW → TJ 約 1.2 萬；以此為基準
  return Math.round(12000 * cabin * dist * day * (trip.adults || 1));
}

function baseHotelPrice(trip) {
  const checkIn = new Date((trip.hotelCheckIn || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
  const checkOut = new Date((trip.hotelCheckOut || new Date(checkIn.getTime() + 86_400_000).toISOString().slice(0, 10)) + 'T00:00:00Z');
  const nights = Math.max(1, Math.round((checkOut - checkIn) / 86_400_000));
  const day = dayFactor(trip.hotelCheckIn);
  // 每晚 3000 TWD 為基準 × 旺季 + 人數
  const perNight = Math.round(3000 * day * (trip.roomType === 'suite' ? 1.8 : trip.roomType === 'deluxe' ? 1.3 : 1.0));
  return { perNight, nights, total: perNight * nights };
}

function pseudoNoise(tripId, label, scale = 0.08) {
  // 0–1 的穩定偽亂數
  return (stableHash(`${tripId}|${label}`) % 10000) / 10000;
}

function seasonalTrend(tripId) {
  // 大尺度趨勢：30 天週期
  const t = Date.now() / 86_400_000;
  const phase = (stableHash(tripId) % 360) * Math.PI / 180;
  return 1 + 0.10 * Math.sin(t / 30 + phase);
}

async function fetchFlight(trip) {
  const base = baseFlightPrice(trip);
  const trend = seasonalTrend(trip.id);
  const noise = 1 + (pseudoNoise(trip.id, 'flight', 0.16) - 0.5) * 2 * 0.16; // ±16%
  const carrier = CARRIERS[stableHash(trip.id) % CARRIERS.length];
  const dest = AIRPORTS[(trip.destination || 'NRT').toUpperCase()];
  const origin = AIRPORTS[(trip.origin || 'TPE').toUpperCase()] || { name: trip.origin };
  const depart = trip.departDate ? new Date(trip.departDate + 'T08:00:00') : new Date(Date.now() + 7 * 86_400_000);
  const arrive = new Date(depart.getTime() + (3 + pseudoNoise(trip.id, 'dur', 1) * 8) * 3600 * 1000);
  const bestPrice = Math.round(base * trend * noise);
  const flights = [
    {
      carrier: `${carrier.code} · ${carrier.name}`,
      flightNo: `${carrier.code}${800 + stableHash(trip.id) % 100}`,
      departAt: depart.toISOString(),
      arriveAt: arrive.toISOString(),
      fromName: origin.name,
      toName: dest?.name || trip.destination,
      durationMin: Math.round((arrive - depart) / 60000),
      stops: pseudoNoise(trip.id, 'stops') < 0.7 ? 0 : 1,
      price: bestPrice,
      url: 'https://example.invalid/mock',
    },
    {
      carrier: `${CARRIERS[(stableHash(trip.id) + 1) % CARRIERS.length].code} · ${CARRIERS[(stableHash(trip.id) + 1) % CARRIERS.length].name}`,
      flightNo: `${CARRIERS[(stableHash(trip.id) + 1) % CARRIERS.length].code}${600 + stableHash(trip.id + 'b') % 200}`,
      departAt: new Date(depart.getTime() + 90 * 60 * 1000).toISOString(),
      arriveAt: new Date(arrive.getTime() + 30 * 60 * 1000).toISOString(),
      fromName: origin.name,
      toName: dest?.name || trip.destination,
      durationMin: Math.round((arrive - depart) / 60000) + 30,
      stops: 1,
      price: Math.round(bestPrice * 1.18),
      url: 'https://example.invalid/mock',
    },
  ];
  return {
    provider: id,
    currency: trip.currency || 'TWD',
    flights,
    hotels: [],
    bestPrice,
    bestKind: 'flight',
    error: null,
    meta: { base, trend: trend.toFixed(3), noise: noise.toFixed(3) },
  };
}

async function fetchHotel(trip) {
  const { perNight, nights, total } = baseHotelPrice(trip);
  const trend = seasonalTrend(trip.id);
  const noise = 1 + (pseudoNoise(trip.id, 'hotel', 0.10) - 0.5) * 2 * 0.10;
  const bestTotal = Math.round(total * trend * noise);
  const bestPerNight = Math.round(bestTotal / nights);

  // 中心點：先看 trip.hotelLat/Lng，否則用 CITY_DEFAULTS
  const cityKey = (trip.hotelCity || '').replace(/\s+/g, '');
  const fallback = CITY_DEFAULTS[cityKey] || CITY_DEFAULTS.Tokyo;
  const center = {
    lat: Number.isFinite(trip.hotelLat) ? trip.hotelLat : fallback.lat,
    lng: Number.isFinite(trip.hotelLng) ? trip.hotelLng : fallback.lng,
  };
  const radiusKm = Number.isFinite(trip.hotelRadiusKm) && trip.hotelRadiusKm > 0 ? trip.hotelRadiusKm : 3;

  // 為每個飯店加上 (lat, lng)，分佈在中心點周圍 +0.6×radius 內（避免貼邊）
  const maxOffsetDeg = (radiusKm * 0.6) / 111; // 1 度緯度 ≈ 111 km
  const hotels = HOTEL_BRANDS.slice(0, 5).map((b, i) => {
    const angle = pseudoNoise(trip.id, 'ang' + i) * Math.PI * 2;
    const dist = pseudoNoise(trip.id, 'dist' + i) * maxOffsetDeg;
    const lat = center.lat + Math.sin(angle) * dist;
    const lng = center.lng + Math.cos(angle) * dist / Math.max(0.2, Math.cos(center.lat * Math.PI / 180));
    const pricePerNight = Math.round(bestPerNight * (i === 0 ? 1.0 : i === 1 ? 0.92 : i === 2 ? 1.12 : i === 3 ? 0.85 : 1.05));
    const distanceFromCenter = haversineKm(center, { lat, lng });
    return {
      name: b.name,
      address: `${trip.hotelCity || 'City'} 中心 ${distanceFromCenter.toFixed(2)} km`,
      stars: b.stars,
      rating: 4 + pseudoNoise(trip.id, 'rating' + i) * 0.8,
      reviewCount: 800 + Math.floor(pseudoNoise(trip.id, 'rev' + i) * 4000),
      pricePerNight,
      totalPrice: pricePerNight * nights,
      currency: trip.currency || 'TWD',
      url: 'https://example.invalid/mock',
      lat,
      lng,
      distanceKm: Number(distanceFromCenter.toFixed(2)),
    };
  });
  // 過濾超出半徑的（極少數因為 lat/lng cos 修正）
  const inRange = hotels.filter((h) => h.distanceKm <= radiusKm);
  const visible = inRange.length ? inRange : hotels.slice(0, 3);

  return {
    provider: id,
    currency: trip.currency || 'TWD',
    flights: [],
    hotels: visible,
    bestPrice: Math.min(...visible.map((h) => h.totalPrice)),
    bestKind: 'hotel',
    error: null,
    meta: {
      perNight, nights, trend: trend.toFixed(3), noise: noise.toFixed(3),
      center, radiusKm, inRangeCount: inRange.length, total: hotels.length,
    },
  };
}

export default { id, label, capabilities, fetchFlight, fetchHotel };