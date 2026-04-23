import { promises as fs } from 'fs';
import path from 'path';

const storagePath = path.join(process.cwd(), '.data', 'watchlist.json');

async function ensureDir() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
}

export async function readWatchlist(): Promise<string[]> {
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function writeWatchlist(tickers: string[]) {
  await ensureDir();
  await fs.writeFile(storagePath, JSON.stringify(Array.from(new Set(tickers)), null, 2), 'utf8');
}
