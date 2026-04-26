"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { KChart } from '@/components/dashboard/k-chart';
import { EvaluatedAsset } from '@/lib/types';

export function ChartClient() {
  const searchParams = useSearchParams();
  const ticker = searchParams.get('ticker');
  const [asset, setAsset] = useState<EvaluatedAsset | null>(null);
  const [loading, setLoading] = useState(!!ticker);
  const [error, setError] = useState<string | null>(ticker ? null : 'No ticker provided');

  useEffect(() => {
    if (!ticker) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/snapshot?ticker=${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          return res.json().then(errData => {
            throw new Error(errData.error || `Server returned ${res.status}`);
          }).catch(() => {
            throw new Error(`Server returned ${res.status}`);
          });
        }
        return res.json();
      })
      .then((data: { asset?: EvaluatedAsset }) => {
        if (data.asset) {
          setAsset(data.asset);
        } else {
          setError('Stock data is empty');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          setError('Request timed out after 10 seconds');
        } else {
          setError(err.message);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });
  }, [ticker]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        <p className="text-slate-400 animate-pulse">Fetching {ticker} data...</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-rose-500/10 p-4 mb-4">
          <svg className="h-12 w-12 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Error Loading Chart</h2>
        <p className="text-slate-400 mb-6">{error || 'Unknown error occurred'}</p>
        <div className="text-left bg-slate-900 p-4 rounded-xl border border-white/5 max-w-md w-full overflow-hidden">
            <p className="text-xs font-mono text-slate-500 mb-1">Debug Info:</p>
            <p className="text-xs font-mono text-slate-300 truncate">URL: /api/snapshot?ticker={ticker}</p>
            <p className="text-xs font-mono text-slate-300">Ticker: {ticker || 'N/A'}</p>
        </div>
        <button 
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors"
        >
            Retry
        </button>
      </div>
    );
  }

  if (!asset && !loading && !error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        No asset data available for {ticker}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
            <span className="text-sm uppercase tracking-[0.24em] text-emerald-300">
                {asset.category.replace('_', ' ')}
            </span>
            {asset.isCore && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-300 uppercase">Core</span>
            )}
        </div>
        <h1 className="mt-2 text-3xl font-bold text-white">
          {asset.ticker} <span className="text-slate-500 font-normal">· {asset.name}</span>
        </h1>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Price</p>
                <p className="text-xl font-bold text-white">{asset.metrics.price.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Change %</p>
                <p className={`text-xl font-bold ${asset.metrics.price >= asset.metrics.previousClose ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {asset.metrics.price >= asset.metrics.previousClose ? '+' : ''}
                    {(((asset.metrics.price - asset.metrics.previousClose) / asset.metrics.previousClose) * 100).toFixed(2)}%
                </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Signal</p>
                <p className="text-xl font-bold text-white">{asset.signal.action}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Score</p>
                <p className="text-xl font-bold text-white">{asset.signal.score}</p>
            </div>
        </div>
      </div>
      
      <div className="h-[calc(100vh-200px)] min-h-[400px]">
        <KChart
          series={asset.chartSeries}
          labels={{
            '30m': '30m',
            '60m': '60m',
            day: 'Day',
            week: 'Week',
            '1m': '1m',
            '3m': '3m',
            '1y': '1y',
            all: 'All',
          }}
        />
      </div>
      
      <div className="mt-6 p-4 rounded-2xl border border-white/10 bg-slate-900/50">
        <p className="text-sm text-slate-300 leading-relaxed italic">
          &quot;{asset.signal.reasonI18n?.['zh-TW'] || asset.signal.reason}&quot;
        </p>
      </div>
    </div>
  );
}
