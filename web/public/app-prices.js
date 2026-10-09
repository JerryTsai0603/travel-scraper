// web/public/app-prices.js
// Leaflet 地圖互動：飯店追蹤表單的「中心 + 半徑」選擇器 + trip 詳情頁飯店位置圖。
// 依賴 Leaflet 1.9.x（CDN, 由 layout 注入）。
(function () {
  'use strict';

  // ---- 表單頁：地圖挑選中心 + 半徑 ----
  function initPicker() {
    const mapEl = document.getElementById('mapPicker');
    if (!mapEl || typeof L === 'undefined') return;

    const latEl = document.getElementById('hotelLat');
    const lngEl = document.getElementById('hotelLng');
    const radEl = document.getElementById('hotelRadiusKm');
    const radSlider = document.getElementById('hotelRadiusSlider');
    const radReadout = document.getElementById('hotelRadiusReadout');
    const resetBtn = document.getElementById('mapResetBtn');

    // 城市 → 預設座標（與 mock provider 的 CITY_DEFAULTS 對齊；找不到就 Tokyo）
    const CITY_DEFAULTS = {
      Tokyo: { lat: 35.6895, lng: 139.6917 },
      Osaka: { lat: 34.6937, lng: 135.5023 },
      Kyoto: { lat: 35.0116, lng: 135.7681 },
      Seoul: { lat: 37.5665, lng: 126.9780 },
      Taipei: { lat: 25.0330, lng: 121.5654 },
      Taichung: { lat: 24.1477, lng: 120.6736 },
      Kaohsiung: { lat: 22.6273, lng: 120.3014 },
      HongKong: { lat: 22.3193, lng: 114.1694 },
      Singapore: { lat: 1.3521, lng: 103.8198 },
      Bangkok: { lat: 13.7563, lng: 100.5018 },
    };

    const initialRadius = parseFloat(radEl.value) || 3;
    let center = {
      lat: parseFloat(latEl.value),
      lng: parseFloat(lngEl.value),
    };
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
      const cityKey = (document.querySelector('[name="hotelCity"]')?.value || '').replace(/\s+/g, '');
      const fb = CITY_DEFAULTS[cityKey] || CITY_DEFAULTS.Tokyo;
      center = { lat: fb.lat, lng: fb.lng };
    }

    const map = L.map(mapEl, { zoomControl: true }).setView([center.lat, center.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([center.lat, center.lng], { draggable: true }).addTo(map);
    const circle = L.circle([center.lat, center.lng], {
      radius: initialRadius * 1000,
      color: '#ff6f91',
      weight: 2,
      fillColor: '#ff6f91',
      fillOpacity: 0.10,
    }).addTo(map);

    function syncInputs(latlng, radiusKm) {
      latEl.value = latlng.lat.toFixed(6);
      lngEl.value = latlng.lng.toFixed(6);
      if (typeof radiusKm === 'number') {
        radEl.value = radiusKm.toFixed(1);
        radSlider.value = radiusKm.toFixed(1);
        radReadout.textContent = radiusKm.toFixed(1);
      }
    }
    function refreshCircle() {
      const r = parseFloat(radEl.value) || 3;
      circle.setLatLng(marker.getLatLng());
      circle.setRadius(r * 1000);
    }

    marker.on('drag', function () {
      const ll = marker.getLatLng();
      syncInputs(ll, undefined);
      refreshCircle();
    });
    marker.on('dragend', function () { map.panTo(marker.getLatLng()); });

    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      syncInputs(e.latlng, parseFloat(radEl.value));
      refreshCircle();
    });

    radSlider.addEventListener('input', function () {
      const v = parseFloat(radSlider.value);
      syncInputs(marker.getLatLng(), v);
      refreshCircle();
    });

    resetBtn.addEventListener('click', function () {
      const cityKey = (document.querySelector('[name="hotelCity"]')?.value || '').replace(/\s+/g, '');
      const fb = CITY_DEFAULTS[cityKey] || CITY_DEFAULTS.Tokyo;
      marker.setLatLng([fb.lat, fb.lng]);
      map.setView([fb.lat, fb.lng], 12);
      syncInputs({ lat: fb.lat, lng: fb.lng }, 3);
      refreshCircle();
    });

    // 城市輸入變更時，若中心還沒設過，自動跟著
    const cityInput = document.querySelector('[name="hotelCity"]');
    if (cityInput) {
      cityInput.addEventListener('change', function () {
        const v = (cityInput.value || '').replace(/\s+/g, '');
        const fb = CITY_DEFAULTS[v];
        if (!fb) return;
        // 若當前中心是某個 city 預設，就允許跟著換；若是自訂座標就不動
        const current = { lat: parseFloat(latEl.value), lng: parseFloat(lngEl.value) };
        const isAnyDefault = Object.values(CITY_DEFAULTS).some((d) => Math.abs(d.lat - current.lat) < 0.01 && Math.abs(d.lng - current.lng) < 0.01);
        if (!Number.isFinite(current.lat) || isAnyDefault) {
          marker.setLatLng([fb.lat, fb.lng]);
          map.setView([fb.lat, fb.lng], 12);
          syncInputs({ lat: fb.lat, lng: fb.lng }, parseFloat(radEl.value) || 3);
          refreshCircle();
        }
      });
    }
  }

  // ---- 詳情頁：顯示飯店位置 + 中心 + 半徑 ----
  async function initHotelMap() {
    const el = document.getElementById('hotelMap');
    if (!el || typeof L === 'undefined') return;
    const center = { lat: parseFloat(el.dataset.lat), lng: parseFloat(el.dataset.lng) };
    const radiusKm = parseFloat(el.dataset.radius);
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;

    const map = L.map(el, { scrollWheelZoom: false }).setView([center.lat, center.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: '#ff6f91', weight: 2, fillColor: '#ff6f91', fillOpacity: 0.10,
    }).addTo(map);
    L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: 'center-pin',
        html: '📍',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map).bindPopup(`<b>搜尋中心</b><br>${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}<br>半徑 ${radiusKm} km`);

    // 從伺服器取飯店清單
    const tripId = (location.pathname.match(/\/trip\/([^/]+)/) || [])[1];
    if (!tripId) return;
    try {
      const res = await fetch(`/prices/api/trips/${tripId}/history`);
      if (!res.ok) return;
      const { points } = await res.json();
      const latest = (points || []).filter((p) => Array.isArray(p.hotels) && p.hotels.length).pop();
      if (!latest) return;
      const hotels = latest.hotels.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
      if (!hotels.length) return;
      hotels.forEach((h) => {
        const fmt = (n) => new Intl.NumberFormat('zh-Hant').format(Math.round(n));
        const icon = L.divIcon({
          className: 'hotel-pin',
          html: `<div class="hotel-pin-price">${fmt(h.totalPrice)}</div>`,
          iconSize: [56, 22],
          iconAnchor: [28, 11],
        });
        L.marker([h.lat, h.lng], { icon }).addTo(map).bindPopup(
          `<b>${h.name}</b><br>${fmt(h.pricePerNight)} / 晚，共 ${fmt(h.totalPrice)}<br>距離中心 ${h.distanceKm ?? '?'} km`
        );
      });
      // 自適應 bounds（包含所有飯店）
      const bounds = L.latLngBounds([[center.lat, center.lng], ...hotels.map((h) => [h.lat, h.lng])]);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } catch (e) { /* noop */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initPicker(); initHotelMap(); });
  } else {
    initPicker();
    initHotelMap();
  }
})();