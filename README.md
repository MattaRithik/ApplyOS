# ApplyOS

A private job-search workspace for applications, companies, contacts, outreach, resumes, interviews, follow-ups, and timelines. The AI parser extracts job details into fields that users review before saving.

Built with Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase, and Backblaze B2. Supabase handles authentication and application data with row-level security. Resume files live in a private B2 bucket; server routes validate ownership before issuing short-lived signed URLs. Deployment targets Vercel.

Public privacy, terms, cookies, acceptable use, AI disclosures, and data request pages live in the Legal Center at `/legal`. See [legal policy operations](docs/legal-policies.md) for public contact configuration and release requirements.

## Local development

Use Node.js 22 (`.nvmrc`) and npm:

```sh
npm ci
cp .env.example .env.local
# Fill in .env.local using your development services.
npm run check:env
npm run dev
```

Open `http://localhost:3000`. Never commit `.env.local`. Only the Supabase URL and anonymous key belong in public environment variables; service-role, B2, and AI credentials remain server-only.

## Database setup

For a fresh Supabase project, run `npm run db:bundle` and review/execute `dist/database/bootstrap.sql`. For an existing project, back it up and apply only pending files from `supabase/migrations/` in timestamp order. Do not replay the baseline over a deployed database.

Read [database operations](docs/database.md) for upgrade order, rollback boundaries, and the new public-release guards. Applied migrations remain in place because they are the database's upgrade ledger. Retired source is documented in [history/README.md](history/README.md).

## Service configuration

- **Supabase:** Set the site URL and exact authentication callback redirect allowlist. Email/password login is implemented; Google/GitHub configuration is planned next. Verify confirmation, password policy, abuse controls, and email delivery before public signup.
- **Backblaze B2:** Use a private bucket and a bucket-restricted application key with file read/write/delete capabilities. Set `B2_ENDPOINT`, `B2_REGION`, bucket name, and credentials. Configure CORS for the intended app origins.
- **Administration:** The verified account matching `APP_OWNER_EMAIL` bootstraps the permanent owner role. Administration handles account support, AI access, cost estimates, and signed-in activity. Private application/resume admin endpoints remain retired.
- **Restricted accounts:** [Download-only account blocking](docs/blocked-accounts.md) preserves sign-in for a private ZIP of the user's records and original resume files while blocking normal workspace access.
- **AI parser:** Access is granted per account through entitlements. Defaults are `gpt-5-mini`, low reasoning, at most one retry, 100 requests/day, and the configured per-user budget. The global monthly reservation budget defaults to $50. Review [public-release notes](docs/public-release.md) before changing these limits.

Validation and database bundle commands do not change hosted services. The explicit `scripts/workspace-access.mjs block|restore` commands change a selected live account through the audited administrative RPC; `--prepare-sql` only writes a local script.

## Verification and formatting

```sh
npm run format
npm run check
npm run build
npm run test:presence-runtime
npm audit --omit=dev
```

`check` runs formatting verification, lint, TypeScript, and tests. Tests use mocks or disposable PostgreSQL, including the complete baseline and migration chain. CI runs the same checks and a production build with placeholders. Formatting ignores archived source and immutable SQL migrations.

## Active source

| Path                                          | Purpose                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `src/app/(auth)/` and `src/app/auth/`         | Authentication pages and session callback                                |
| `src/app/(app)/`                              | Authenticated pages and server actions                                   |
| `src/app/api/`                                | Parser, export, resume, presence, and administration routes              |
| `src/components/`                             | Feature UI and the UI primitives actually used                           |
| `src/lib/security/` and `src/lib/validation/` | Ownership checks, request limits, and runtime validation                 |
| `src/lib/ai-parser/`                          | Parsing, provenance, quality corrections, cache, rate limits, and usage  |
| `src/lib/storage/`                            | B2 signing, validation, promotion, and deletion                          |
| `src/lib/presence/`                           | Signed-in connection state, interaction tracking, and activity summaries |
| `src/test/`                                   | Shared fixtures and database integration tests                           |
| `supabase/`                                   | Baseline and ordered migrations                                          |
| `scripts/`                                    | Local validation and packaging utilities                                 |
| `docs/`                                       | Current operation and public-release notes                               |
| `history/`                                    | Retired source and historical notes, excluded from active tooling        |

See [public-release preparation](docs/public-release.md) for implemented controls, known boundaries, and staging/deployment checks.
