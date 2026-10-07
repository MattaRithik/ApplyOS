import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Log prepared downloads without making file access depend on analytics availability. */
export async function recordDownload(userId: string, kind: "resume" | "export", fileName: string) {
  try {
    const { error } = await createServiceRoleClient().from("download_activity").insert({
      user_id: userId, kind, file_name: fileName,
    });
    if (error) console.error("Unable to record download activity.");
  } catch {
    console.error("Unable to record download activity.");
  }
}
