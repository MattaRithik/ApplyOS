/** Only Supabase's server-controlled app_metadata may set this flag. */
export function isWorkspaceBlocked(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user.app_metadata?.workspace_access === "export_only";
}

export const BLOCKED_MESSAGE = "You have been blocked from using ApplyOS.";

export function isBlockedAccountRoute(path: string, method: string): boolean {
  return (
    (path === "/blocked" && method === "GET") ||
    (path === "/api/account/export" && method === "POST") ||
    (path === "/api/account/sign-out" && method === "POST")
  );
}
