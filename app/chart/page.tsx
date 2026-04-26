import { Suspense } from 'react';
import { ChartClient } from '@/components/dashboard/chart-client';

export default function ChartPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading Chart...</div>}>
      <ChartClient />
    </Suspense>
  );
}
