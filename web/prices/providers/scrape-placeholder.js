// web/prices/providers/scrape-placeholder.js
// 真實爬蟲 / API 範例佔位。實作 fetchFlight / fetchHotel 後 registerProvider() 即可啟用。
// 預設 NOT EXPORTED，避免誤啟動尚未實作的 provider。
//
// 真實接入請參考：
//   - 機票：Amadeus Self-Service API（https://developers.amadeus.com/）、Skyscanner Partners
//   - 住宿：Booking.com Demand API、Hotels Combined
//   - 公開頁面：Google Flights / Hotels Combined；需注意 Cloudflare 'I'm Under Attack' 模式
//
// 介面合約見 providers/index.js 的 JSDoc。

export function registerScrapeProviders() {
  // TODO: 實作真實來源後可在此註冊。
}