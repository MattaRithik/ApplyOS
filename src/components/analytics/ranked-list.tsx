import type { ElementType } from "react";
import { Progress } from "@/components/ui/progress";

export function RankedList({
  items,
  icon: Icon,
  empty,
}: {
  items: { label: string; sub: string; value: number }[];
  icon: ElementType;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 truncate">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {item.label}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{item.sub}</span>
          </div>
          <Progress value={item.value} className="h-1.5" />
        </li>
      ))}
    </ul>
  );
}
