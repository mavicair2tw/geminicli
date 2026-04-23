import { SearchResult } from '@/lib/types';

const NASDAQ_URL = 'https://www.nasdaqtrader.com/dynamic/symdir/nasdaqtraded.txt';
const OTHER_URL = 'https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt';

function parsePipeDelimited(text: string) {
  const [headerLine, ...rows] = text.trim().split('\n');
  const headers = headerLine.split('|');
  return rows
    .filter((row) => row && !row.startsWith('File Creation Time'))
    .map((row) => {
      const cells = row.split('|');
      return headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = cells[index] ?? '';
        return acc;
      }, {});
    });
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 stock-monitor' },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch US universe: ${response.status}`);
  }

  return response.text();
}

export async function searchUsUniverse(query: string): Promise<SearchResult[]> {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return [];

  const [nasdaqText, otherText] = await Promise.all([fetchText(NASDAQ_URL), fetchText(OTHER_URL)]);
  const nasdaq = parsePipeDelimited(nasdaqText).map((row) => ({
    ticker: row.Symbol,
    name: row['Security Name'],
    market: 'US' as const,
  }));
  const other = parsePipeDelimited(otherText).map((row) => ({
    ticker: row['ACT Symbol'],
    name: row['Security Name'],
    market: 'US' as const,
  }));

  const deduped = new Map<string, SearchResult>();
  [...nasdaq, ...other].forEach((item) => {
    if (!item.ticker || deduped.has(item.ticker)) return;
    deduped.set(item.ticker, item);
  });

  return Array.from(deduped.values())
    .filter((item) => item.ticker.includes(normalized) || item.name.toUpperCase().includes(normalized))
    .slice(0, 30);
}
