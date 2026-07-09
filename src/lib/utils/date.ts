export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoISODate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
