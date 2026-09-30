"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { HEARTBEAT_MS, IDLE_MS, pageSection } from "@/lib/presence/shared";

export function ActivityHeartbeat({ userId }: { userId: string }) {
  const pathname = usePathname() ?? "";
  const sendRef = useRef<(() => void) | null>(null);
  const pageRef = useRef(pageSection(pathname));
  useEffect(() => {
    pageRef.current = pageSection(pathname);
    sendRef.current?.();
  }, [pathname]);

  useEffect(() => {
    // Each tab/mount gets a fresh identifier; never persist an auth token.
    const sessionId = crypto.randomUUID();
    let lastInteraction = Date.now();
    let stopped = false;
    let pending = false;
    let lastSent = 0;
    const send = (closed = false) => {
      if (stopped || (!closed && pending)) return;
      pending = true;
      lastSent = Date.now();
      void fetch("/api/presence", {
        method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, page: pageRef.current, visible: document.visibilityState === "visible", closed,
          idleSeconds: Math.min(86400, Math.floor((Date.now() - lastInteraction) / 1000)) }),
      }).then((response) => { if (response.status === 401) stopped = true; })
        .catch(() => {}).finally(() => { pending = false; });
    };
    const interaction = () => {
      const wasIdle = Date.now() - lastInteraction >= IDLE_MS;
      lastInteraction = Date.now();
      if (wasIdle && Date.now() - lastSent > 2000) send();
    };
    const visibility = () => { send(); };
    const pagehide = () => { send(true); };
    const pageshow = () => { send(); };
    sendRef.current = () => { send(); };
    send();
    const timer = window.setInterval(send, HEARTBEAT_MS);
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, interaction, { passive: true }));
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);
    return () => {
      send(true);
      stopped = true;
      sendRef.current = null;
      clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, interaction));
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
    };
  }, [userId]);
  return null;
}
