"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedDefaultTemplates } from "@/app/(app)/templates/actions";

export function SeedTemplatesButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleSeed = async () => {
    setLoading(true);
    try {
      await seedDefaultTemplates();
      toast.success("Loaded 10 starter templates.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2" onClick={handleSeed} disabled={loading}>
      <Sparkles className="h-4 w-4" /> {loading ? "Loading…" : "Load starter templates"}
    </Button>
  );
}
