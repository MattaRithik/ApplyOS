"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";

const config: ChartConfig = {
  sent: { label: "Sent", color: "var(--chart-2)" },
  replied: { label: "Replied", color: "var(--chart-1)" },
};

export function OutreachReplyChart({
  data,
}: {
  data: { week: string; sent: number; replied: number }[];
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="sent" fill="var(--color-sent)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="replied" fill="var(--color-replied)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
