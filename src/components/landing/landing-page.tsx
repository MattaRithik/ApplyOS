import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  FileText,
  Sparkles,
  Users,
  Send,
  CalendarClock,
  ListChecks,
  BarChart3,
  Globe2,
  ShieldCheck,
  Download,
  ClipboardList,
  Search,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { LogoMark } from "@/components/shared/logo-mark";
import { LandingNav } from "@/components/landing/landing-nav";
import { DashboardPreview } from "@/components/landing/dashboard-preview";

const FEATURES = [
  {
    icon: Briefcase,
    title: "Application tracking",
    description:
      "Track every application end to end — from a Citadel Securities Quantitative Trader posting saved for later to a Goldman Sachs Investment Analyst offer.",
  },
  {
    icon: FileText,
    title: "Resume management",
    description:
      "Keep every resume version in one library, link the one you sent to each application, and see which version actually converts to interviews.",
  },
  {
    icon: Sparkles,
    title: "AI job parser",
    description:
      "Paste a job post — like a JPMorgan Market Risk Analyst listing — and let the parser extract role details, required skills, and salary range automatically.",
  },
  {
    icon: Users,
    title: "Recruiter & HR contact tracking",
    description:
      "Log every recruiter and hiring manager you talk to at each firm, with relationship status and notes, so nothing depends on your memory.",
  },
  {
    icon: Send,
    title: "Cold outreach tracking",
    description:
      "Track cold emails and LinkedIn messages to recruiters at firms like BlackRock or Bloomberg, and see reply rates by outreach type.",
  },
  {
    icon: CalendarClock,
    title: "Interview tracking",
    description:
      "Log every round — from a Jane Street Quantitative Researcher phone screen to a superday final round — with interviewers, prep notes, and outcomes.",
  },
  {
    icon: ListChecks,
    title: "Follow-up reminders",
    description:
      "Never let a thank-you email or a recruiter follow-up slip. Overdue reminders surface automatically on your dashboard.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Excel export",
    description:
      "See interview conversion, reply rates, and resume performance at a glance, then export any table — or a full backup — to Excel or CSV.",
  },
  {
    icon: Globe2,
    title: "Work authorization tracking",
    description:
      "Track OPT, CPT, and H1B sponsorship status per application, so international students can prioritize the roles that actually sponsor.",
  },
];

const STEPS = [
  {
    icon: ClipboardList,
    title: "Log the application",
    description:
      "Add a role manually or paste the job post URL and let the AI parser fill in the company, title, salary range, and required skills for you.",
  },
  {
    icon: Send,
    title: "Track outreach & contacts",
    description:
      "Save the recruiter or alum you cold-emailed, log the message you sent, and track replies — across every firm you're targeting.",
  },
  {
    icon: CalendarClock,
    title: "Prep for interviews",
    description:
      "Record every round as it's scheduled, with interviewer details and prep notes, and get reminded before follow-ups go stale.",
  },
  {
    icon: TrendingUp,
    title: "Review analytics & export",
    description:
      "Watch your conversion funnel and resume performance improve over time, and export everything whenever you want a copy.",
  },
];

const BENEFITS = [
  "Built around the actual finance and quant recruiting cycle — recruiter screens, OAs, superdays — not a generic kanban board.",
  "One workspace instead of a scattered spreadsheet, inbox, and notes app.",
  "Resume-to-outcome tracking, so you know which version of your resume is actually landing interviews.",
  "Work authorization status tracked per application, built for international students navigating OPT, CPT, and H1B timelines.",
];

export function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNav isAuthenticated={isAuthenticated} />

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-[var(--amber-accent)]" /> Built for finance & quant recruiting
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              The complete job-search CRM for competitive finance and quant recruiting.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              ApplyOS keeps every application, resume version, recruiter contact, cold email, interview round, and
              follow-up in one place — so nothing about your search to Jane Street, Citadel Securities, or Goldman
              Sachs slips through the cracks.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="gap-2" render={<Link href="/login" />}>
                Sign In <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="#features" />}>
                Explore Features
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in here.</Link>
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-[var(--blue-accent)]/10 via-transparent to-[var(--emerald-accent)]/10 blur-2xl" aria-hidden />
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Everything your search needs, one workspace</h2>
          <p className="mt-3 text-muted-foreground">
            Nine tools that cover the full lifecycle of a competitive finance or tech application — replacing the
            spreadsheet-plus-inbox setup most candidates start with.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <GlassPanel key={f.title} hoverLift className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
            </GlassPanel>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-3 text-muted-foreground">From saved job post to signed offer, in four steps.</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <GlassPanel key={s.title} className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--emerald-accent)]/15 text-[var(--emerald-accent)] text-xs font-semibold">
                  {i + 1}
                </span>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.description}</p>
            </GlassPanel>
          ))}
        </div>
      </section>

      {/* Why ApplyOS / benefits */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <GlassPanel strong className="grid gap-8 p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Why ApplyOS</h2>
            <p className="mt-3 text-muted-foreground">
              Most trackers are generic kanban boards borrowed from software recruiting. ApplyOS is built around the
              specifics of finance and quant pipelines — multi-round superdays, recruiter-led outreach, and the visa
              questions that come with them.
            </p>
          </div>
          <ul className="space-y-3.5">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--emerald-accent)]" />
                <span className="text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </section>

      {/* Privacy / data ownership */}
      <section id="privacy" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <GlassPanel className="mx-auto max-w-3xl p-6 text-center sm:p-8">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--silver-accent)]/15 text-[var(--silver-accent)]">
            <Search className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">You own your data</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Everything you enter — applications, resumes, contacts, outreach, interviews, notes — belongs to your
            account and is only visible to you. You can export any table, or a full backup of your workspace, to
            Excel or CSV at any time from the Export Center. There&apos;s no lock-in: if you leave, you take your data
            with you.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Export anytime, in your account settings</span>
          </div>
        </GlassPanel>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6">
        <GlassPanel strong className="glow-emerald flex flex-col items-center gap-4 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to run your search like a pipeline?</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Sign in to start tracking applications, resumes, and outreach in one place.
          </p>
          <Button size="lg" className="gap-2" render={<Link href="/login" />}>
            Sign In <ArrowRight className="h-4 w-4" />
          </Button>
        </GlassPanel>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/50 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--blue-accent)] via-[var(--cyan-accent)] to-[var(--emerald-accent)] text-white">
              <LogoMark className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">ApplyOS</span>
            <span className="text-xs text-muted-foreground">— Application Tracker</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ApplyOS. Your data, your workspace.</p>
          <Link href="/login" className="text-xs text-primary hover:underline">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
