/**
 * Service to fetch and synchronize authentic live data from currency-strength.com
 */
import { CurrencyCode, StrengthSnapshot } from '../types/forex';

export interface WebCurrencySeries {
  key: CurrencyCode;
  values: [number, number][]; // [timestampMs, relativeValue]
}

export interface LiveSourceResult {
  source: 'live' | 'cache' | 'fallback_cache';
  updatedAt: number;
  series: Record<CurrencyCode, [number, number][]>;
  snapshots: StrengthSnapshot[];
  latestRelative: Record<CurrencyCode, number>;
  latestScores: Record<CurrencyCode, number>;
}

export async function fetchLiveCurrencyStrengthWebData(range: '1d' | '2d' = '1d'): Promise<LiveSourceResult | null> {
  try {
    const res = await fetch(`/api/currency-strength-live?range=${range}&_=${Date.now()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch from API: ${res.status}`);
    }

    const payload = (await res.json()) as { data?: WebCurrencySeries[]; source?: string } | WebCurrencySeries[];
    const dataList: WebCurrencySeries[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.data)
      ? payload.data
      : [];
    const source: LiveSourceResult['source'] = !Array.isArray(payload) &&
      ['live', 'cache', 'fallback_cache'].includes(payload.source || '')
      ? (payload.source as LiveSourceResult['source'])
      : 'live';

    if (!Array.isArray(dataList) || dataList.length === 0) {
      return null;
    }

    const seriesMap: Record<CurrencyCode, [number, number][]> = {} as any;
    const latestRelative: Record<CurrencyCode, number> = {} as any;
    const latestScores: Record<CurrencyCode, number> = {} as any;

    dataList.forEach((item) => {
      const code = item.key as CurrencyCode;
      seriesMap[code] = item.values;
      if (item.values.length > 0) {
        const lastVal = item.values[item.values.length - 1][1];
        latestRelative[code] = Number(lastVal.toFixed(2));
        // Map relative divergence (-35..+35) to 0.00..10.00 scale (baseline 5.0)
        const mappedScore = Math.max(0.5, Math.min(9.8, Number((5.0 + lastVal / 7.0).toFixed(2))));
        latestScores[code] = mappedScore;
      }
    });

    // Build timeline snapshots
    const firstSeries = dataList[0]?.values || [];
    const snapshots: StrengthSnapshot[] = firstSeries.map(([ts], idx) => {
      const date = new Date(ts);
      // Format time string as "HH:MM" (e.g. 04:00, 14:55) matching currency-strength.com
      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      const scores: Record<CurrencyCode, number> = {} as any;
      dataList.forEach((item) => {
        const code = item.key as CurrencyCode;
        const val = item.values[idx] ? item.values[idx][1] : 0;
        scores[code] = Math.max(0.5, Math.min(9.8, Number((5.0 + val / 7.0).toFixed(2))));
      });

      return {
        timestamp: ts,
        timeString,
        scores,
      };
    });

    return {
      source,
      updatedAt: Date.now(),
      series: seriesMap,
      snapshots,
      latestRelative,
      latestScores,
    };
  } catch (err) {
    console.warn('Could not fetch real currency-strength.com data:', err);
    return null;
  }
}
