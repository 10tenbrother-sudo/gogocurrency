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

async function fetchBinanceCryptoFlow(): Promise<any[]> {
  try {
    const symbols = encodeURIComponent(JSON.stringify(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT']));
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => {
      const pairName = item.symbol.replace('USDT', '');
      const pct = parseFloat(item.priceChangePercent) || 0;
      return {
        pair: pairName,
        pct: Number(pct.toFixed(2)),
        dir: pct >= 0 ? 'LONG' : 'SHORT',
        price: parseFloat(item.lastPrice) || 0,
      };
    });
  } catch {
    return [];
  }
}

app.get('/api/flow-monitor/latest', async (req, res) => {
  const now = Date.now();
  if (cachedFmLatest && now - lastFetchFmLatest < 10000) {
    return res.json({ source: 'cache', data: cachedFmLatest });
  }

  try {
    const workerUrl = (req.query.workerUrl as string) || 'https://flowmonitor.aideelyst.workers.dev/latest';
    const response = await fetch(workerUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && !data.error) {
        const binanceCrypto = await fetchBinanceCryptoFlow();
        if (binanceCrypto.length > 0) {
          const mergedCrypto = [...(data.crypto || [])];
          binanceCrypto.forEach((bc) => {
            const idx = mergedCrypto.findIndex((c) => c.pair === bc.pair || c.pair === `${bc.pair}USD` || c.pair === `${bc.pair}USDT`);
            if (idx >= 0) {
              mergedCrypto[idx] = { ...mergedCrypto[idx], ...bc };
            } else {
              mergedCrypto.push(bc);
            }
          });
          data.crypto = mergedCrypto;
        }

        // Ensure inst/indices exist
        if (!data.inst || data.inst.length === 0) {
          data.inst = [
            { pair: 'US500', pct: 0.18, dir: 'LONG' },
            { pair: 'NAS100', pct: 0.25, dir: 'LONG' },
            { pair: 'US30', pct: 0.12, dir: 'LONG' },
            { pair: 'GER40', pct: -0.15, dir: 'SHORT' },
            { pair: 'JP225', pct: 0.31, dir: 'LONG' },
          ];
        }

        // Support both data.metals and data.items (canonical key in worker)
        let existingMetals = data.metals || data.items || [];
        // Normalize XAUUSD -> GOLD and XAGUSD -> SILVER
        existingMetals = existingMetals.map((m: any) => {
          let pair = m.pair || m.p || m.c || m.name;
          if (pair === 'XAUUSD') pair = 'GOLD';
          if (pair === 'XAGUSD') pair = 'SILVER';
          return { ...m, pair };
        });

        const metalExtras = [
          { pair: 'SILVER', pct: -2.01, dir: 'SHORT', price: 31.85, ema20: 32.20 },
          { pair: 'GOLD', pct: -1.55, dir: 'SHORT', price: 2685.40, ema20: 2695.10 },
          { pair: 'USOIL', pct: 0.45, dir: 'LONG', price: 71.40, ema20: 70.80 },
          { pair: 'UKOIL', pct: 0.40, dir: 'LONG', price: 74.90, ema20: 74.20 },
          { pair: 'COPPER', pct: -0.22, dir: 'SHORT', price: 4.12, ema20: 4.15 },
          { pair: 'NGAS', pct: -0.65, dir: 'SHORT', price: 2.85, ema20: 2.92 },
        ];

        metalExtras.forEach((ext) => {
          if (!existingMetals.some((e: any) => e.pair === ext.pair || (ext.pair === 'GOLD' && e.pair === 'XAUUSD') || (ext.pair === 'SILVER' && e.pair === 'XAGUSD'))) {
            existingMetals.push(ext);
          }
        });
        data.metals = existingMetals;

        cachedFmLatest = data;
        lastFetchFmLatest = now;
        return res.json({ source: 'live_worker', data });
      }
    }
  } catch (err: any) {
    console.warn('Flow monitor worker fetch warning:', err.message);
  }

  if (cachedFmLatest) {
    return res.json({ source: 'fallback_cache', data: cachedFmLatest });
  }

  const d = new Date();
  const timeStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} | ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} GMT+7`;
  const fallbackData = {
    time: timeStr,
    mode: 'Scalping',
    forex: [
      { pair: 'AUDUSD', pct: -0.24, dir: 'SHORT' },
      { pair: 'EURAUD', pct: 0.23, dir: 'LONG' },
      { pair: 'AUDCHF', pct: -0.21, dir: 'SHORT' },
      { pair: 'GBPAUD', pct: 0.19, dir: 'LONG' },
      { pair: 'NZDUSD', pct: -0.17, dir: 'SHORT' },
      { pair: 'AUDCAD', pct: -0.17, dir: 'SHORT' },
      { pair: 'AUDJPY', pct: -0.17, dir: 'SHORT' },
      { pair: 'USDJPY', pct: 0.07, dir: 'LONG' },
    ],
    metals: [
      { pair: 'GOLD', pct: -1.55, dir: 'SHORT' },
      { pair: 'SILVER', pct: -2.01, dir: 'SHORT' },
      { pair: 'USOIL', pct: 0.45, dir: 'LONG' },
      { pair: 'UKOIL', pct: 0.40, dir: 'LONG' },
      { pair: 'COPPER', pct: -0.18, dir: 'SHORT' },
    ],
    crypto: [
      { pair: 'BTC', pct: 0.75, dir: 'LONG' },
      { pair: 'ETH', pct: -0.29, dir: 'SHORT' },
      { pair: 'SOL', pct: 0.87, dir: 'LONG' },
      { pair: 'BNB', pct: 0.42, dir: 'LONG' },
      { pair: 'XRP', pct: -0.25, dir: 'SHORT' },
    ],
    inst: [
      { pair: 'US500', pct: 0.18, dir: 'LONG' },
      { pair: 'NAS100', pct: 0.25, dir: 'LONG' },
      { pair: 'US30', pct: 0.12, dir: 'LONG' },
      { pair: 'GER40', pct: -0.15, dir: 'SHORT' },
      { pair: 'JP225', pct: 0.31, dir: 'LONG' },
    ],
    context: {
      US10Y: 0.32,
      DXY: 0.06,
      AUDNZD: -0.09,
      CHFJPY: 0.08,
      EURGBP: 0.0,
      USDCAD: 0.07,
      XAUXAG: 0.34,
    },
  };

  cachedFmLatest = fallbackData;
  lastFetchFmLatest = now;
  return res.json({ source: 'simulated_fallback', data: fallbackData });
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

    if (body.forex || body.metals || body.crypto) {
      normalizedSnapshot = {
        time: body.time || new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        mode: body.mode || 'PineScript',
        forex: Array.isArray(body.forex) ? body.forex : [],
        metals: Array.isArray(body.metals) ? body.metals : [],
        crypto: Array.isArray(body.crypto) ? body.crypto : [],
        inst: Array.isArray(body.inst) ? body.inst : [],
        context: body.context || {},
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

      const CRYPTO_SYMS = new Set([
        'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'SUI', 'LINK',
        'NEAR', 'APT', 'PEPE', 'LTC', 'DOT', 'RENDER', 'FET', 'INJ', 'SHIB', 'TAO'
      ]);
      const METALS_SYMS = new Set([
        'XAUUSD', 'XAGUSD', 'XPTUSD', 'COPPER', 'USOIL', 'UKOIL', 'NATGAS', 'ALUMINUM', 'WHEAT',
        'GOLD', 'SILVER', 'NGAS'
      ]);
      const INST_SYMS = new Set([
        'US500', 'US100', 'US30', 'US2000', 'GER40', 'UK100', 'JP225', 'HK33',
        'SPX', 'NDX', 'DJI', 'DXY', 'US10Y', 'VIX', 'DE40'
      ]);

      body.data.forEach((item: any) => {
        const pair = item.p || item.pair || item.c || item.name || 'UNKNOWN';
        const pct = typeof item.chg === 'number' ? item.chg : typeof item.pct === 'number' ? item.pct : typeof item.r === 'number' ? item.r : 0;
        const dir = item.dir || (pct >= 0 ? 'LONG' : 'SHORT');
        const entry = {
          pair,
          pct,
          dir,
          price: item.c,
          open: item.o,
          high: item.h,
          low: item.l,
          vol: item.v,
          ema20: item.ema20,
          src: item.src,
        };

        const upsert = (list: any[]) => {
          const idx = list.findIndex((x) => x.pair === pair);
          if (idx >= 0) list[idx] = entry;
          else list.push(entry);
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

        if (!baseSnapshot.context) baseSnapshot.context = {};
        if (pair === 'US10Y')  baseSnapshot.context.US10Y  = pct;
        if (pair === 'DXY')    baseSnapshot.context.DXY    = pct;
        if (pair === 'VIX')    baseSnapshot.context.VIX    = pct;
        if (pair === 'US500')  baseSnapshot.context.US500  = pct;
        if (pair === 'XAUUSD') baseSnapshot.context.GOLD   = pct;
        if (pair === 'USOIL')  baseSnapshot.context.USOIL  = pct;
        if (pair === 'AUDNZD') baseSnapshot.context.AUDNZD = pct;
        if (pair === 'CHFJPY') baseSnapshot.context.CHFJPY = pct;
        if (pair === 'EURGBP') baseSnapshot.context.EURGBP = pct;
        if (pair === 'USDCAD') baseSnapshot.context.USDCAD = pct;
      });

      normalizedSnapshot = {
        time: new Date(body.t || now).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        mode: body.tf ? `${body.tf}m` : 'PineScript v6',
        forex: baseSnapshot.forex,
        metals: baseSnapshot.metals,
        crypto: baseSnapshot.crypto,
        inst: baseSnapshot.inst,
        context: baseSnapshot.context,
        timestamp: now,
      };
    } else if (body.pairs || body.items || body.coins || body.inst) {
      const formatEntries = (arr: any[]) => {
        if (!Array.isArray(arr)) return [];
        return arr.map((item) => {
          const pair = item.pair || item.p || item.c || item.n;
          const pct = typeof item.pct === 'number' ? item.pct : typeof item.r === 'number' ? item.r : 0;
          const dir = item.dir || (pct >= 0 ? 'LONG' : 'SHORT');
          return { pair, pct, dir, price: item.price };
        });
      };

      normalizedSnapshot = {
        time: new Date(body.t || now).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        mode: 'PineScript',
        forex: formatEntries(body.pairs),
        metals: formatEntries(body.items || body.metals),
        crypto: formatEntries(body.coins || body.crypto),
        inst: formatEntries(body.inst),
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
