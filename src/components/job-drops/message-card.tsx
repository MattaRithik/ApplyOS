"use client";

import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GlassPanel } from "@/components/shared/glass-panel";
import { StatusPicker } from "./status-picker";
import { formatShortUrl } from "@/lib/utils/url";
import { cn } from "@/lib/utils";
import type { LinkMessage, LinkStatus } from "@/lib/types/database";

interface MessageCardProps {
  message: LinkMessage;
  isMine: boolean;
  senderName: string;
  myStatus: LinkStatus | null;
  partnerStatus: LinkStatus | null;
  partnerName: string;
  onSetMyStatus: (status: LinkStatus) => void;
}

export function MessageCard({ message, isMine, senderName, myStatus, partnerStatus, partnerName, onSetMyStatus }: MessageCardProps) {
  return (
    <GlassPanel className={cn("max-w-lg space-y-2 p-3.5", isMine ? "ml-auto" : "mr-auto")}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{senderName}</span>
        <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
      </div>
      <a
        href={message.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 break-all text-sm font-medium text-[var(--blue-accent)] hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        {formatShortUrl(message.url)}
      </a>
      {message.caption && <p className="text-sm text-muted-foreground">{message.caption}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/50 pt-2">
        <StatusPicker label="You" value={myStatus} onChange={onSetMyStatus} />
        <StatusPicker label={partnerName} value={partnerStatus} readOnly />
      </div>
    </GlassPanel>
  );
}
