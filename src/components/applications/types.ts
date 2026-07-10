import type { Application, RelationshipType } from "@/lib/types/database";

export interface ApplicationWithResume extends Application {
  resume: { id: string; display_name: string } | null;
}

/** A draft row in the "HR / Recruiter Contacts" repeatable list on the application form. */
export interface HrContactDraft {
  /** Present when this row was loaded from an existing linked contact. */
  id?: string;
  name: string;
  role_title: string;
  email: string;
  phone: string;
  linkedin_url: string;
  relationship_type: RelationshipType;
}

export const EMPTY_HR_CONTACT: HrContactDraft = {
  name: "",
  role_title: "",
  email: "",
  phone: "",
  linkedin_url: "",
  relationship_type: "recruiter",
};
