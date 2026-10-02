import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '2mb' }));

// In-memory cache for live currency strength data
let cached1d: any = null;
let lastFetch1d = 0;

let cached2d: any = null;
let lastFetch2d = 0;

app.get('/api/currency-strength-live', async (req, res) => {
  const is2d = req.query.range === '2d';
  const now = Date.now();

  if (is2d && cached2d && now - lastFetch2d < 15000) {
    return res.json({ source: 'cache', data: cached2d });
  }
  if (!is2d && cached1d && now - lastFetch1d < 15000) {
    return res.json({ source: 'cache', data: cached1d });
  }

  const endpoint = is2d ? 'chart2d.json' : 'chart1d.json';

  try {
    const targetUrl = `https://currency-strength.com/php/${endpoint}?id=${now}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://currency-strength.com/en/',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }

    const data = await response.json();
    if (is2d) {
      cached2d = data;
      lastFetch2d = now;
    } else {
      cached1d = data;
      lastFetch1d = now;
    }

    return res.json({ source: 'live', data });
  } catch (err: any) {
    const fallback = is2d ? cached2d : cached1d;
    if (fallback) {
      return res.json({ source: 'fallback_cache', data: fallback });
    }
    return res
      .status(502)
      .json({ error: 'Failed to fetch currency-strength data', message: err.message });
  }
});

// Flow Monitor proxy cache
let cachedFmLatest: any = null;
let lastFetchFmLatest = 0;
let cachedFmHistory: any = null;
let lastFetchFmHistory = 0;

app.get('/api/flow-monitor/latest', async (req, res) => {
  const now = Date.now();
  if (cachedFmLatest && now - lastFetchFmLatest < 10000) {
    return res.json({ source: 'cache', data: cachedFmLatest });
  }

  try {
    const workerUrl = (req.query.workerUrl as string) || 'https://flowmonitor.aideelyst.workers.dev/latest';
    const workerRes = await fetch(workerUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    let data: any = null;
    if (workerRes && workerRes.ok) {
      data = await workerRes.json().catch(() => null);
    }

    if (data && !data.error) {
      const normPair = (raw: string) => {
        if (!raw) return 'UNKNOWN';
        const s = String(raw).toUpperCase().trim();
        if (s === 'XAUUSD' || s === 'GOLD') return 'GOLD';
        if (s === 'XAGUSD' || s === 'SILVER') return 'SILVER';
        if (s === 'SPX500USD' || s === 'SPX' || s === 'US500') return 'US500';
        if (s === 'NAS100USD' || s === 'NDX' || s === 'US100' || s === 'NAS100') return 'NAS100';
        if (s === 'US30USD' || s === 'DJI' || s === 'US30') return 'US30';
        if (s === 'DE40EUR' || s === 'DAX' || s === 'GER40') return 'GER40';
        if (s === 'JP225USD' || s === 'NI225' || s === 'JP225') return 'JP225';
        return s;
      };

      // Normalize metals if provided by worker (top 5)
      if (data.metals || data.items) {
        let existingMetals = data.metals || data.items || [];
        data.metals = existingMetals.map((m: any) => {
          let pair = normPair(m.pair || m.p || m.c || m.name);
          return { ...m, pair };
        }).slice(0, 5);
      }

      // Top 5 crypto
      if (data.crypto || data.coins) {
        let existingCrypto = data.crypto || data.coins || [];
        data.crypto = existingCrypto.map((c: any) => {
          let pair = normPair(c.pair || c.p || c.c || c.name);
          return { ...c, pair };
        }).slice(0, 5);
      }

      // Top 5 indices
      if (data.inst || data.indices) {
        let existingInst = data.inst || data.indices || [];
        data.inst = existingInst.map((i: any) => {
          let pair = normPair(i.pair || i.p || i.c || i.name);
          return { ...i, pair };
        }).slice(0, 5);
      }

      // DO NOT fabricate fake data. Keep only authentic lists sent by the webhook/worker.
      data.forex = Array.isArray(data.forex) ? data.forex : [];
      data.metals = Array.isArray(data.metals) ? data.metals : [];
      data.crypto = Array.isArray(data.crypto) ? data.crypto : [];
      data.inst = Array.isArray(data.inst) ? data.inst : [];

      cachedFmLatest = data;
      lastFetchFmLatest = now;
      return res.json({ source: 'live_worker', data });
    }
  } catch (err: any) {
    console.warn('Flow monitor worker fetch warning:', err.message);
  }

  // If a direct webhook was posted to this server, use that
  if (cachedFmLatest) {
    return res.json({ source: 'cached_webhook', data: cachedFmLatest });
  }

  // DO NOT fabricate dummy data. Return null data so user UI displays honest empty/offline state.
  return res.json({
    source: 'no_data',
    data: null,
    message: 'Belum ada data dari Webhook TradingView / Cloudflare Worker. Tidak ada data dummy yang ditampilkan.',
  });
});

app.get('/api/flow-monitor/history', async (req, res) => {
  const now = Date.now();
  if (cachedFmHistory && now - lastFetchFmHistory < 15000) {
    return res.json({ source: 'cache', data: cachedFmHistory });
  }

  try {
    const workerUrl = (req.query.workerUrl as string) || 'https://flowmonitor.aideelyst.workers.dev/history';
    const response = await fetch(workerUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        cachedFmHistory = data;
        lastFetchFmHistory = now;
        return res.json({ source: 'live_worker', data });
      }
    }
  } catch (err: any) {
    console.warn('Flow monitor history worker fetch error:', err.message);
  }

  if (cachedFmHistory) {
    return res.json({ source: 'fallback_cache', data: cachedFmHistory });
  }

  return res.json({ source: 'empty', data: [] });
});

// POST /api/flow-monitor/webhook & POST /fm - Webhook from TradingView or Cloudflare Worker
app.post(['/api/flow-monitor/webhook', '/fm'], (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Payload JSON required' });
    }

    const now = Date.now();
    let normalizedSnapshot: any = null;

    const normItem = (item: any) => {
      let pair = item.pair || item.p || item.c || item.name || 'UNKNOWN';
      if (pair === 'XAUUSD') pair = 'GOLD';
      if (pair === 'XAGUSD') pair = 'SILVER';
      if (pair === 'SPX500USD') pair = 'US500';
      if (pair === 'NAS100USD') pair = 'NAS100';
      if (pair === 'US30USD') pair = 'US30';
      if (pair === 'DE40EUR') pair = 'GER40';
      if (pair === 'JP225USD') pair = 'JP225';
      const pct = typeof item.pct === 'number' ? item.pct : typeof item.chg === 'number' ? item.chg : typeof item.r === 'number' ? item.r : 0;
      const dir = item.dir || (pct >= 0 ? 'LONG' : 'SHORT');
      return { pair, pct, dir, price: item.price ?? item.c };
    };

    if (body.forex || body.metals || body.crypto || body.inst) {
      const existing = cachedFmLatest ? { ...cachedFmLatest } : { forex: [], metals: [], crypto: [], inst: [], context: {} };

      const newMetals = Array.isArray(body.metals) ? body.metals.map(normItem).slice(0, 5) : existing.metals;
      const newCrypto = Array.isArray(body.crypto) ? body.crypto.map(normItem).slice(0, 5) : existing.crypto;
      const newInst = Array.isArray(body.inst) ? body.inst.map(normItem).slice(0, 5) : existing.inst;
      const newForex = Array.isArray(body.forex) ? body.forex.map(normItem) : existing.forex;

      normalizedSnapshot = {
        time: body.time || new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        mode: body.mode || 'PineScript 15 Prime',
        forex: newForex,
        metals: newMetals,
        crypto: newCrypto,
        inst: newInst,
        context: { ...(existing.context || {}), ...(body.context || {}) },
        timestamp: now,
      };
    } else if (body.data && Array.isArray(body.data)) {
      const baseSnapshot = cachedFmLatest ? JSON.parse(JSON.stringify(cachedFmLatest)) : {
        forex: [],
        metals: [],
        crypto: [],
        inst: [],
        context: {},
      };

      const CRYPTO_SYMS = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA']);
      const METALS_SYMS = new Set(['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'NATGAS', 'GOLD', 'SILVER']);
      const INST_SYMS = new Set(['US500', 'NAS100', 'US100', 'US30', 'GER40', 'JP225']);

      body.data.forEach((item: any) => {
        const normed = normItem(item);
        const pair = normed.pair;

        const upsert = (list: any[]) => {
          const idx = list.findIndex((x) => x.pair === pair);
          if (idx >= 0) list[idx] = normed;
          else list.push(normed);
        };

        if (body.cat === 'crypto' || CRYPTO_SYMS.has(pair)) {
          upsert(baseSnapshot.crypto);
        } else if (body.cat === 'metals' || body.cat === 'commodities' || METALS_SYMS.has(pair)) {
          upsert(baseSnapshot.metals);
        } else if (body.cat === 'macro' || body.cat === 'inst' || body.cat === 'indices' || INST_SYMS.has(pair)) {
          upsert(baseSnapshot.inst);
        } else {
          upsert(baseSnapshot.forex);
        }
      });

      normalizedSnapshot = {
        time: new Date(body.t || now).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        mode: body.tf ? `${body.tf}m` : 'PineScript 15 Prime',
        forex: baseSnapshot.forex,
        metals: (baseSnapshot.metals || []).slice(0, 5),
        crypto: (baseSnapshot.crypto || []).slice(0, 5),
        inst: (baseSnapshot.inst || []).slice(0, 5),
        context: baseSnapshot.context,
        timestamp: now,
      };
    } else if (body.pairs || body.items || body.coins || body.inst) {
      const formatEntries = (arr: any[]) => {
        if (!Array.isArray(arr)) return [];
        return arr.map(normItem);
      };

      normalizedSnapshot = {
        time: new Date(body.t || now).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        mode: 'PineScript 15 Prime',
        forex: formatEntries(body.pairs),
        metals: formatEntries(body.items || body.metals).slice(0, 5),
        crypto: formatEntries(body.coins || body.crypto).slice(0, 5),
        inst: formatEntries(body.inst).slice(0, 5),
        context: body.context || {},
        timestamp: now,
      };
    }

    if (normalizedSnapshot) {
      cachedFmLatest = normalizedSnapshot;
      lastFetchFmLatest = now;

      if (!cachedFmHistory) cachedFmHistory = [];
      cachedFmHistory.push(normalizedSnapshot);
      if (cachedFmHistory.length > 50) cachedFmHistory = cachedFmHistory.slice(-50);

      return res.json({ ok: true, saved: true, timestamp: now });
    }

    return res.status(400).json({
      error: 'Unrecognized format. Expected forex/metals/crypto or pairs/items/coins/inst',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Webhook processing error', message: err.message });
  }
});

// POST /api/flow-monitor/test-connection - Test user's Cloudflare Worker URL
app.post('/api/flow-monitor/test-connection', async (req, res) => {
  const { workerUrl, token } = req.body || {};
  if (!workerUrl || typeof workerUrl !== 'string') {
    return res.status(400).json({ ok: false, error: 'Worker URL required' });
  }

  const cleanUrl = workerUrl.trim().replace(/\/+$/, '');
  const startTime = Date.now();

  try {
    let testRes = await fetch(`${cleanUrl}/latest`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (testRes.ok) {
      const data = await testRes.json();
      const latencyMs = Date.now() - startTime;
      return res.json({
        ok: true,
        endpointUsed: `${cleanUrl}/latest`,
        latencyMs,
        format: 'kael_dashboard',
        sample: {
          time: data.time,
          forexCount: Array.isArray(data.forex) ? data.forex.length : 0,
          metalsCount: Array.isArray(data.metals) ? data.metals.length : 0,
          cryptoCount: Array.isArray(data.crypto) ? data.crypto.length : 0,
          contextKeys: data.context ? Object.keys(data.context) : [],
        },
      });
    }

    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    testRes = await fetch(`${cleanUrl}/fm/all${tokenParam}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (testRes.ok) {
      const data = await testRes.json();
      const latencyMs = Date.now() - startTime;
      return res.json({
        ok: true,
        endpointUsed: `${cleanUrl}/fm/all`,
        latencyMs,
        format: 'flow_monitor_multi_asset',
        sample: {
          assetKeys: Object.keys(data),
        },
      });
    }

    testRes = await fetch(cleanUrl, {
      signal: AbortSignal.timeout(6000),
    });
    const text = await testRes.text();
    return res.json({
      ok: true,
      endpointUsed: cleanUrl,
      latencyMs: Date.now() - startTime,
      format: 'generic_worker',
      note: 'Worker merespons (status ' + testRes.status + ')',
      rawSample: text.slice(0, 150),
    });
  } catch (err: any) {
    return res.json({
      ok: false,
      error: `Gagal menghubungi worker: ${err.message}`,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
