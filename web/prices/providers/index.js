// web/prices/providers/index.js
// Adapter registry. 任何真實來源（Skyscanner、Amadeus、Google Flights、Booking 等）
// 都只要實作 { id, label, async fetchFlight(trip), async fetchHotel(trip) }。
import mock from './mock.js';

const REGISTRY = new Map();
REGISTRY.set(mock.id, mock);

export function listProviders() {
  return [...REGISTRY.values()].map((p) => ({ id: p.id, label: p.label, capabilities: p.capabilities }));
}

export function getProvider(id) {
  return REGISTRY.get(id) || null;
}

export function registerProvider(provider) {
  if (!provider?.id) throw new Error('provider.id 必填');
  REGISTRY.set(provider.id, provider);
}

export function resolveProviders(ids) {
  const list = (ids && ids.length) ? ids : ['mock'];
  return list.map((id) => {
    const p = REGISTRY.get(id);
    if (!p) throw new Error(`provider ${id} 未註冊`);
    return p;
  });
}

// 每個 provider 必須遵守：fetchFlight / fetchHotel 回傳 snapshot 物件
//   {
//     provider: string,
//     currency: string,
//     flights: [{ carrier, flightNo, departAt, arriveAt, durationMin, stops, price, url }],
//     hotels:  [{ name, address, rating, reviewCount, pricePerNight, totalPrice, currency, url }],
//     bestPrice: number,            // 該次抓取最低機票或住宿總價
//     bestKind: 'flight'|'hotel',
//     error: string | null
//   }
// 若完全取不到資料，請回傳 { ..., flights: [], hotels: [], bestPrice: null, error: '原因' }