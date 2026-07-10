"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2, Pencil, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/shared/glass-panel";
import { TemplateFormDialog } from "@/components/templates/template-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deleteTemplate } from "@/app/(app)/templates/actions";
import { TEMPLATE_CATEGORIES, type EmailTemplate } from "@/lib/types/database";

export function TemplatesGrid({ templates }: { templates: EmailTemplate[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleCopy = async (template: EmailTemplate) => {
    await navigator.clipboard.writeText(
      template.subject ? `Subject: ${template.subject}\n\n${template.body}` : template.body
    );
    toast.success("Copied to clipboard.");
  };

  const handleDeleted = () => {
    toast.success("Template deleted.");
    router.refresh();
  };

  const deletingTemplate = templates.find((t) => t.id === deletingId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <GlassPanel key={t.id} hoverLift className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]">
                <Mail className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <Badge variant="secondary" className="mt-0.5 text-[10px]">
                  {TEMPLATE_CATEGORIES.find((c) => c.value === t.category)?.label}
                </Badge>
              </div>
            </div>
          </div>
          {t.subject && <p className="text-xs font-medium text-muted-foreground">Subject: {t.subject}</p>}
          <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">{t.body}</p>
          <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-2.5">
            <span className="text-[11px] text-muted-foreground">Used {t.times_used}×</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => handleCopy(t)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <TemplateFormDialog
                template={t}
                onSaved={() => router.refresh()}
                trigger={<Button variant="ghost" size="icon-sm"><Pencil className="h-3.5 w-3.5" /></Button>}
              />
              <Button variant="ghost" size="icon-sm" onClick={() => setDeletingId(t.id)} aria-label="Delete template">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        </GlassPanel>
      ))}

      <ConfirmDeleteDialog
        open={deletingId !== null}
        onOpenChange={(o) => setDeletingId(o ? deletingId : null)}
        title="Delete this template?"
        itemName={deletingTemplate?.name}
        warningText="Outreach records that used this template will keep their content but lose the template link."
        confirmLabel="Delete Template"
        onConfirm={() => deleteTemplate(deletingId!)}
        onSuccess={handleDeleted}
      />
    </div>
  );
}
