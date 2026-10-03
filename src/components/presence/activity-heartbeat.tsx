"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { heartbeatFailure, setHeartbeatError } from "@/lib/presence/client-status";
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
    let queue = Promise.resolve();
    let lastSent = 0;
    const send = (closed = false) => {
      if (stopped) return;
      lastSent = Date.now();
      // Snapshot transitions immediately and send them in order, including tab close.
      const body = JSON.stringify({ sessionId, page: pageRef.current,
        visible: document.visibilityState === "visible" && document.hasFocus(), closed,
        idleSeconds: Math.min(86400, Math.floor((Date.now() - lastInteraction) / 1000)) });
      queue = queue.then(async () => {
        try {
          const response = await fetch("/api/presence", {
            method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true,
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10_000), body,
          });
          if (!stopped && !closed) setHeartbeatError(response.ok ? null : heartbeatFailure(response.status));
        } catch {
          if (!stopped && !closed) setHeartbeatError("The request timed out or could not reach the server.");
        }
      });
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
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);
    return () => {
      send(true);
      stopped = true;
      sendRef.current = null;
      clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, interaction));
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", visibility);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
    };
  }, [userId]);
  return null;
}
