"use client";

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { ChartPoint } from '@/lib/types';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false },
);

type RangeKey = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

interface KChartProps {
  series?: Record<RangeKey, ChartPoint[]>;
  labels: Record<RangeKey, string>;
}

export function KChart({ series, labels }: KChartProps) {
  const [range, setRange] = useState<RangeKey>('day');

  const data = useMemo(() => series?.[range] ?? [], [range, series]);

  if (!series) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as RangeKey[]).map((key) => (
          <Button key={key} type="button" className={key === range ? '' : 'bg-slate-800 text-white hover:bg-slate-700'} onClick={() => setRange(key)}>
            {labels[key]}
          </Button>
        ))}
      </div>
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="label" stroke="#94a3b8" />
            <YAxis yAxisId="price" stroke="#94a3b8" domain={['auto', 'auto']} />
            <YAxis yAxisId="volume" orientation="right" stroke="#475569" domain={[0, 'auto']} hide />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
            <Bar yAxisId="volume" dataKey="volume" fill="#1d4ed8" opacity={0.25} barSize={10} />
            <Bar yAxisId="price" dataKey="high" fill="#64748b" opacity={0.3} barSize={4} radius={[4, 4, 4, 4]} />
            <Bar yAxisId="price" dataKey="low" fill="#334155" opacity={0.25} barSize={4} radius={[4, 4, 4, 4]} />
            <Bar yAxisId="price" dataKey="open" fill="#ef4444" opacity={0.55} barSize={8} radius={[4, 4, 4, 4]} />
            <Bar yAxisId="price" dataKey="close" fill="#22c55e" opacity={0.7} barSize={8} radius={[4, 4, 4, 4]} />
            <Line yAxisId="price" type="monotone" dataKey="ma5" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={2} dot={false} />
            <Line yAxisId="price" type="monotone" dataKey="ma60" stroke="#a855f7" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
