"use client";

import { motion } from 'framer-motion';
import { Activity, Bell, Plus, RefreshCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardControls } from '@/hooks/use-dashboard-controls';
import { AlertItem, EvaluatedAsset, MarketRegime, RulesConfig, SearchResult } from '@/lib/types';

interface DashboardClientProps {
  assets: EvaluatedAsset[];
  alerts: AlertItem[];
  marketRegime: MarketRegime;
  marketSummary: string;
  rules: RulesConfig;
  updatedAt: string;
}

export function DashboardClient({ assets, alerts, marketRegime, marketSummary, rules, updatedAt }: DashboardClientProps) {
  const { search, setSearch, normalizedSearch, autoRefresh, setAutoRefresh } = useDashboardControls();
  const [monitoredAssets, setMonitoredAssets] = useState(assets);
  const [stockQuery, setStockQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingTicker, setAddingTicker] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    const pool = monitoredAssets;
    if (!normalizedSearch) return pool;
    return pool.filter((asset) => [asset.ticker, asset.name, asset.category].join(' ').toLowerCase().includes(normalizedSearch));
  }, [monitoredAssets, normalizedSearch]);

  const buyCount = monitoredAssets.filter((asset) => asset.signal.action === 'BUY').length;
  const sellCount = monitoredAssets.filter((asset) => asset.signal.action === 'SELL').length;
  const watchCount = monitoredAssets.filter((asset) => asset.signal.action === 'WATCH').length;
  const sentiment = Math.round(monitoredAssets.reduce((sum, asset) => sum + asset.signal.score, 0) / monitoredAssets.length);

  async function handleSearchStock() {
    if (!stockQuery.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(stockQuery.trim())}`);
      const payload = (await response.json()) as { results: SearchResult[] };
      setSearchResults(payload.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function addToMonitor(result: SearchResult) {
    if (monitoredAssets.some((asset) => asset.ticker === result.ticker)) return;

    const existing = assets.find((asset) => asset.ticker === result.ticker);
    if (existing) {
      setMonitoredAssets((current) => [existing, ...current]);
      return;
    }

    setAddingTicker(result.ticker);
    try {
      const response = await fetch(`/api/snapshot?ticker=${encodeURIComponent(result.ticker)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { asset?: EvaluatedAsset };
      if (!payload.asset) return;
      setMonitoredAssets((current) => [payload.asset!, ...current]);
    } finally {
      setAddingTicker(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <motion.header initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Taiwan ETF Discipline System</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Taiwan ETF monitoring assistant</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">A structured, rules-driven dashboard focused on disciplined execution, category-specific evaluation, and market-aware decision support.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(260px,1fr)_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search monitored assets" className="pl-10" />
              </div>
              <Button type="button" className="gap-2"><RefreshCcw className="h-4 w-4" /> Refresh</Button>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2">
                <span className="text-sm text-slate-300">Auto refresh</span>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <Badge variant={marketRegime === 'bull' ? 'good' : marketRegime === 'bear' ? 'danger' : 'neutral'}>{marketRegime}</Badge>
            <span>Last updated {updatedAt}</span>
            <span className="text-slate-500">•</span>
            <span>{marketSummary}</span>
          </div>
        </motion.header>

        <Card>
          <CardHeader>
            <CardTitle>Add stock code to monitor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input value={stockQuery} onChange={(event) => setStockQuery(event.target.value)} placeholder="Search stock code or name" />
              <Button type="button" onClick={handleSearchStock} disabled={searching}>{searching ? 'Searching...' : 'Search'}</Button>
            </div>
            {searchResults.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {searchResults.map((result) => (
                  <div key={result.ticker} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div>
                      <p className="font-semibold text-white">{result.ticker}</p>
                      <p className="text-sm text-slate-400">{result.name}</p>
                    </div>
                    <Button type="button" className="gap-2" onClick={() => addToMonitor(result)} disabled={addingTicker === result.ticker}><Plus className="h-4 w-4" /> {addingTicker === result.ticker ? 'Adding...' : 'Add'}</Button>
                  </div>
                ))}
              </div>
            ) : stockQuery ? (
              <p className="text-sm text-slate-400">No matching TWSE listings found yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'BUY', value: buyCount, icon: Activity, tone: 'good' as const },
            { label: 'SELL', value: sellCount, icon: Activity, tone: 'danger' as const },
            { label: 'WATCH', value: watchCount, icon: Bell, tone: 'warn' as const },
            { label: 'Sentiment', value: `${sentiment}/100`, icon: Activity, tone: 'neutral' as const },
          ].map((item) => (
            <Card key={item.label}>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{item.label}</p>
                  <CardTitle className="mt-2 text-3xl">{item.value}</CardTitle>
                </div>
                <Badge variant={item.tone}><item.icon className="h-4 w-4" /></Badge>
              </CardHeader>
            </Card>
          ))}
        </section>

        <Tabs defaultValue="monitor">
          <TabsList>
            <TabsTrigger value="monitor">Monitor</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="monitor">
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredAssets.map((asset) => (
                <motion.div key={asset.ticker} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{asset.category.replace('_', ' ')}</p>
                          <CardTitle className="mt-2 flex items-center gap-2">{asset.ticker}{asset.isCore ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">Core</span> : null}</CardTitle>
                          <p className="mt-1 text-sm text-slate-400">{asset.name}</p>
                        </div>
                        <Badge variant={asset.signal.severity}>{asset.signal.action}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Metric label="Price" value={asset.metrics.price.toFixed(2)} />
                        <Metric label="Change %" value={`${(((asset.metrics.price - asset.metrics.previousClose) / asset.metrics.previousClose) * 100).toFixed(2)}%`} />
                        <Metric label="Volume" value={asset.metrics.volume.toLocaleString()} />
                        <Metric label="MA5" value={asset.metrics.ma5.toFixed(2)} />
                        <Metric label="MA20" value={asset.metrics.ma20.toFixed(2)} />
                        <Metric label="MA60" value={asset.metrics.ma60.toFixed(2)} />
                        <Metric label="RSI" value={asset.metrics.rsi.toString()} />
                        <Metric label="Dividend Yield" value={`${asset.metrics.dividendYield.toFixed(1)}%`} />
                        <Metric label="Discount / Premium" value={`${asset.metrics.discountPremium.toFixed(1)}%`} />
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Confidence score</span>
                          <span className="text-lg font-semibold text-white">{asset.signal.score}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{asset.signal.reason}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Signal feed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alerts.map((alert) => (
                  <div key={`${alert.ticker}-${alert.timestamp}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={alert.action === 'BUY' ? 'good' : alert.action === 'SELL' ? 'danger' : 'warn'}>{alert.action}</Badge>
                        <span className="font-medium text-white">{alert.ticker}</span>
                      </div>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{alert.timestamp}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{alert.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <RuleCard label="RSI oversold" value={rules.rsiOversold.toString()} />
              <RuleCard label="RSI overbought" value={rules.rsiOverbought.toString()} />
              <RuleCard label="Deep discount" value={`${rules.deepDiscount}%`} />
              <RuleCard label="Premium ceiling" value={`${rules.premiumCeiling}%`} />
              <RuleCard label="Refresh interval" value={`${rules.refreshIntervalSeconds}s`} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function RuleCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-slate-400">{label}</p>
        <CardTitle className="mt-2 text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
