"use client";

import * as React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCard } from "./message-card";
import type { LinkMessage, LinkMessageStatus, LinkStatus } from "@/lib/types/database";

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

interface MessageListProps {
  messages: LinkMessage[];
  statuses: LinkMessageStatus[];
  currentUserId: string;
  currentUserName: string;
  partnerId: string | null;
  partnerName: string;
  onSetStatus: (messageId: string, status: LinkStatus) => void;
  onDelete: (messageId: string) => Promise<void>;
}

export function MessageList({
  messages,
  statuses,
  currentUserId,
  currentUserName,
  partnerId,
  partnerName,
  onSetStatus,
  onDelete,
}: MessageListProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const statusFor = (messageId: string, userId: string) =>
    statuses.find((s) => s.message_id === messageId && s.user_id === userId)?.status ?? null;

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-3 p-1.5">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No links yet — post the first one below.</p>
        )}
        {messages.map((message, index) => {
          const isMine = message.sender_id === currentUserId;
          const createdAt = new Date(message.created_at);
          const previousCreatedAt = index > 0 ? new Date(messages[index - 1].created_at) : null;
          const showDaySeparator = !previousCreatedAt || dayKey(createdAt) !== dayKey(previousCreatedAt);
          return (
            <React.Fragment key={message.id}>
              {showDaySeparator && (
                <div className="sticky top-0 z-10 flex justify-center py-1">
                  <span className="rounded-full border border-border/50 bg-background/85 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                    {dayLabel(createdAt)}
                  </span>
                </div>
              )}
              <MessageCard
                message={message}
                isMine={isMine}
                senderName={isMine ? currentUserName : partnerName}
                myStatus={statusFor(message.id, currentUserId)}
                partnerStatus={partnerId ? statusFor(message.id, partnerId) : null}
                partnerName={partnerName}
                onSetMyStatus={(status) => onSetStatus(message.id, status)}
                onDelete={() => onDelete(message.id)}
              />
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
