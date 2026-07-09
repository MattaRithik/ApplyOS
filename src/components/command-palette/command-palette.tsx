"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import {
  Briefcase,
  Building2,
  Users,
  PlusCircle,
  LayoutDashboard,
  Download,
  Settings,
  Send,
  FileText,
  Loader2,
} from "lucide-react";

interface SearchResults {
  applications: { id: string; job_title: string; company_name: string; status: string }[];
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string; company_name: string | null }[];
}

const EMPTY_RESULTS: SearchResults = { applications: [], companies: [], contacts: [] };

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange: setOpen }: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResults>(EMPTY_RESULTS);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const displayResults = query.trim().length < 2 ? EMPTY_RESULTS : results;

  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      return;
    }
    const supabase = createClient();
    const term = `%${query.trim()}%`;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const [applications, companies, contacts] = await Promise.all([
        supabase
          .from("applications")
          .select("id, job_title, company_name, status")
          .or(`job_title.ilike.${term},company_name.ilike.${term},notes.ilike.${term}`)
          .limit(6),
        supabase.from("companies").select("id, name").ilike("name", term).limit(6),
        supabase
          .from("contacts")
          .select("id, name, company_name")
          .or(`name.ilike.${term},email.ilike.${term},company_name.ilike.${term}`)
          .limit(6),
      ]);
      setResults({
        applications: applications.data ?? [],
        companies: companies.data ?? [],
        contacts: contacts.data ?? [],
      });
      setLoading(false);
    }, 260);
    return () => clearTimeout(timeout);
  }, [query, open]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search ApplyOS"
      description="Search applications, companies, contacts — or jump anywhere"
    >
      <CommandInput
        placeholder="Search companies, roles, contacts, notes… or type a command"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="scrollbar-thin">
        {loading && (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Searching…
          </div>
        )}
        <CommandEmpty>No results found.</CommandEmpty>

        {query.trim().length < 2 && (
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Go to Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/applications/add")}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Application
            </CommandItem>
            <CommandItem onSelect={() => go("/outreach")}>
              <Send className="mr-2 h-4 w-4" /> Log Cold Outreach
            </CommandItem>
            <CommandItem onSelect={() => go("/resumes")}>
              <FileText className="mr-2 h-4 w-4" /> Resume Library
            </CommandItem>
            <CommandItem onSelect={() => go("/export")}>
              <Download className="mr-2 h-4 w-4" /> Export Center
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </CommandItem>
          </CommandGroup>
        )}

        {displayResults.applications.length > 0 && (
          <>
            <CommandGroup heading="Applications">
              {displayResults.applications.map((a) => (
                <CommandItem key={a.id} onSelect={() => go(`/applications/${a.id}`)}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  <span className="truncate">
                    {a.job_title} <span className="text-muted-foreground">· {a.company_name}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {displayResults.companies.length > 0 && (
          <>
            <CommandGroup heading="Companies">
              {displayResults.companies.map((c) => (
                <CommandItem key={c.id} onSelect={() => go(`/companies/${c.id}`)}>
                  <Building2 className="mr-2 h-4 w-4" /> {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {displayResults.contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {displayResults.contacts.map((c) => (
              <CommandItem key={c.id} onSelect={() => go(`/contacts?highlight=${c.id}`)}>
                <Users className="mr-2 h-4 w-4" />
                <span className="truncate">
                  {c.name} {c.company_name && <span className="text-muted-foreground">· {c.company_name}</span>}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
