import { ETF_ASSETS } from '@/lib/asset-classifier';
import { searchUsUniverse } from '@/lib/us-universe';
import { AssetCategory, AssetSnapshot, ChartPoint, DailyBar, LiveQuote, SearchResult } from '@/lib/types';

const QUOTE_URL = 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?type=ALLBUT0999&response=json';
const CORE_TICKERS = new Set(ETF_ASSETS.map((asset) => asset.ticker));
const CATEGORY_KEYWORDS: Array<{ category: AssetCategory; keywords: string[] }> = [
  { category: 'growth', keywords: ['增長', '成長', 'growth', '台股增長'] },
  { category: 'high_dividend', keywords: ['高息', '高股息', 'dividend', '收益'] },
  { category: 'balanced', keywords: ['優選', '平衡', '豐收', 'balanced', '配置'] },
];

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  const clean = String(value).replace(/,/g, '').replace(/--/g, '0').trim();
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://mis.twse.com.tw/stock/index.jsp'
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`TWSE request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchQuotes(specificTickers?: string[]): Promise<Record<string, LiveQuote>> {
  // If specificTickers is provided and not empty, use realtime API
  if (specificTickers && specificTickers.length > 0 && specificTickers.length < 100) {
    const exChs = specificTickers.map(t => {
      const clean = t.toUpperCase().replace('.TW', '').replace('^', '');
      if (clean === 'TWII' || clean === 'T00') return 'tse_t00.tw';
      return `tse_${clean}.tw|otc_${clean}.tw`;
    }).join('|');

  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exChs}&json=1&delay=0&_=${Date.now()}`;
    try {
      const payload = await fetchJson<{ msgArray?: Record<string, string>[] }>(url);
      const quotes: Record<string, LiveQuote> = {};
      
      for (const msg of payload.msgArray ?? []) {
        const tickerCode = msg.c;
        if (!tickerCode) continue;
        
        const close = parseNumber(msg.z);
        const prevClose = parseNumber(msg.y);
        const finalPrice = close > 0 ? close : (prevClose > 0 ? prevClose : 0);
        
        const matchedInput = specificTickers.find(t => t.toUpperCase().includes(tickerCode.toUpperCase()));
        const key = matchedInput || tickerCode.toUpperCase();
        
        quotes[key] = {
          ticker: key,
          name: msg.n || tickerCode,
          market: 'TW',
          volume: parseNumber(msg.v),
          open: parseNumber(msg.o),
          high: parseNumber(msg.h),
          low: parseNumber(msg.l),
          close: finalPrice,
          change: finalPrice - prevClose,
        };
      }
      return quotes;
    } catch (err) {
      console.error('Realtime fetch failed, falling back to MI_INDEX', err);
    }
  }

  // Bulk fetch from MI_INDEX
  const payload = await fetchJson<{ tables?: Array<{ fields?: string[]; data?: string[][] }> }>(QUOTE_URL);
  const quotes: Record<string, LiveQuote> = {};

  for (const table of payload.tables ?? []) {
    const fields = table.fields ?? [];
    if (!fields.includes('證券代號')) continue;

    for (const row of table.data ?? []) {
      const ticker = row[0];
      const isCore = CORE_TICKERS.has(ticker);
      const isSearchCandidate = /^[0-9A-Z]{4,10}$/.test(ticker);
      if (!isCore && !isSearchCandidate) continue;

      const close = parseNumber(row[8]);
      const change = parseNumber(row[10]);
      const sign = row[9]?.includes('green') ? -1 : row[9]?.includes('red') ? 1 : 0;
      quotes[ticker] = {
        ticker,
        name: row[1],
        market: 'TW',
        volume: parseNumber(row[2]),
        open: parseNumber(row[5]),
        high: parseNumber(row[6]),
        low: parseNumber(row[7]),
        close,
        change: sign === 0 ? 0 : change * sign,
      };
    }
  }

  return quotes;
}

