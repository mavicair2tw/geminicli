import { ETF_ASSETS } from '@/lib/asset-classifier';
import { AssetCategory, AssetSnapshot, ChartPoint, DailyBar, LiveQuote, SearchResult } from '@/lib/types';

const QUOTE_URL = 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?type=ALLBUT0999&response=json';
const CORE_TICKERS = new Set(ETF_ASSETS.map((asset) => asset.ticker));
const CATEGORY_KEYWORDS: Array<{ category: AssetCategory; keywords: string[] }> = [
  { category: 'growth', keywords: ['增長', '成長', 'growth', '台股增長'] },
  { category: 'high_dividend', keywords: ['高息', '高股息', 'dividend', '收益'] },
  { category: 'balanced', keywords: ['優選', '平衡', '豐收', 'balanced', '配置'] },
];

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const clean = String(value).replace(/,/g, '').replace(/--/g, '0').trim();
  return Number(clean || 0);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 stock-monitor' },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`TWSE request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchQuotes(): Promise<Record<string, LiveQuote>> {
  const payload = await fetchJson<{ tables?: Array<{ fields?: string[]; data?: string[][] }> }>(QUOTE_URL);
  const quotes: Record<string, LiveQuote> = {};

  for (const table of payload.tables ?? []) {
    const fields = table.fields ?? [];
    if (!fields.includes('證券代號')) continue;

    for (const row of table.data ?? []) {
      const ticker = row[0];
      const isCore = CORE_TICKERS.has(ticker);
      const isSearchCandidate = /^(00|01|02|03|04|005|006|008|009)/.test(ticker);
      if (!isCore && !isSearchCandidate) continue;

      const close = parseNumber(row[8]);
      const change = parseNumber(row[10]);
      const sign = row[9]?.includes('green') ? -1 : row[9]?.includes('red') ? 1 : 0;
      quotes[ticker] = {
        ticker,
        name: row[1],
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

  return Array.from({ length: 60 }, (_, index) => {
    const wave = Math.sin(index / 6) * volatility;
    const drift = (index - 30) * 0.015;
    const close = Math.max(0.1, Number((base + wave + drift).toFixed(2)));
    const date = new Date(Date.now() - (59 - index) * 86400000).toISOString().slice(0, 10);
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

function buildChartSeries(history: DailyBar[]): Record<'hour' | 'day' | 'week' | 'month' | 'year' | 'all', ChartPoint[]> {
  const latest = history[history.length - 1]?.close ?? 0;
  const hour = Array.from({ length: 24 }, (_, index) => {
    const base = latest + Math.sin(index / 3) * 0.2;
    const open = Number((base - Math.cos(index / 4) * 0.08).toFixed(2));
    const close = Number(base.toFixed(2));
    return {
      label: `${String(index).padStart(2, '0')}:00`,
      close,
      open,
      high: Number((Math.max(open, close) + 0.08).toFixed(2)),
      low: Number((Math.min(open, close) - 0.08).toFixed(2)),
      volume: 80000 + index * 2200,
      ma5: undefined,
      ma20: undefined,
      ma60: undefined,
    };
  });

  return {
    hour,
    day: toChartPoint(history.slice(-7), (bar) => bar.date.slice(5)),
    week: toChartPoint(history.slice(-12).filter((_, index) => index % 2 === 0), (bar) => bar.date.slice(5)),
    month: toChartPoint(history.slice(-30), (bar) => bar.date.slice(8)),
    year: toChartPoint(history.slice(-12).filter((_, index) => index % 5 === 0), (bar) => bar.date.slice(5)),
    all: toChartPoint(history, (bar) => bar.date.slice(5)),
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
    chartSeries: buildChartSeries(history),
  };
}

export async function getLiveSnapshots(): Promise<AssetSnapshot[]> {
  const quotes = await fetchQuotes();

  return ETF_ASSETS.map((asset) => {
    const quote = quotes[asset.ticker];
    if (!quote) {
      throw new Error(`Missing TWSE quote for ${asset.ticker}`);
    }

    return buildSnapshotFromQuote({ ...quote, name: quote.name });
  });
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const quotes = await fetchQuotes();
  return Object.values(quotes)
    .filter((quote) => quote.ticker.includes(normalized) || quote.name.includes(normalized))
    .slice(0, 12)
    .map((quote) => ({ ticker: quote.ticker, name: quote.name }));
}

export async function getSnapshotByTicker(ticker: string): Promise<AssetSnapshot | null> {
  const quotes = await fetchQuotes();
  const quote = quotes[ticker];
  if (!quote) return null;
  return buildSnapshotFromQuote(quote);
}
