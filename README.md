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
- **AI parsing:** OpenAI `gpt-5-mini` (single primary model, low reasoning effort, at most one same-model retry), controlled by server-side per-user entitlements
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
      ai-parser/              OpenAI-backed job description parser + usage endpoint
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
    ai-parser/               OpenAI-backed job description parser (schema, prompt, service, auth, cache, rate limiting, usage tracking)
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
2. Back up the database, then run `supabase/schema.sql` followed by every file in `supabase/migrations/` in timestamp order. The schema is the fresh-project baseline; migrations are append-only corrections and feature additions, including the latest RLS/view/rate-limit hardening. For a linked Supabase CLI project, use the equivalent migration workflow instead of manually pasting individual files. Never run `supabase/reset.sql` on a deployment with data.
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

Copy `.env.example` to `.env.local` and fill in:

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

APP_OWNER_EMAIL=owner@example.com
OPENAI_API_KEY=<redacted-placeholder>
AI_PARSER_MODEL=gpt-5-mini
AI_PARSER_REASONING_EFFORT=low
AI_PARSER_MAX_RETRIES=1
AI_PARSER_MAX_INPUT_CHARS=50000
AI_PARSER_DEFAULT_DAILY_LIMIT=100
AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD=5
AI_PARSER_MINUTE_LIMIT=5
AI_PARSER_CONCURRENCY_LIMIT=2
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
3. Add the same environment variables from `.env.local` in the Vercel project's **Environment Variables** settings. Every variable except the two explicitly named `NEXT_PUBLIC_*` is server-only; never add a `NEXT_PUBLIC_` prefix to the service-role, B2, owner, OpenAI, or parser-control values.
4. Deploy. Vercel builds with `next build` automatically — no extra config needed.
5. Back in Supabase, add your production URL to **Authentication → URL Configuration → Redirect URLs** (needed for password reset).

## The AI job description parser

`POST /api/ai-parser` (`src/app/api/ai-parser/route.ts`) accepts a pasted job URL + description and returns a comprehensive structured extraction — identity, location, employment, compensation, skills, experience/education, role content, immigration/sponsorship, and a set of AI-generated relevance classifications — grouped as nested objects (`src/lib/ai-parser/schema.ts`). Every field carries a provenance status (`explicit` / `normalized` / `inferred` / `uncertain` / `missing`) so inferred or uncertain values are never presented as verified facts.

- Powered by OpenAI's Responses API with strict structured outputs: `gpt-5-mini` is the single primary model (`AI_PARSER_MODEL`, `reasoning.effort` set to `low`). At most `AI_PARSER_MAX_RETRIES` extra attempts (default 1) are made against that *same* model, and only for a retryable provider error, malformed structured output, or Zod validation failure — never for a different model, and never because of the model's own self-reported `metadata.overallConfidence` (that field is UI-facing metadata only) (`src/lib/ai-parser/service.ts`).
- **Access is controlled per-user**, not by a hard-coded email allowlist. `requireAIParserAccess` (`src/lib/ai-parser/entitlement.ts`) checks a per-user row in `ai_parser_entitlements` — enabled, not suspended, not expired — before any provider call; missing/disabled/suspended/expired all fail closed with a 403. The permanent owner account (`APP_OWNER_EMAIL`) is granted `owner` role + an enabled entitlement automatically on first sign-in (`src/lib/admin/roles.ts`); every other account's access is managed from **Settings → Administration**, visible only to the owner (`src/components/settings/admin/`).
- A narrow deterministic pre-pass (`src/lib/ai-parser/deterministic.ts`) extracts URLs, emails, salary ranges, dates, and requisition IDs with regex before the AI call, and those values take precedence over the model's own extraction.
- Results are cached per user + description hash + schema/prompt version (`src/lib/ai-parser/cache.ts`), rate-limited via an atomic Postgres RPC (`src/lib/ai-parser/rate-limit.ts`, `ai_parser_try_acquire_slot`) using each user's effective daily limit, and every attempt's token counts/cost/latency are recorded to `ai_parser_usage` for the **Settings → AI Parser Usage** tab (`src/components/settings/ai-usage-tab.tsx`) — scoped strictly to that user's own `user_id`.

The AI Parser panel (`src/components/applications/parser/ai-parser-panel.tsx`) appears on both the Add Application page (floating glass drawer) and the Edit Application dialog, with per-field accept/reject checkboxes, provenance badges, and collapsible sections per field group. Accepted fields map onto the application form via `src/lib/ai-parser/apply-to-form.ts`; the full structured result (plus provenance) is saved to `parsed_job_details.full_result` for auditing. See the env vars in `.env.example` (`APP_OWNER_EMAIL`, `OPENAI_API_KEY`, `AI_PARSER_MODEL`, `AI_PARSER_REASONING_EFFORT`, `AI_PARSER_MAX_RETRIES`, `AI_PARSER_MAX_INPUT_CHARS`, `AI_PARSER_DEFAULT_DAILY_LIMIT`, `AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD`).

### Administration (owner-only)

The account whose verified email matches `APP_OWNER_EMAIL` gets an **Administration** tab in Settings (never a separate `/admin` route or login) — gated server-side by `requireOwner()` (`src/lib/admin/roles.ts`), never by a client-computed email check. From there the owner can, per user: grant/revoke/suspend/reactivate AI parser access, set daily-request and monthly-budget limits, view usage totals and recent parser activity metadata, send a Supabase password-reset email, rotate their password to terminate refresh sessions, and disable/re-enable the account. Already-issued access JWTs remain usable until their short expiry, so configure an appropriately short Supabase JWT lifetime. It never shows job applications, resumes, job descriptions, notes, or any other private product data, and there's no "browse another user's records" or impersonation feature. Successful mutations are written to `admin_audit_log` (`src/lib/admin/audit.ts`).

## Resume storage — Backblaze B2

Resume files never touch Supabase. Supabase's `resumes` table stores only metadata and a `storage_key` — the B2 object path — never the file itself and never a public URL. All B2 access is mediated by server-side, ownership-checked API routes (`src/lib/storage/b2.ts` holds the only code in the repo that imports `@aws-sdk/client-s3`, and it's guarded with `import "server-only"` so it can't be pulled into client-side bundles).

**Upload** (`POST /api/resumes/create-upload-url` → direct browser→B2 PUT → `POST /api/resumes/[id]/finalize`):

1. The browser sends the file's name/type/size (not the file itself) to `create-upload-url`.
2. The server verifies the Supabase session, validates the MIME type (PDF/DOC/DOCX only) and size (≤20MB), and reserves a `resumes` row with `status: "uploading"`.
3. The server generates a temporary upload key itself — `users/{user_id}/resumes/{resume_id}/uploads/{uuid}-{safe_filename}` — the browser never chooses a raw key, and receives only a scoped signed B2 **PUT** URL that expires in 5 minutes.
4. The browser uploads the file directly to B2 using that URL — the file bytes never pass through the Next.js server.
5. The browser calls `POST /api/resumes/[id]/finalize`, which re-checks ownership, verifies object size/content type plus PDF/DOC/DOCX magic bytes, then conditionally copies the inspected ETag to a new server-only `files/` key. The database is pointed at that final key and the temporary object is removed. Reusing the browser's signed PUT can therefore never replace the object served by ApplyOS.

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
- The resume ↔ application match score on the resume detail page is a separate, unrelated feature from the AI job description parser (the parser no longer does resume matching, duplicate-application detection, or subjective "intelligence" scoring — it's a pure structured field extractor).
