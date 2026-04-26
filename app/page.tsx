import React from 'react';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { detectMarketRegime } from '@/lib/market-regime';
import { evaluateSignal, getDefaultRules } from '@/lib/signal-engine';
import { getLiveSnapshots } from '@/lib/twse';

export const revalidate = 300;

export default async function HomePage() {
  const rules = getDefaultRules();
  const snapshots = await getLiveSnapshots();
  const marketState = detectMarketRegime(snapshots);
  const assets = snapshots.map((asset) => ({
    ...asset,
    signal: evaluateSignal(asset, marketState, rules),
  }));

  const alerts = assets
    .filter((asset): asset is (typeof assets)[number] & { signal: { action: 'BUY' | 'SELL' | 'WATCH' } } => asset.signal.action !== 'HOLD')
    .map((asset) => ({
      ticker: asset.ticker,
      action: asset.signal.action,
      timestamp: asset.updatedAt,
      reason: asset.signal.reason,
      reasonI18n: asset.signal.reasonI18n,
    }));

  // eslint-disable-next-line react-hooks/purity
  const currentTimestamp = Date.now();

  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-400">Loading...</div>}>
      <DashboardClient
        assets={assets}
        alerts={alerts}
        marketRegime={marketState.regime}
        marketSummary={marketState.summary}
        rules={rules}
        updatedAt={new Date(snapshots[0]?.updatedAt ?? currentTimestamp).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      />
    </React.Suspense>
  );
}
