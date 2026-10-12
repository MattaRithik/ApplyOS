"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";

/**
 * "x minutes ago" changes between the server's render moment and the
 * client's hydration moment, which React flags as a mismatch. Render the
 * same deterministic absolute time on both passes, then swap to the
 * relative string only after mount — hydration only checks the first
 * client render, not what happens after.
 */
export function RelativeTime({ date }: { date: string }) {
  const parsed = React.useMemo(() => new Date(date), [date]);
  const [relative, setRelative] = React.useState<string | null>(null);

  React.useEffect(() => {
    const update = () => setRelative(formatDistanceToNow(parsed, { addSuffix: true }));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [parsed]);

  return <span>{relative ?? format(parsed, "MMM d, h:mm a")}</span>;
}
