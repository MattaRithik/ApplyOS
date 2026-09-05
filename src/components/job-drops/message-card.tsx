"use client";

import * as React from "react";
import { ExternalLink, Trash2, Share2 } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { StatusPicker } from "./status-picker";
import { RelativeTime } from "./relative-time";
import { formatShortUrl } from "@/lib/utils/url";
import { buildWhatsAppShareUrl, jobDropShareText } from "@/lib/utils/whatsapp";
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
  onDelete: () => Promise<void>;
}

export function MessageCard({
  message,
  isMine,
  senderName,
  myStatus,
  partnerStatus,
  partnerName,
  onSetMyStatus,
  onDelete,
}: MessageCardProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <GlassPanel className={cn("max-w-lg space-y-2 p-3.5", isMine ? "ml-auto" : "mr-auto")}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{senderName}</span>
        <div className="flex items-center gap-2">
          <RelativeTime date={message.created_at} />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Share to WhatsApp"
            render={
              <a
                href={buildWhatsAppShareUrl(jobDropShareText({ senderName, url: message.url, caption: message.caption }))}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
            className="text-muted-foreground hover:text-[#25D366]"
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          {isMine && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Delete link"
              onClick={() => setConfirmOpen(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
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

      {isMine && (
        <ConfirmDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete this link?"
          description="This removes it for both of you — it can't be undone."
          onConfirm={onDelete}
        />
      )}
    </GlassPanel>
  );
}
