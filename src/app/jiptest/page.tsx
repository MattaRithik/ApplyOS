"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AddApplicationClient } from "@/components/applications/add-application-client";

export default function JipTestPage() {
  return (
    <TooltipProvider delay={150}>
      <div className="min-h-screen p-6">
        <AddApplicationClient resumeOptions={[{ id: "r1", display_name: "Software_Resume_v1.pdf" }]} />
      </div>
    </TooltipProvider>
  );
}
