export type LinkStatus = "applied" | "not_applied" | "not_applicable";

export interface LinkThread {
  id: string;
  created_by: string | null;
  created_at: string;
}

export interface LinkThreadParticipant {
  thread_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
}

export interface LinkMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  url: string;
  caption: string | null;
  created_at: string;
}

export interface LinkMessageStatus {
  message_id: string;
  thread_id: string;
  user_id: string;
  status: LinkStatus;
  updated_at: string;
}

export const LINK_STATUSES: { value: LinkStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "not_applied", label: "Not Applied" },
  { value: "not_applicable", label: "Not Applicable" },
];
