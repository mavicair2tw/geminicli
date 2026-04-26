export type AssetCategory = 'growth' | 'high_dividend' | 'balanced';

export type MarketRegime = 'bull' | 'bear' | 'neutral';

export type SignalAction = 'BUY' | 'SELL' | 'WATCH' | 'HOLD';

export type SignalSeverity = 'good' | 'warn' | 'danger' | 'neutral';

export interface AssetDefinition {
  ticker: string;
  name: string;
  category: AssetCategory;
  isCore?: boolean;
}

export interface AssetMetrics {
  price: number;
  previousClose: number;
  volume: number;
  ma5: number;
  ma20: number;
  ma60: number;
  rsi: number;
  dividendYield: number;
  discountPremium: number;
}

export interface ChartPoint {
  label: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  ma5?: number;
  ma20?: number;
  ma60?: number;
}

export interface AssetSnapshot extends AssetDefinition {
  updatedAt: string;
  metrics: AssetMetrics;
  chartSeries?: Record<'30m' | '60m' | 'day' | 'week' | '1m' | '3m' | '1y' | 'all', ChartPoint[]>;
}

export interface SignalOutput {
  action: SignalAction;
  score: number;
  reason: string;
  reasonI18n?: {
    'zh-TW': string;
    en: string;
  };
  severity: SignalSeverity;
}

export interface EvaluatedAsset extends AssetSnapshot {
  signal: SignalOutput;
  isCore?: boolean;
}

export interface AlertItem {
  ticker: string;
  action: Exclude<SignalAction, 'HOLD'>;
  timestamp: string;
  reason: string;
  reasonI18n?: {
    'zh-TW': string;
    en: string;
  };
}

export interface RulesConfig {
  rsiOversold: number;
  rsiOverbought: number;
  deepDiscount: number;
  premiumCeiling: number;
  refreshIntervalSeconds: number;
}

export interface DailyBar {
  date: string;
  close: number;
}

export interface LiveQuote {
  ticker: string;
  name: string;
  market?: 'TW' | 'US';
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
}

export interface SearchResult {
  ticker: string;
  name: string;
  market?: 'TW' | 'US';
}
