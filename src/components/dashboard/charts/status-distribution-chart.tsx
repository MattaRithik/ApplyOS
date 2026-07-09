"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types/database";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const config: ChartConfig = { count: { label: "Applications" } };

export function StatusDistributionChart({
  data,
}: {
  data: { status: ApplicationStatus; count: number }[];
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: APPLICATION_STATUSES.find((s) => s.value === d.status)?.label ?? d.status,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={120}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
