"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassPanel } from "@/components/shared/glass-panel";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { httpUrlSchema } from "@/lib/validation/common";
import { markJobDropsRead } from "@/app/(app)/job-drops/actions";
import type { LinkMessage, LinkMessageStatus, LinkStatus } from "@/lib/types/database";

interface JobDropsClientProps {
  threadId: string;
  currentUserId: string;
  currentUserName: string;
  partnerId: string | null;
  partnerName: string;
  initialMessages: LinkMessage[];
  initialStatuses: LinkMessageStatus[];
}

const TYPING_IDLE_MS = 3000;
const TYPING_SEND_THROTTLE_MS = 1500;

export function JobDropsClient({
  threadId,
  currentUserId,
  currentUserName,
  partnerId,
  partnerName,
  initialMessages,
  initialStatuses,
}: JobDropsClientProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const [messages, setMessages] = React.useState<LinkMessage[]>(initialMessages);
  const [statuses, setStatuses] = React.useState<LinkMessageStatus[]>(initialStatuses);
  const [partnerTyping, setPartnerTyping] = React.useState(false);

  const typingChannelRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = React.useRef(0);

  React.useEffect(() => {
    const upsertStatus = (row: LinkMessageStatus) => {
      setStatuses((prev) => [...prev.filter((s) => !(s.message_id === row.message_id && s.user_id === row.user_id)), row]);
    };

    const dataChannel = supabase
      .channel(`link_messages:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "link_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as LinkMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "link_message_statuses", filter: `thread_id=eq.${threadId}` },
        (payload) => upsertStatus(payload.new as LinkMessageStatus)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "link_message_statuses", filter: `thread_id=eq.${threadId}` },
        (payload) => upsertStatus(payload.new as LinkMessageStatus)
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`typing:${threadId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (payload) => {
        const senderId = (payload.payload as { userId?: string } | undefined)?.userId;
        if (!senderId || senderId !== partnerId) return;
        setPartnerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), TYPING_IDLE_MS);
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    return () => {
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [supabase, threadId, partnerId]);

  React.useEffect(() => {
    markJobDropsRead().catch(() => {});
  }, [messages.length]);

  const handleSend = async (url: string, caption: string) => {
    const parsed = httpUrlSchema.safeParse(url);
    if (!parsed.success) throw new Error("Enter a valid http(s) link.");
    const { error } = await supabase.from("link_messages").insert({
      thread_id: threadId,
      sender_id: currentUserId,
      url: parsed.data,
      caption: caption || null,
    });
    if (error) throw new Error(error.message);
  };

  const handleSetStatus = async (messageId: string, status: LinkStatus) => {
    const previous = statuses;
    setStatuses((prev) => [
      ...prev.filter((s) => !(s.message_id === messageId && s.user_id === currentUserId)),
      { message_id: messageId, thread_id: threadId, user_id: currentUserId, status, updated_at: new Date().toISOString() },
    ]);
    const { error } = await supabase
      .from("link_message_statuses")
      .upsert({ message_id: messageId, thread_id: threadId, user_id: currentUserId, status }, { onConflict: "message_id,user_id" });
    if (error) setStatuses(previous);
  };

  const handleTyping = () => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_SEND_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId } });
  };

  return (
    <div className="space-y-3">
      <GlassPanel className="p-3">
        <MessageList
          messages={messages}
          statuses={statuses}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          partnerId={partnerId}
          partnerName={partnerName}
          onSetStatus={handleSetStatus}
        />
      </GlassPanel>
      <div className="h-4 text-xs text-muted-foreground">{partnerTyping ? `${partnerName} is typing…` : ""}</div>
      <Composer onSend={handleSend} onTyping={handleTyping} />
    </div>
  );
}
