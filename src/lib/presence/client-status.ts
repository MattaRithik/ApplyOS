"use client";
// Local reporting health only. Never contains another user's activity or IP.
const initial: { error: string | null } = { error: null };
let snapshot = initial;
const listeners = new Set<() => void>();
export function setHeartbeatError(error: string | null) {
  if (snapshot.error === error) return;
  snapshot = { error };
  listeners.forEach((listener) => listener());
}
export function subscribeHeartbeat(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getHeartbeatSnapshot = () => snapshot;
export const getServerHeartbeatSnapshot = () => initial;

export function heartbeatFailure(status: number) {
  if (status === 401) return "Your sign-in could not be verified (401). Refresh or sign in again.";
  if (status === 403) return "The server rejected the request origin (403).";
  if (status === 404 || status === 405) return `The heartbeat endpoint is missing or outdated (${status}).`;
  if (status === 429) return "The reporting rate limit was reached (429).";
  return `The server could not save the report (${status}).`;
}
