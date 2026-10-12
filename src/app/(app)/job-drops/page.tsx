import { redirect } from "next/navigation";

// Preserve existing bookmarks; implementation is archived in history/.
export default function RetiredJobDropsPage() {
  redirect("/dashboard");
}