function buildSyntheticHistory(quote: LiveQuote): DailyBar[] {
  const base = quote.close - quote.change;
  const volatility = Math.max(quote.close * 0.015, 0.08);

  return Array.from({ length: 250 }, (_, index) => {
    const wave = Math.sin(index / 10) * volatility * 2;
    const drift = (index - 125) * 0.02;
    const close = Math.max(0.1, Number((base + wave + drift).toFixed(2)));
    const date = new Date(Date.now() - (249 - index) * 86400000).toISOString().slice(0, 10);
    return { date, close };
  }).map((bar, index, arr) => (index === arr.length - 1 ? { ...bar, close: quote.close } : bar));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function movingAverage(history: DailyBar[], length: number) {
  const slice = history.slice(-length);
  return average(slice.map((bar) => bar.close));
}

function computeRsi(history: DailyBar[], length = 14) {
  const slice = history.slice(-(length + 1));
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < slice.length; index += 1) {
    const delta = slice[index].close - slice[index - 1].close;
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  if (losses === 0) return 100;
  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function estimateDividendYield(ticker: string, price: number) {
  const annualizedCash = {
    '00981A': 0.72,
    '00400A': 0.9,
    '00401A': 0.78,
    '00980A': 0.82,
    '00996A': 0.68,
  } as const;

  return Number((((annualizedCash[ticker as keyof typeof annualizedCash] ?? 0.7) / price) * 100).toFixed(2));
}

function estimateDiscountPremium(ticker: string, price: number, ma20: number) {
  const anchor = {
    '00981A': -0.8,
    '00400A': -2.1,
    '00401A': -1.2,
    '00980A': -0.6,
    '00996A': -1.4,
  } as const;

  const valuationGap = ((price - ma20) / ma20) * 100;
  return Number((valuationGap * 0.35 + (anchor[ticker as keyof typeof anchor] ?? -0.5)).toFixed(2));
}

function inferCategory(ticker: string, name: string): AssetCategory {
  const core = ETF_ASSETS.find((asset) => asset.ticker === ticker);
  if (core) return core.category;

  const normalized = `${ticker} ${name}`.toLowerCase();
  const matched = CATEGORY_KEYWORDS.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())));
  return matched?.category ?? 'balanced';
}

function computeMovingAverage(history: DailyBar[], index: number, length: number) {
  const start = Math.max(0, index - length + 1);
  const slice = history.slice(start, index + 1);
  if (slice.length < length) return undefined;
  return Number((slice.reduce((sum, bar) => sum + bar.close, 0) / slice.length).toFixed(2));
}

function toChartPoint(history: DailyBar[], formatter: (bar: DailyBar, index: number) => string): ChartPoint[] {
  return history.map((bar, index) => {
    const baseVolume = 500000 + index * 32000;
    const direction = index === 0 ? 0 : bar.close - history[index - 1].close;
    const open = Number((bar.close - direction * 0.35).toFixed(2));
    const high = Number((Math.max(open, bar.close) + Math.abs(direction) * 0.6 + 0.12).toFixed(2));
    const low = Number((Math.min(open, bar.close) - Math.abs(direction) * 0.5 - 0.1).toFixed(2));
    return {
      label: formatter(bar, index),
      close: bar.close,
      open,
      high,
      low,
      volume: Math.round(baseVolume + Math.abs(direction) * 100000),
      ma5: computeMovingAverage(history, index, 5),
      ma20: computeMovingAverage(history, index, 20),
      ma60: computeMovingAverage(history, index, 60),
    };
  });
}

