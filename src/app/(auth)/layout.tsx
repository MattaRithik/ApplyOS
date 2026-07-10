import Link from "next/link";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogoMark } from "@/components/shared/logo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--blue-accent)] via-[var(--cyan-accent)] to-[var(--emerald-accent)] text-white shadow-lg">
          <LogoMark className="h-5.5 w-5.5" />
        </span>
        <div className="leading-tight">
          <p className="text-base font-semibold tracking-tight">ApplyOS</p>
        </div>
      </Link>

      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
