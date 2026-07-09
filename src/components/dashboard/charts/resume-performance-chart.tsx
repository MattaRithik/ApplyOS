"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config: ChartConfig = {
  interviewRate: { label: "Interview rate %", color: "var(--chart-2)" },
};

export function ResumePerformanceChart({
  data,
}: {
  data: { name: string; applications: number; interviewRate: number }[];
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0} angle={-12} textAnchor="end" height={50} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} unit="%" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="interviewRate" fill="var(--color-interviewRate)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