function buildChartSeries(history: DailyBar[], latestPrice: number = 0): Record<'30m' | '60m' | 'day' | 'week' | '1m' | '3m' | '1y' | 'all', ChartPoint[]> {
  const latest = latestPrice > 0 ? latestPrice : (history[history.length - 1]?.close ?? 0);
  
  const buildIntraday = (intervals: number, labelStep: number) => Array.from({ length: intervals }, (_, index) => {
    const base = latest + Math.sin(index / 3) * (latest * 0.005);
    const open = Number((base - Math.cos(index / 4) * (latest * 0.002)).toFixed(2));
    const close = Number(base.toFixed(2));
    const totalMinutes = index * labelStep;
    const hour = Math.floor(totalMinutes / 60) + 9;
    const minute = totalMinutes % 60;
    return {
      label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      close,
      open,
      high: Number((Math.max(open, close) + (latest * 0.002)).toFixed(2)),
      low: Number((Math.min(open, close) - (latest * 0.002)).toFixed(2)),
      volume: 80000 + index * 2200,
      ma5: undefined,
      ma20: undefined,
      ma60: undefined,
    };
  });

  return {
    '30m': buildIntraday(14, 30),
    '60m': buildIntraday(7, 60),
    day: history.length > 0 ? toChartPoint(history.slice(-7), (bar) => bar.date.slice(5)) : buildIntraday(7, 60),
    week: history.length > 0 ? toChartPoint(history.slice(-35).filter((_, index) => index % 5 === 0), (bar) => bar.date.slice(5)) : buildIntraday(7, 60),
    '1m': history.length > 0 ? toChartPoint(history.slice(-30), (bar) => bar.date.slice(8)) : buildIntraday(7, 60),
    '3m': history.length > 0 ? toChartPoint(history.slice(-90).filter((_, index) => index % 3 === 0), (bar) => bar.date.slice(5)) : buildIntraday(7, 60),
    '1y': history.length > 0 ? toChartPoint(history.slice(-250).filter((_, index) => index % 10 === 0), (bar) => bar.date.slice(5)) : buildIntraday(7, 60),
    all: history.length > 0 ? toChartPoint(history.filter((_, index) => index % 5 === 0), (bar) => bar.date.slice(5)) : buildIntraday(7, 60),
  };
}

function buildSnapshotFromQuote(quote: LiveQuote): AssetSnapshot {
  const asset = ETF_ASSETS.find((entry) => entry.ticker === quote.ticker);
  const history = buildSyntheticHistory(quote);
  const ma5 = movingAverage(history, 5);
  const ma20 = movingAverage(history, 20);
  const ma60 = movingAverage(history, 60);
  const rsi = computeRsi(history);
  const previousClose = Number((quote.close - quote.change).toFixed(2));
  const dividendYield = estimateDividendYield(quote.ticker, quote.close);
  const discountPremium = estimateDiscountPremium(quote.ticker, quote.close, ma20);

  return {
    ticker: quote.ticker,
    name: quote.name,
    category: asset?.category ?? inferCategory(quote.ticker, quote.name),
    isCore: asset?.isCore ?? false,
    updatedAt: new Date().toISOString(),
    metrics: {
      price: quote.close,
      previousClose,
      volume: quote.volume,
      ma5: Number(ma5.toFixed(2)),
      ma20: Number(ma20.toFixed(2)),
      ma60: Number(ma60.toFixed(2)),
      rsi: Number(rsi.toFixed(1)),
      dividendYield,
      discountPremium,
    },
    chartSeries: buildChartSeries(history, quote.close),
  };
}

export async function getLiveSnapshots(): Promise<AssetSnapshot[]> {
  const quotes = await fetchQuotes(Array.from(CORE_TICKERS));

  return ETF_ASSETS.map((asset) => {
    const quote = quotes[asset.ticker];
    if (!quote) {
      // Fallback to empty snapshot if quote missing
      return {
        ...asset,
        updatedAt: new Date().toISOString(),
        metrics: { price: 0, previousClose: 0, volume: 0, ma5: 0, ma20: 0, ma60: 0, rsi: 0, dividendYield: 0, discountPremium: 0 },
        chartSeries: buildChartSeries([]),
      } as AssetSnapshot;
    }

    return buildSnapshotFromQuote({ ...quote, name: quote.name });
  });
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return [];

  // Bulk search uses MI_INDEX
  const quotes = await fetchQuotes([]);
  const twResults = Object.values(quotes)
    .filter((quote) => quote.ticker.includes(normalized) || quote.name.toUpperCase().includes(normalized))
    .map((quote) => ({ ticker: quote.ticker, name: quote.name, market: 'TW' as const }));

  const usResults = await searchUsUniverse(normalized).catch(() => []);

  return [...twResults, ...usResults].slice(0, 30);
}

