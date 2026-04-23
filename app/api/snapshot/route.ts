import { NextRequest, NextResponse } from 'next/server';

import { detectMarketRegime } from '@/lib/market-regime';
import { getDefaultRules, evaluateSignal } from '@/lib/signal-engine';
import { getLiveSnapshots, getSnapshotByTicker } from '@/lib/twse';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker') ?? '';
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  const [snapshot, baseSnapshots] = await Promise.all([getSnapshotByTicker(ticker), getLiveSnapshots()]);

  if (!snapshot) {
    return NextResponse.json({ error: 'ticker not found' }, { status: 404 });
  }

  const rules = getDefaultRules();
  const marketState = detectMarketRegime(baseSnapshots);
  const evaluated = {
    ...snapshot,
    signal: evaluateSignal(snapshot, marketState, rules),
  };

  return NextResponse.json({ asset: evaluated });
}
