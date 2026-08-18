"use client";

import * as React from "react";
import { Send, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildWhatsAppShareUrl, jobDropShareText } from "@/lib/utils/whatsapp";

interface ComposerProps {
  currentUserName: string;
  onSend: (url: string, caption: string) => Promise<void>;
  onTyping: () => void;
}

export function Composer({ currentUserName, onSend, onTyping }: ComposerProps) {
  const [url, setUrl] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [justPosted, setJustPosted] = React.useState<{ url: string; caption: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setSending(true);
    try {
      await onSend(trimmedUrl, caption.trim());
      setJustPosted({ url: trimmedUrl, caption: caption.trim() });
      setUrl("");
      setCaption("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post link.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      {justPosted && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-2 text-xs">
          <span className="text-[#1a9950] dark:text-[#25D366]">Posted — want to ping your WhatsApp group too?</span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              className="gap-1 border-transparent bg-[#25D366] text-white hover:bg-[#1ebe57]"
              render={
                <a
                  href={buildWhatsAppShareUrl(
                    jobDropShareText({ senderName: currentUserName, url: justPosted.url, caption: justPosted.caption })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setJustPosted(null)}
                />
              }
            >
              <Share2 className="h-3.5 w-3.5" /> Share to WhatsApp
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss"
              onClick={() => setJustPosted(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          required
          placeholder="Paste a job link…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            onTyping();
          }}
          className="sm:flex-[2]"
        />
        <Input
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value);
            onTyping();
          }}
          className="sm:flex-1"
        />
        <Button type="submit" disabled={sending || !url.trim()} className="gap-1.5">
          <Send className="h-3.5 w-3.5" /> Send
        </Button>
      </form>
    </div>
  );
}
