import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  hoverLift?: boolean;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, strong, hoverLift, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl glass-inset-highlight",
        strong ? "glass-panel-strong" : "glass-panel",
        hoverLift && "card-hover-lift",
        className
      )}
      {...props}
    />
  )
);
GlassPanel.displayName = "GlassPanel";
