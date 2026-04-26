"use client";

import { motion } from 'framer-motion';
import { Activity, Bell, Globe, Plus, RefreshCcw, Search, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { KChart } from '@/components/dashboard/k-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardControls } from '@/hooks/use-dashboard-controls';
import { AlertItem, EvaluatedAsset, MarketRegime, RulesConfig, SearchResult } from '@/lib/types';

type Language = 'zh-TW' | 'en';

const copy = {
  'zh-TW': {
    system: '台灣 ETF 紀律系統',
    title: '台灣 ETF 監控助手',
    subtitle: '以紀律、分類邏輯與市場狀態為核心，提供可執行而非情緒化的監控決策。',
    monitoredSearch: '搜尋已監控標的',
    refresh: '重新整理',
    autoRefresh: '自動更新',
    lastUpdated: '最後更新',
    addStock: '搜尋股票代碼加入監控',
    stockSearchPlaceholder: '輸入股票代碼或名稱',
    search: '搜尋',
    searching: '搜尋中...',
    noResults: '目前找不到符合的台股標的。',
    add: '加入',
    adding: '加入中...',
    remove: '移除',
    buy: '買進',
    sell: '賣出',
    watch: '觀察',
    sentiment: '情緒分數',
    monitor: '監控',
    alerts: '警示',
    rules: '規則',
    core: '核心',
    price: '價格',
    change: '漲跌幅',
    volume: '成交量',
    dividendYield: '殖利率',
    discountPremium: '折溢價',
    confidence: '信心分數',
    signalFeed: '訊號紀錄',
    chartTitle: 'K 線圖',
    '30m': '30分',
    '60m': '60分',
    day: '日',
    week: '週',
    '1m': '1月',
    '3m': '3月',
    '1y': '1年',
    all: '全部',
    growth: '成長型',
    highDividend: '高股息',
    balanced: '平衡型',
    bull: '多頭',
    bear: '空頭',
    neutral: '中性',
    rsiOversold: 'RSI 超賣',
    rsiOverbought: 'RSI 超買',
    deepDiscount: '深度折價',
    premiumCeiling: '溢價上限',
    refreshInterval: '更新頻率',
    language: '語言',
    chinese: '中文',
    english: 'English',
  },
  en: {
    system: 'Taiwan ETF Discipline System',
    title: 'Taiwan ETF monitoring assistant',
    subtitle: 'A structured dashboard built for discipline, category logic, and market-aware execution instead of emotional trading.',
    monitoredSearch: 'Search monitored assets',
    refresh: 'Refresh',
    autoRefresh: 'Auto refresh',
    lastUpdated: 'Last updated',
    addStock: 'Search stock code to add into monitor',
    stockSearchPlaceholder: 'Search stock code or name',
    search: 'Search',
    searching: 'Searching...',
    noResults: 'No matching TWSE listings found yet.',
    add: 'Add',
    adding: 'Adding...',
    remove: 'Remove',
    buy: 'BUY',
    sell: 'SELL',
    watch: 'WATCH',
    sentiment: 'Sentiment',
    monitor: 'Monitor',
    alerts: 'Alerts',
    rules: 'Rules',
    core: 'Core',
    price: 'Price',
    change: 'Change %',
    volume: 'Volume',
    dividendYield: 'Dividend Yield',
    discountPremium: 'Discount / Premium',
    confidence: 'Confidence score',
    signalFeed: 'Signal feed',
    chartTitle: 'K Chart',
    '30m': '30m',
    '60m': '60m',
    day: 'Day',
    week: 'Week',
    '1m': '1m',
    '3m': '3m',
    '1y': '1y',
    all: 'All',
    growth: 'Growth',
    highDividend: 'High Dividend',
    balanced: 'Balanced',
    bull: 'Bull',
    bear: 'Bear',
    neutral: 'Neutral',
    rsiOversold: 'RSI oversold',
    rsiOverbought: 'RSI overbought',
    deepDiscount: 'Deep discount',
    premiumCeiling: 'Premium ceiling',
    refreshInterval: 'Refresh interval',
    language: 'Language',
    chinese: '中文',
    english: 'English',
  },
} as const;

interface DashboardClientProps {
  assets: EvaluatedAsset[];
  alerts: AlertItem[];
  marketRegime: MarketRegime;
  marketSummary: string;
  rules: RulesConfig;
  updatedAt: string;
}

export function DashboardClient({ assets, alerts, marketRegime, marketSummary, rules, updatedAt }: DashboardClientProps) {
  const searchParams = useSearchParams();
  const { search, setSearch, normalizedSearch, autoRefresh, setAutoRefresh } = useDashboardControls();
  const [language, setLanguage] = useState<Language>('zh-TW');
  const [monitoredAssets, setMonitoredAssets] = useState(assets);
  const [stockQuery, setStockQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingTicker, setAddingTicker] = useState<string | null>(null);
  const [removingTicker, setRemovingTicker] = useState<string | null>(null);
  const [selectedAssetForChart, setSelectedAssetForChart] = useState<EvaluatedAsset | null>(null);
  const t = copy[language];

  // Auto-select asset from URL param
  useEffect(() => {
    const ticker = searchParams.get('ticker');
    if (ticker && selectedAssetForChart?.ticker !== ticker) {
      const asset = monitoredAssets.find((a) => a.ticker === ticker);
      if (asset) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedAssetForChart(asset);
      } else {
        fetch(`/api/snapshot?ticker=${encodeURIComponent(ticker)}`)
          .then((response) => response.json())
          .then((payload: { asset?: EvaluatedAsset }) => {
            if (payload.asset) {
              setSelectedAssetForChart(payload.asset);
            }
          })
          .catch(() => undefined);
      }
    }
  }, [searchParams, monitoredAssets, selectedAssetForChart]);

  const filteredAssets = useMemo(() => {
    const pool = monitoredAssets;
    if (!normalizedSearch) return pool;
    return pool.filter((asset) => [asset.ticker, asset.name, asset.category].join(' ').toLowerCase().includes(normalizedSearch));
  }, [monitoredAssets, normalizedSearch]);

  useEffect(() => {
    let active = true;
    fetch('/api/watchlist')
      .then((response) => response.json())
      .then((payload: { assets?: EvaluatedAsset[] }) => {
        if (!active || !payload.assets?.length) return;
        setMonitoredAssets((current) => {
          const extras = payload.assets!.filter((asset) => !current.some((existing) => existing.ticker === asset.ticker));
          return extras.length ? [...current, ...extras] : current;
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

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
      fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: result.ticker }),
      }).catch(() => undefined);
      return;
    }

    setAddingTicker(result.ticker);
    try {
      const response = await fetch(`/api/snapshot?ticker=${encodeURIComponent(result.ticker)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { asset?: EvaluatedAsset };
      if (!payload.asset) return;
      setMonitoredAssets((current) => [payload.asset!, ...current]);

      fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: result.ticker }),
      }).catch(() => undefined);
    } finally {
      setAddingTicker(null);
    }
  }

  async function removeFromMonitor(ticker: string) {
    setRemovingTicker(ticker);
    try {
      await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, { method: 'DELETE' });
      setMonitoredAssets((current) => current.filter((asset) => asset.ticker !== ticker));
    } finally {
      setRemovingTicker(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 md:px-8">
      {/* Scrolling Ticker */}
      <div className="mx-auto max-w-7xl mb-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 py-3">
        <div className="flex animate-[ticker_60s_linear_infinite] whitespace-nowrap">
          {[...monitoredAssets, ...monitoredAssets].map((asset, i) => (
            <button
              key={`${asset.ticker}-${i}`}
              type="button"
              onClick={() => setSelectedAssetForChart((prev) => prev?.ticker === asset.ticker ? null : asset)}
              className="mx-8 flex items-center gap-3 transition hover:text-emerald-400"
            >
              <span className="font-bold">{asset.ticker}</span>
              <span className="text-sm text-slate-400">{asset.metrics.price.toFixed(2)}</span>
              <span className={`text-xs ${asset.metrics.price >= asset.metrics.previousClose ? 'text-emerald-400' : 'text-rose-400'}`}>
                {asset.metrics.price >= asset.metrics.previousClose ? '+' : ''}
                {(((asset.metrics.price - asset.metrics.previousClose) / asset.metrics.previousClose) * 100).toFixed(2)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8">
        <motion.header initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
          <div className="mb-4 flex justify-end">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
              <Globe className="h-4 w-4" />
              <span>{t.language}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="bg-transparent text-white outline-none"
              >
                <option value="zh-TW" className="text-slate-950">{t.chinese}</option>
                <option value="en" className="text-slate-950">{t.english}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">{t.system}</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{t.title}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">{t.subtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(260px,1fr)_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.monitoredSearch} className="pl-10" />
              </div>
              <Button type="button" className="gap-2"><RefreshCcw className="h-4 w-4" /> {t.refresh}</Button>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2">
                <span className="text-sm text-slate-300">{t.autoRefresh}</span>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <Badge variant={marketRegime === 'bull' ? 'good' : marketRegime === 'bear' ? 'danger' : 'neutral'}>{marketRegime === 'bull' ? t.bull : marketRegime === 'bear' ? t.bear : t.neutral}</Badge>
            <span>{t.lastUpdated} {updatedAt}</span>
            <span className="text-slate-500">•</span>
            <span>{marketSummary}</span>
          </div>
        </motion.header>

        <Card>
          <CardHeader>
            <CardTitle>{t.addStock}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input value={stockQuery} onChange={(event) => setStockQuery(event.target.value)} placeholder={t.stockSearchPlaceholder} />
              <Button type="button" onClick={handleSearchStock} disabled={searching}>{searching ? t.searching : t.search}</Button>
            </div>
            {searchResults.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {searchResults.map((result) => (
                  <div key={result.ticker} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div>
                      <p className="font-semibold text-white">{result.ticker} {result.market ? `· ${result.market}` : ''}</p>
                      <p className="text-sm text-slate-400">{result.name}</p>
                    </div>
                    <Button type="button" className="gap-2" onClick={() => addToMonitor(result)} disabled={addingTicker === result.ticker}><Plus className="h-4 w-4" /> {addingTicker === result.ticker ? t.adding : t.add}</Button>
                  </div>
                ))}
              </div>
            ) : stockQuery ? (
              <p className="text-sm text-slate-400">{t.noResults}</p>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t.buy, value: buyCount, icon: Activity, tone: 'good' as const },
            { label: t.sell, value: sellCount, icon: Activity, tone: 'danger' as const },
            { label: t.watch, value: watchCount, icon: Bell, tone: 'warn' as const },
            { label: t.sentiment, value: `${sentiment}/100`, icon: Activity, tone: 'neutral' as const },
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
            <TabsTrigger value="monitor">{t.monitor}</TabsTrigger>
            <TabsTrigger value="alerts">{t.alerts}</TabsTrigger>
            <TabsTrigger value="rules">{t.rules}</TabsTrigger>
          </TabsList>

          <TabsContent value="monitor">
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredAssets.map((asset) => (
                <motion.div key={asset.ticker} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{asset.category === 'growth' ? t.growth : asset.category === 'high_dividend' ? t.highDividend : t.balanced}</p>
                          <CardTitle className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedAssetForChart((prev) => prev?.ticker === asset.ticker ? null : asset)}
                              className="transition hover:text-emerald-400"
                            >
                              {asset.ticker}
                            </button>
                            {asset.isCore ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">{t.core}</span> : null}
                          </CardTitle>
                          <p className="mt-1 text-sm text-slate-400">{asset.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={asset.signal.severity}>{asset.signal.action}</Badge>
                          <button
                            type="button"
                            onClick={() => removeFromMonitor(asset.ticker)}
                            className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/5"
                            disabled={removingTicker === asset.ticker}
                            aria-label={t.remove}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Metric label={t.price} value={asset.metrics.price.toFixed(2)} />
                        <Metric label={t.change} value={`${(((asset.metrics.price - asset.metrics.previousClose) / asset.metrics.previousClose) * 100).toFixed(2)}%`} />
                        <Metric label={t.volume} value={asset.metrics.volume.toLocaleString()} />
                        <Metric label="MA5" value={asset.metrics.ma5.toFixed(2)} />
                        <Metric label="MA20" value={asset.metrics.ma20.toFixed(2)} />
                        <Metric label="MA60" value={asset.metrics.ma60.toFixed(2)} />
                        <Metric label="RSI" value={asset.metrics.rsi.toString()} />
                        <Metric label={t.dividendYield} value={`${asset.metrics.dividendYield.toFixed(1)}%`} />
                        <Metric label={t.discountPremium} value={`${asset.metrics.discountPremium.toFixed(1)}%`} />
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">{t.confidence}</span>
                          <span className="text-lg font-semibold text-white">{asset.signal.score}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{asset.signal.reasonI18n?.[language] ?? asset.signal.reason}</p>
                      </div>
                      <div>
                        <p className="mb-3 text-sm font-medium text-slate-300">{t.chartTitle}</p>
                        <KChart
                          series={asset.chartSeries}
                          labels={{
                            '30m': t['30m'],
                            '60m': t['60m'],
                            day: t.day,
                            week: t.week,
                            '1m': t['1m'],
                            '3m': t['3m'],
                            '1y': t['1y'],
                            all: t.all,
                          }}
                        />
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
                <CardTitle>{t.signalFeed}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alerts.map((alert) => (
                  <div key={`${alert.ticker}-${alert.timestamp}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={alert.action === 'BUY' ? 'good' : alert.action === 'SELL' ? 'danger' : 'warn'}>{alert.action === 'BUY' ? t.buy : alert.action === 'SELL' ? t.sell : t.watch}</Badge>
                        <span className="font-medium text-white">{alert.ticker}</span>
                      </div>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{alert.timestamp}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{alert.reasonI18n?.[language] ?? alert.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <RuleCard label={t.rsiOversold} value={rules.rsiOversold.toString()} />
              <RuleCard label={t.rsiOverbought} value={rules.rsiOverbought.toString()} />
              <RuleCard label={t.deepDiscount} value={`${rules.deepDiscount}%`} />
              <RuleCard label={t.premiumCeiling} value={`${rules.premiumCeiling}%`} />
              <RuleCard label={t.refreshInterval} value={`${rules.refreshIntervalSeconds}s`} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {selectedAssetForChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSelectedAssetForChart(null)}
              className="absolute right-6 top-6 rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-300">{selectedAssetForChart.category.replace('_', ' ')}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{selectedAssetForChart.ticker} · {selectedAssetForChart.name}</h2>
            </div>
            <KChart
              series={selectedAssetForChart.chartSeries}
              labels={{
                '30m': t['30m'],
                '60m': t['60m'],
                day: t.day,
                week: t.week,
                '1m': t['1m'],
                '3m': t['3m'],
                '1y': t['1y'],
                all: t.all,
              }}
            />
          </motion.div>
        </div>
      )}
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
