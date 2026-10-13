import Link from "next/link";
import { POLICY_LINKS } from "@/lib/legal/policies";
import { cn } from "@/lib/utils";

export function PolicyLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Legal and support"
      className={cn("flex flex-wrap gap-x-4 gap-y-2 text-xs", className)}
    >
      {POLICY_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
