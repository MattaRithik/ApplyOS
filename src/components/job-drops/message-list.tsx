"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCard } from "./message-card";
import type { LinkMessage, LinkMessageStatus, LinkStatus } from "@/lib/types/database";

interface MessageListProps {
  messages: LinkMessage[];
  statuses: LinkMessageStatus[];
  currentUserId: string;
  currentUserName: string;
  partnerId: string | null;
  partnerName: string;
  onSetStatus: (messageId: string, status: LinkStatus) => void;
}

export function MessageList({
  messages,
  statuses,
  currentUserId,
  currentUserName,
  partnerId,
  partnerName,
  onSetStatus,
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
        {messages.map((message) => {
          const isMine = message.sender_id === currentUserId;
          return (
            <MessageCard
              key={message.id}
              message={message}
              isMine={isMine}
              senderName={isMine ? currentUserName : partnerName}
              myStatus={statusFor(message.id, currentUserId)}
              partnerStatus={partnerId ? statusFor(message.id, partnerId) : null}
              partnerName={partnerName}
              onSetMyStatus={(status) => onSetStatus(message.id, status)}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
