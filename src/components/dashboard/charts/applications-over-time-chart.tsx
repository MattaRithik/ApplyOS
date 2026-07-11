"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config: ChartConfig = {
  count: { label: "Applications", color: "var(--chart-1)" },
};

type Period = "daily" | "weekly" | "monthly";

interface ApplicationsOverTimeData {
  daily: { label: string; count: number }[];
  weekly: { label: string; count: number }[];
  monthly: { label: string; count: number }[];
}

type LegacyWeeklyData = { week: string; count: number }[];

const PERIODS: { value: Period; label: string; range: string }[] = [
  { value: "daily", label: "Daily", range: "Last 14 days" },
  { value: "weekly", label: "Weekly", range: "Last 12 weeks" },
  { value: "monthly", label: "Monthly", range: "Last 12 months" },
];

export function ApplicationsOverTimeChart({ data }: { data: ApplicationsOverTimeData | LegacyWeeklyData }) {
  const [period, setPeriod] = React.useState<Period>("weekly");
  const selectedPeriod = PERIODS.find((option) => option.value === period)!;
  const hasPeriodData = !Array.isArray(data);
  const chartData = Array.isArray(data)
    ? data.map((point) => ({ label: point.week, count: point.count }))
    : data[period];

  return (
    <div>
      {hasPeriodData && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{selectedPeriod.range}</span>
          <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5" aria-label="Chart interval">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
                className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <AreaChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fillApplications" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--color-count)"
            fill="url(#fillApplications)"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
