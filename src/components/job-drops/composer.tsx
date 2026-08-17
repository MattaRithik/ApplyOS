"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ComposerProps {
  onSend: (url: string, caption: string) => Promise<void>;
  onTyping: () => void;
}

export function Composer({ onSend, onTyping }: ComposerProps) {
  const [url, setUrl] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setSending(true);
    try {
      await onSend(trimmedUrl, caption.trim());
      setUrl("");
      setCaption("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post link.");
    } finally {
      setSending(false);
    }
  };

  return (
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
  );
}
