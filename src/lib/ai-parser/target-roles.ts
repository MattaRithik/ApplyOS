/** Normalize the role keywords saved on the profile. */
export function parseTargetRoles(value: string | null | undefined): string[] {
  return [...new Map((value ?? "").split(/[,;\n]+/).map((role) => role.trim()).filter(Boolean).map((role) => [role.toLowerCase(), role])).values()];
}

/** Existing non-empty preferences are already complete; empty legacy values are not. */
export function needsTargetRolesSetup(profile: { target_role?: string | null; settings?: unknown } | null): boolean {
  if (!profile) return false;
  const settings = profile.settings;
  const completed = settings !== null && typeof settings === "object" &&
    "target_roles_setup_completed" in settings && settings.target_roles_setup_completed === true;
  return !completed && parseTargetRoles(profile.target_role).length === 0;
}
