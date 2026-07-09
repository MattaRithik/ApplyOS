import type { Application } from "@/lib/types/database";

export interface ApplicationWithResume extends Application {
  resume: { id: string; display_name: string } | null;
}
