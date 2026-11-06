'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatUsd, formatUsdWhole } from '@/lib/format';

export interface MrrChartDatum {
  name: string;
  mrrCents: number;
}

/** Horizontal bar chart of MRR by client (largest first). */
export function MrrChart({ data }: { data: MrrChartDatum[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No billing data yet.</p>;
  }
  const height = Math.max(200, data.length * 32 + 40);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} strokeOpacity={0.15} />
          <XAxis
            type="number"
            tickFormatter={(value: number) => formatUsdWhole(value)}
            tick={{ fill: 'currentColor', fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={220}
            tick={{ fill: 'currentColor', fontSize: 12 }}
            className="text-muted-foreground"
          />
          <Tooltip
            cursor={{ fillOpacity: 0.08 }}
            formatter={(value) => [formatUsd(Number(value)), 'MRR']}
            contentStyle={{
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <Bar dataKey="mrrCents" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
