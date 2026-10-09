// web/prices/router.js
// 對外 router，把 /prices/* 全部路由集中在這。
import express from 'express';
import {
  listTrips, getTrip, upsertTrip, deleteTrip,
  appendHistory, getHistory, summarizeTrip, pickCheapest,
  priceStats, evaluateBelowAverage,
  recordFetch, recordAlert, shouldAlert, daysUntil,
} from './data.js';
import { resolveProviders, listProviders } from './providers/index.js';
import { notifyPriceAlert } from './notify.js';

export function createPricesRouter() {
  const router = express.Router();

  router.use(express.urlencoded({ extended: false, limit: '32kb' }));

  // ---- 頁面 ------------------------------------------------------------
  router.get('/', (req, res) => {
    const trips = listTrips();
    const summaries = trips.map(summarizeTrip);
    res.render('prices/index', {
      title: '價格監控',
      trips: summaries,
      providers: listProviders(),
    });
  });

  router.get('/new', (req, res) => {
    res.render('prices/form', {
      title: '新增追蹤',
      mode: 'new',
      trip: defaultTrip(req.query.kind),
      error: null,
      providers: listProviders(),
      injectPricesMap: (req.query.kind === 'hotel'),
    });
  });

  router.post('/new', (req, res) => {
    try {
      const trip = upsertTrip({ ...req.body });
      res.redirect(`/prices/trip/${trip.id}`);
    } catch (err) {
      res.status(400).render('prices/form', {
        title: '新增追蹤',
        mode: 'new',
        trip: { ...defaultTrip(req.query.kind), ...req.body },
        error: err.message,
        providers: listProviders(),
        injectPricesMap: (req.query.kind === 'hotel'),
      });
    }
  });

  router.get('/trip/:id', (req, res) => {
    const summary = summarizeTrip(getTrip(req.params.id));
    if (!summary) return res.status(404).render('empty', { title: '找不到追蹤', message: '此 trip 不存在' });
    res.render('prices/trip', {
      title: summary.trip.name,
      summary,
      history: getHistory(summary.trip.id),
      providers: listProviders(),
      injectPricesMap: summary.trip.kind === 'hotel',
    });
  });

  router.get('/trip/:id/edit', (req, res) => {
    const trip = getTrip(req.params.id);
    if (!trip) return res.status(404).render('empty', { title: '找不到', message: '此 trip 不存在' });
    res.render('prices/form', {
      title: `編輯 · ${trip.name}`,
      mode: 'edit',
      trip,
      error: null,
      providers: listProviders(),
      injectPricesMap: trip.kind === 'hotel',
    });
  });

  router.post('/trip/:id/edit', (req, res) => {
    try {
      const trip = upsertTrip({ ...req.body, id: req.params.id });
      res.redirect(`/prices/trip/${trip.id}`);
    } catch (err) {
      const trip = getTrip(req.params.id) || { ...req.body, id: req.params.id };
      res.status(400).render('prices/form', {
        title: '編輯',
        mode: 'edit',
        trip: { ...trip, ...req.body },
        error: err.message,
        providers: listProviders(),
        injectPricesMap: (trip.kind === 'hotel'),
      });
    }
  });

  router.post('/trip/:id/delete', (req, res) => {
    deleteTrip(req.params.id);
    res.redirect('/prices');
  });

  router.post('/trip/:id/fetch', async (req, res) => {
    const trip = getTrip(req.params.id);
    if (!trip) return res.status(404).render('empty', { title: '找不到', message: '此 trip 不存在' });
    const result = await runFetchForTrip(trip);
    res.redirect(`/prices/trip/${trip.id}${result.queued ? '' : '?fresh=1'}`);
  });

  // ---- API -------------------------------------------------------------
  router.get('/api/trips', (req, res) => {
    res.json({ trips: listTrips().map(summarizeTrip) });
  });

  router.get('/api/trips/:id', (req, res) => {
    const summary = summarizeTrip(getTrip(req.params.id));
    if (!summary) return res.status(404).json({ error: 'not found' });
    res.json(summary);
  });

  router.get('/api/trips/:id/history', (req, res) => {
    if (!getTrip(req.params.id)) return res.status(404).json({ error: 'not found' });
    res.json({ tripId: req.params.id, points: getHistory(req.params.id) });
  });

  router.get('/api/trips/:id/history.csv', (req, res) => {
    if (!getTrip(req.params.id)) return res.status(404).end();
    const points = getHistory(req.params.id);
    const header = 'capturedAt,provider,kind,bestPrice,currency';
    const rows = points.map((p) => [p.capturedAt, p.provider || '', p.bestKind || '', p.bestPrice ?? '', p.currency || ''].join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="price-history-${req.params.id}.csv"`);
    res.send([header, ...rows].join('\n'));
  });

  router.get('/api/providers', (req, res) => {
    res.json({ providers: listProviders() });
  });

  return router;
}

// ---- 共用 -----------------------------------------------------------------

export async function runFetchForTrip(trip) {
  const providers = resolveProviders(trip.providers);
  const now = new Date().toISOString();
  let snapshot = null;
  let lastErr = null;
  for (const p of providers) {
    try {
      const data = trip.kind === 'flight' ? await p.fetchFlight(trip) : await p.fetchHotel(trip);
      if (data?.error) { lastErr = `${p.id}: ${data.error}`; continue; }
      snapshot = { ...data, capturedAt: now, tripId: trip.id };
      break;
    } catch (err) {
      lastErr = `${p.id}: ${err.message}`;
    }
  }
  if (!snapshot) {
    snapshot = { tripId: trip.id, capturedAt: now, provider: providers[0]?.id || 'mock', bestPrice: null, error: lastErr || 'no provider' };
  }
  appendHistory(trip.id, snapshot);
  recordFetch(trip.id, now);

  // 重新讀歷史（剛 append 進去的那筆也要算）
  const history = getHistory(trip.id);
  const mode = trip.alertMode || 'both';
  const decisions = [];

  // 規則 A：低於歷史平均（冷啟動保護：至少 3 筆才參考）
  if (mode === 'below-average' || mode === 'both') {
    const ev = evaluateBelowAverage(snapshot, history, { requireSamples: 3, ratioThreshold: 0.95 });
    if (ev?.shouldAlert) decisions.push({ ...ev, alertKey: 'avg' });
  }

  // 規則 B：低於用戶設的門檻
  if (mode === 'threshold' || mode === 'both') {
    if (Number.isFinite(snapshot.bestPrice) && Number.isFinite(trip.threshold) && snapshot.bestPrice <= trip.threshold) {
      decisions.push({
        kind: 'below-threshold',
        shouldAlert: true,
        threshold: trip.threshold,
        reason: `低於門檻 ${trip.currency || 'TWD'} ${Math.round(trip.threshold).toLocaleString('zh-Hant')}`,
        alertKey: 'thr',
      });
    }
  }

  // 去重後發通知
  for (const d of decisions) {
    const thresholdHash = `${d.alertKey}|${mode}|${trip.kind}|${providers.map((p) => p.id).join(',')}`;
    if (shouldAlert(trip.id, thresholdHash)) {
      await notifyPriceAlert({ trip, snapshot, decision: d, mode });
      recordAlert(trip.id, thresholdHash, now);
    }
  }
  return { snapshot, queued: true, decisions };
}

function defaultTrip(kindFromQuery) {
  const kind = kindFromQuery === 'hotel' ? 'hotel' : 'flight';
  const base = {
    kind,
    name: '',
    currency: 'TWD',
    providers: ['mock'],
    adults: 1,
    threshold: '',
    notes: '',
  };
  if (kind === 'flight') {
    return { ...base, origin: 'TPE', destination: 'NRT', departDate: '', returnDate: '', cabinClass: 'economy' };
  }
  return { ...base, hotelCity: 'Tokyo', hotelCheckIn: '', hotelCheckOut: '', roomType: 'standard' };
}