import { promises as fs } from 'fs';
import path from 'path';
import { ETF_ASSETS } from './asset-classifier';

const storagePath = path.join(process.cwd(), '.data', 'watchlist.json');

async function ensureDir() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
}

export async function readWatchlist(): Promise<string[]> {
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    if (list.length === 0) return ETF_ASSETS.map(a => a.ticker);
    return list;
  } catch {
    return ETF_ASSETS.map(a => a.ticker);
  }
}

export async function writeWatchlist(tickers: string[]) {
  await ensureDir();
  await fs.writeFile(storagePath, JSON.stringify(Array.from(new Set(tickers)), null, 2), 'utf8');
}
