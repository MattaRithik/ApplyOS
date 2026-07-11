import { Users, Mail, Phone, Link2 } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Badge } from "@/components/ui/badge";
import { HR_CONTACT_RELATIONSHIP_TYPES } from "@/lib/types/database";
import type { HrContactDraft } from "@/components/applications/types";
import { safeHttpUrl, safeMailto } from "@/lib/utils/url";

export function HrContactsCard({ contacts }: { contacts: HrContactDraft[] }) {
  return (
    <GlassPanel className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4 text-[var(--cyan-accent)]" /> HR / Recruiter contacts
      </h2>
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No HR contacts added yet — use Edit to add recruiters, HR, or hiring managers for this application.
        </p>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact, i) => (
            <div key={contact.id ?? i} className="rounded-xl border border-border/50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{contact.name}</p>
                  {contact.role_title && <p className="text-xs text-muted-foreground">{contact.role_title}</p>}
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {HR_CONTACT_RELATIONSHIP_TYPES.find((r) => r.value === contact.relationship_type)?.label}
                </Badge>
              </div>
              {(contact.email || contact.phone || contact.linkedin_url) && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {safeMailto(contact.email) && (
                    <a href={safeMailto(contact.email)!} className="flex items-center gap-1 hover:text-primary">
                      <Mail className="h-3 w-3" /> {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {contact.phone}
                    </span>
                  )}
                  {safeHttpUrl(contact.linkedin_url) && (
                    <a href={safeHttpUrl(contact.linkedin_url)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                      <Link2 className="h-3 w-3" /> LinkedIn
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
