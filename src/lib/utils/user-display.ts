/** Full name if set, else the local part of the email, else the fallback — never a raw full email inline in UI. */
export function displayName(fullName: string | null | undefined, email: string | null | undefined, fallback = "Someone"): string {
  if (fullName && fullName.trim()) return fullName.trim();
  if (email) return email.split("@")[0];
  return fallback;
}
