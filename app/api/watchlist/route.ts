import { NextRequest, NextResponse } from 'next/server';

import { detectMarketRegime } from '@/lib/market-regime';
import { getDefaultRules, evaluateSignal } from '@/lib/signal-engine';
import { getLiveSnapshots, getSnapshotByTicker } from '@/lib/twse';
import { readWatchlist, writeWatchlist } from '@/lib/watchlist-store';

async function evaluateTicker(ticker: string) {
  const [snapshot, baseSnapshots] = await Promise.all([getSnapshotByTicker(ticker), getLiveSnapshots()]);
  if (!snapshot) return null;
  const rules = getDefaultRules();
  const marketState = detectMarketRegime(baseSnapshots);
  return {
    ...snapshot,
    signal: evaluateSignal(snapshot, marketState, rules),
  };
}

export async function GET() {
  const tickers = await readWatchlist();
  const assets = (await Promise.all(tickers.map((ticker) => evaluateTicker(ticker)))).filter(Boolean);
  return NextResponse.json({ tickers, assets });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { ticker?: string };
  const ticker = body.ticker?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  const watchlist = await readWatchlist();
  await writeWatchlist([ticker, ...watchlist]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  const watchlist = await readWatchlist();
  await writeWatchlist(watchlist.filter((item) => item !== ticker));
  return NextResponse.json({ ok: true });
}
