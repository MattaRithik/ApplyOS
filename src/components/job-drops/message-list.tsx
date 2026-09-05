"use client";

import * as React from "react";
import { format, isToday, isYesterday } from "date-fns";
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
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const atBottomRef = React.useRef(true);
  const previousMessagesRef = React.useRef<LinkMessage[]>([]);
  const initializedRef = React.useRef(false);

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const lastMessage = messages.at(-1);
    const sentByMe = lastMessage?.sender_id === currentUserId &&
      !previousMessagesRef.current.some((message) => message.id === lastMessage.id);

    // Scroll only the history, never its page ancestors. Keep the reader's
    // position when their partner posts while they are looking at older links.
    if (!initializedRef.current || atBottomRef.current || sentByMe) {
      viewport.scrollTop = viewport.scrollHeight;
      atBottomRef.current = true;
    }
    initializedRef.current = true;
    previousMessagesRef.current = messages;
  }, [messages, currentUserId]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // The share prompt and viewport resizing can change the available height.
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) viewport.scrollTop = viewport.scrollHeight;
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const days: { key: string; date: Date; messages: LinkMessage[] }[] = [];
  for (const message of messages) {
    const date = new Date(message.created_at);
    const key = dayKey(date);
    const previousDay = days.at(-1);
    if (previousDay?.key === key) previousDay.messages.push(message);
    else days.push({ key, date, messages: [message] });
  }

  const statusFor = (messageId: string, userId: string) =>
    statuses.find((s) => s.message_id === messageId && s.user_id === userId)?.status ?? null;

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Job Drops message history"
      tabIndex={0}
      className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl [overflow-anchor:none]"
      onScroll={(event) => {
        const viewport = event.currentTarget;
        atBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 64;
      }}
    >
      <div className="space-y-3 p-1.5">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No links yet — post the first one below.</p>
        )}
        {days.map((day) => (
          <section key={day.key} className="relative space-y-3" aria-label={dayLabel(day.date)}>
            <div className="sticky top-0 z-10 flex justify-center py-1">
              <span className="rounded-full border border-border/50 bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                {dayLabel(day.date)}
              </span>
            </div>
            {day.messages.map((message) => {
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
                  onDelete={() => onDelete(message.id)}
                />
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
