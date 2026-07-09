# ApplyOS

A futuristic, glassmorphism job-search CRM and application operating system. Track applications, companies, contacts, cold outreach, resumes, interviews, and follow-ups in one command center — with an AI-assisted job description parser, full analytics, and Excel/CSV export.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion, Supabase, and Backblaze B2.

## Tech stack

- **Framework:** Next.js 16 (App Router, Server Actions, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + a custom glassmorphism design system (see `src/app/globals.css`)
- **UI components:** shadcn/ui (Base UI primitives) + Framer Motion
- **Database & Auth:** Supabase (Postgres + Row Level Security + Supabase Auth)
- **File storage:** Backblaze B2 (S3-compatible API) — a private bucket holds resume files; Supabase stores only metadata + the B2 object key, never the file itself
- **Charts:** Recharts
- **AI parsing:** Anthropic Claude (optional) with a built-in heuristic fallback
- **Export:** ExcelJS (.xlsx) + PapaParse (.csv)
- **Deployment:** Vercel

## Project structure

```
src/
  app/
    (auth)/                 Login, forgot-password, reset-password (public)
    (app)/                  Authenticated app shell + all feature pages
      dashboard/
      applications/         Table / Kanban / Calendar / Company / Priority views
        add/                Add Application + floating AI parser drawer
        [id]/                Application detail (interviews, notes, status history)
      companies/
      contacts/
      outreach/              Cold Outreach tracker
      templates/             Email templates
      resumes/               Resume library (upload, rename, detail)
      interviews/
      follow-ups/             Follow-up Center
      analytics/
      export/                Export Center
      settings/
    api/
      parser/                Job description parser (LLM + heuristic fallback)
      resumes/
        create-upload-url/    Step 1: reserve a resume row + signed B2 PUT URL
        [id]/finalize/         Step 2: confirm the upload landed in B2
        [id]/download-url/     Signed, short-lived B2 GET URL (ownership-checked)
        [id]/route.ts          DELETE: removes the B2 object, then the DB row
        rename/                DB-only: updates display_name, never touches storage
      export/                 xlsx/csv/full-backup export endpoint
  components/                UI components, grouped by feature
  lib/
    storage/b2.ts             Server-only Backblaze B2 (S3-compatible) client — never imported by client components
    supabase/                Browser/server/service-role Supabase clients
    parser/                  Heuristic + LLM job description parsers
    export/                  xlsx/csv builders, entity fetchers
    data/                    Server-side data/aggregation helpers (dashboard, analytics, follow-ups)
    types/database.ts        Hand-authored types mirroring the SQL schema
supabase/
  schema.sql                 Full Postgres schema + RLS policies (includes an in-place migration
                              for resumes tables created before the Backblaze B2 move)
```

## 1. Supabase setup

Supabase is used for **auth and every table except resume files** — companies, applications, contacts, outreach, interviews, and resume *metadata* all live in Postgres. Resume PDFs/DOCs themselves live in Backblaze B2 (§2 below); Supabase never stores or serves them.

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/schema.sql` — this creates all tables (`applications`, `companies`, `resumes`, `contacts`, `outreach`, `email_templates`, `interview_rounds`, `follow_ups`, `application_status_history`, `parsed_job_details`, `notes`, `exports`), enums, triggers (auto profile creation, status-history logging, `updated_at`), and Row Level Security policies scoped to `auth.uid()` on every user-owned table. It's safe to re-run — it includes an in-place migration for `resumes` tables created before this project moved off Supabase Storage.
3. **Do not run any Supabase Storage setup for resumes** — there is none. No bucket, no storage policies. (If you have an old `supabase/storage.sql` from a previous version of this project, it's no longer used and can be deleted from your Supabase project's Storage tab.)
4. Under **Authentication → Providers**, email/password is enabled by default — that's all ApplyOS needs. Under **Authentication → URL Configuration**, set your site URL (and add `http://localhost:3000` for local dev) so password-reset emails redirect correctly to `/reset-password`.

## 2. Backblaze B2 setup (resume file storage)

1. Create a Backblaze account at [backblaze.com/b2](https://www.backblaze.com/cloud-storage) and open the B2 dashboard.
2. **Create a bucket** — give it any name (e.g. `applyos-resumes`) and set its **Files in Bucket** setting to **Private**. Never make it public; ApplyOS only ever hands out short-lived signed URLs, and the app assumes the bucket itself is unreachable without one.
3. **Create a restricted application key** (Account → App Keys → Add a New Application Key), not your master key:
   - Scope it to the bucket you just created (not "all buckets").
   - Capabilities: `listFiles`, `readFiles`, `writeFiles`, `deleteFiles` on that bucket only.
   - Copy the **keyID** and **applicationKey** immediately — the application key is shown once.
4. Note your bucket's **S3-compatible endpoint** and **region**, shown on the bucket details page — they look like `https://s3.us-west-002.backblazeb2.com` and `us-west-002`.
5. Add all five B2 values to your env vars (§3) — `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_REGION`, `B2_ENDPOINT`.

## 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
# Public — safe for the browser. These two are the ONLY vars that may be NEXT_PUBLIC_.
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only — never sent to the browser, never prefixed NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
B2_KEY_ID=your-b2-key-id
B2_APPLICATION_KEY=your-b2-application-key
B2_BUCKET_NAME=your-b2-bucket-name
B2_REGION=us-west-002
B2_ENDPOINT=https://s3.us-west-002.backblazeb2.com

ANTHROPIC_API_KEY=   # optional, see below
```

Find the Supabase URL and keys under **Project Settings → API**. Find the B2 values as described in §2.

## 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account from the login page (the "Create account" tab) — a `profiles` row is created automatically via a database trigger.

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/new).
3. Add the same environment variables from `.env.local` in the Vercel project's **Environment Variables** settings — mark `SUPABASE_SERVICE_ROLE_KEY`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_REGION`, and `B2_ENDPOINT` as **server-only** (do not expose them to the client build).
4. Deploy. Vercel builds with `next build` automatically — no extra config needed.
5. Back in Supabase, add your production URL to **Authentication → URL Configuration → Redirect URLs** (needed for password reset).

## The AI job description parser

`src/app/api/parser/route.ts` accepts a pasted job URL + description and returns structured fields (company, title, location, work mode, skills, salary, visa notes, suggested follow-up date, priority score, etc.), each with a **confidence score**.

- If `ANTHROPIC_API_KEY` is set, it calls Claude Haiku with a JSON schema (`src/lib/parser/llm.ts`) for high-accuracy structured extraction.
- Otherwise (or if the LLM call fails) it falls back to a **regex/keyword heuristic parser** (`src/lib/parser/heuristic.ts`) — fully functional with no API key required.

The Add Application page (`src/app/(app)/applications/add`) renders this in a floating glass drawer that stays pinned while you scroll, with per-field accept/reject checkboxes and an "Accept all" shortcut. Accepted fields map onto the application form (`src/lib/parser/apply-to-form.ts`); the full raw parser output is also saved to `parsed_job_details` for auditing.

## Resume storage — Backblaze B2

Resume files never touch Supabase. Supabase's `resumes` table stores only metadata and a `storage_key` — the B2 object path — never the file itself and never a public URL. All B2 access is mediated by server-side, ownership-checked API routes (`src/lib/storage/b2.ts` holds the only code in the repo that imports `@aws-sdk/client-s3`, and it's guarded with `import "server-only"` so it can't be pulled into client-side bundles).

**Upload** (`POST /api/resumes/create-upload-url` → direct browser→B2 PUT → `POST /api/resumes/[id]/finalize`):

1. The browser sends the file's name/type/size (not the file itself) to `create-upload-url`.
2. The server verifies the Supabase session, validates the MIME type (PDF/DOC/DOCX only) and size (≤20MB), and reserves a `resumes` row with `status: "uploading"`.
3. The server generates the object key itself — `users/{user_id}/resumes/{resume_id}/{uuid}-{safe_filename}` — the browser never chooses or sees a raw key it could tamper with, and returns a signed B2 **PUT** URL that expires in 5 minutes.
4. The browser uploads the file directly to B2 using that URL — the file bytes never pass through the Next.js server.
5. The browser calls `POST /api/resumes/[id]/finalize`, which re-checks ownership, does a `HeadObjectCommand` against B2 to confirm the upload actually landed, and flips the row to `status: "uploaded"`.

**Download** (`GET /api/resumes/[id]/download-url`): verifies the session, checks `resumes.user_id = auth.uid()`, and returns a signed B2 **GET** URL (1–5 min expiry) with `Content-Disposition` set to the resume's current `display_name` — so downloads are always named correctly even after a rename. A resume can never be fetched by guessing/changing its id in the URL: the ownership check happens before any B2 call.

**Rename** (`POST /api/resumes/rename`): DB-only. Only `display_name` changes — the B2 object and its `storage_key` are never touched, so there's no copy/delete step and nothing that can partially fail. `original_file_name` (what the user actually uploaded) and `display_name` (what they've renamed it to) are tracked separately.

**Delete** (`DELETE /api/resumes/[id]`): verifies ownership, deletes the B2 object first (idempotent — safe to retry), then deletes the `resumes` row. `applications.resume_id` references the resume's UUID and is `on delete set null`, so deleting a resume never breaks an application's history.

## Export Center

`src/app/api/export/route.ts` streams a file for any entity (`applications`, `companies`, `contacts`, `outreach`, `interviews`, `follow_ups`, `resumes`) as `.xlsx` (via ExcelJS) or `.csv` (via PapaParse), plus a **full backup** mode that bundles every entity into one multi-sheet workbook. Applications can also be exported filtered by status. Every export is logged to the `exports` table for a visible history.

## Design system

The glassmorphism look lives entirely in `src/app/globals.css` as CSS custom properties + Tailwind utilities (`.glass-panel`, `.glass-panel-strong`, `.mesh-bg`, `.glow-cyan`, etc.), themed for both light and dark mode via `next-themes`. Accent colors are slate/emerald/cyan/silver/soft-blue/amber — no black/purple gradients. Component primitives come from shadcn/ui (Base UI), animated with Framer Motion (`src/components/shared/page-transition.tsx`, animated stat tiles, Kanban drag interactions).

The global command palette (`⌘K` / `Ctrl+K`) searches applications, companies, and contacts, and jumps to any module — see `src/components/command-palette/command-palette.tsx`.

## Notes & simplifications

- Follow-ups are computed live from `applications.follow_up_date`, `contacts.next_follow_up_date`, `outreach.follow_up_date`, and un-followed-up interview rounds, rather than requiring manual entry into a separate table — the Follow-up Center aggregates all four sources.
- "Best role category" analytics classifies applications by keyword-matching the job title (Data Science, Frontend, Backend, PM, etc.) rather than a separate stored field.
- The resume ↔ application match score, missing-keyword diffing, and cold-email-angle suggestions surface through the parser and resume detail page rather than a fully automated ML pipeline.