async function fetchRealtimeQuote(ticker: string): Promise<LiveQuote | null> {
  const clean = ticker.toUpperCase().replace('.TW', '').replace('^', '');
  console.log(`[TWSE] Fetching realtime quote for: ${ticker} (clean: ${clean})`);
  
  // Handle Index
  let exCh = '';
  if (clean === 'TWII' || clean === 'T00') {
    exCh = 'tse_t00.tw';
  } else {
    exCh = `tse_${clean}.tw|otc_${clean}.tw`;
  }

  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exCh}&json=1&delay=0&_=${Date.now()}`;
  
  try {
    const payload = await fetchJson<{ msgArray?: Record<string, string>[] }>(url);
    if (!payload.msgArray || payload.msgArray.length === 0) {
      console.warn(`[TWSE] No data in msgArray for ${ticker}. URL: ${url}`);
      return null;
    }

    const msg = payload.msgArray[0];
    const close = parseNumber(msg.z); // Current
    const prevClose = parseNumber(msg.y); // Yesterday
    const open = parseNumber(msg.o);
    const high = parseNumber(msg.h);
    const low = parseNumber(msg.l);
    
    // If market is not open or no trade yet, msg.z might be '-'
    // Fallback to previous close if current price is unavailable
    const finalPrice = close > 0 ? close : (prevClose > 0 ? prevClose : 0);

    if (finalPrice === 0) {
      console.error(`[TWSE] Both current price and previous close are 0/invalid for ${ticker}`);
      return null;
    }

    console.log(`[TWSE] Successfully fetched ${ticker}: Price=${finalPrice}, Prev=${prevClose}`);

    return {
      ticker: ticker.toUpperCase(),
      name: msg.n || clean,
      market: 'TW',
      volume: parseNumber(msg.v),
      open: open > 0 ? open : finalPrice,
      high: high > 0 ? high : finalPrice,
      low: low > 0 ? low : finalPrice,
      close: finalPrice,
      change: finalPrice - prevClose,
    };
  } catch (err) {
    console.error(`[TWSE] Exception in fetchRealtimeQuote for ${ticker}:`, err);
    return null;
  }
}

export async function getSnapshotByTicker(ticker: string): Promise<AssetSnapshot | null> {
  const upperTicker = ticker.toUpperCase();
  const cleanTicker = upperTicker.replace('.TW', '');

  // 1. Try realtime TWSE API (for indices, or strings with numbers, or strings explicitly ending in .TW)
  if (upperTicker.includes('.TW') || /^[0-9A-Z]{4,6}$/.test(upperTicker) || ticker.startsWith('^')) {
    const rtQuote = await fetchRealtimeQuote(upperTicker);
    if (rtQuote) return buildSnapshotFromQuote(rtQuote);
  }

  // 2. US Fallback - Only check if it's likely a US ticker (letters only, no .TW)
  if (/^[A-Z]{1,5}$/.test(cleanTicker) && !upperTicker.includes('.TW') && cleanTicker !== 'TWII') {
    const usMatch = (await searchUsUniverse(upperTicker).catch(() => [])).find(
      (item) => item.ticker === upperTicker
    );
    
    if (usMatch) {
      const syntheticQuote: LiveQuote = {
        ticker: usMatch.ticker,
        name: usMatch.name,
        market: 'US',
        volume: 12000000,
        open: 180,
        high: 184,
        low: 178,
        close: 182,
        change: 1.8,
      };
      return buildSnapshotFromQuote(syntheticQuote);
    }
  }

  // 3. Fallback to bulk MI_INDEX for TWSE - only do this if it has digits or ends in .TW
  if (/\\d/.test(cleanTicker) || upperTicker.includes('.TW')) {
    const quotes = await fetchQuotes([]);
    const quote = quotes[cleanTicker] || quotes[upperTicker];
    if (quote) return buildSnapshotFromQuote(quote);
  }

  return null;
}
