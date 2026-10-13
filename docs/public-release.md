# Public release preparation — October 11, 2026

## Implemented

| Area                  | Current behavior                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime dependencies  | Next.js and its ESLint configuration upgraded to 16.4.0; vulnerable runtime transitive packages patched in the lockfile. `npm audit --omit=dev` reports zero vulnerabilities.                                                                |
| Retired source        | Job Drops, unused UI components, the destructive reset script, and the previous security review live under `history/`. Builds, lint, formatting, and tests exclude that folder.                                                              |
| Tenant isolation      | A full baseline-plus-migrations test checks RLS, own-account reads, cross-user relationships, protected metadata, admin tables, and service-only RPCs.                                                                                       |
| Server inputs         | Applications, companies, contacts, outreach, templates, interviews, and profile updates validate runtime types, enums, dates, URLs, numeric ranges, list lengths, and text lengths. Optional blank date/link/email fields normalize to null. |
| AI spending           | Database aggregation avoids PostgREST row truncation. Each acquired request reserves $0.30 before any provider call; user and global monthly decisions use the same transaction lock.                                                        |
| AI execution          | SDK automatic retries are disabled; the service permits at most one deliberate retry. Each provider request has a 25-second timeout and 12,000 output-token ceiling. Failed attempts retain recoverable usage across retries.                |
| Storage               | New upload reservations enforce 50 files / 100 MB per account. Conditional finalization prevents concurrent writes from overwriting completed metadata. Signature and ETag validation remain in place.                                       |
| Reporting and exports | Parser reporting and stored entity exports page past the API row limit and fail on read errors instead of returning incomplete records.                                                                                                      |
| Maintenance           | Prettier, environment validation, a database bundle command, and a CI workflow make local verification repeatable.                                                                                                                           |

The Next.js upgrade includes the maintainer's [ImageResponse advisory fix](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j). Its exploitability depends on passing attacker-controlled SVG content; upgrading still removes the affected dependency version.

## Defaults and limits

AI access remains explicitly granted per account in Administration. Opening signup does not grant paid parsing to every new user.

`AI_PARSER_GLOBAL_MONTHLY_BUDGET_USD` defaults to 50 when absent. Set it to 0 to stop new parser reservations. Each request reserves $0.30; successful finalization replaces that reservation with the recorded estimated cost. A user with less than $0.30 remaining cannot start another parse, including the existing cached-request flow. Failed or interrupted requests without recoverable cost retain the reservation until reconciled. These are conservative estimates and application controls, not a guarantee of the provider's invoice. Keep the provider project's own spend controls enabled. Changing model pricing, output ceilings, or retry counts requires reviewing the reservation amount together.

The storage quota includes archived and unfinished rows. Deleting a resume through the application releases its quota and performs B2 cleanup. Individual file size remains 20 MB.

## Validation commands

```sh
npm ci
npm run check:env
npm run check
npm run build
npm run test:presence-runtime
npm run db:bundle
npm audit --omit=dev
```

CI uses build placeholders and disposable test databases, not production credentials. `check:env` validates configuration locally without printing secret values or contacting providers.

Local validation passed: 541 tests across 59 files, formatting, lint, TypeScript, the production build, the compiled heartbeat runtime check, configuration validation, and the SQL bundle command. Production HTTP checks confirmed public landing/login/preview-image responses, protected-page redirects, anonymous API 401 responses, and security/cache headers. No configured service-role, B2 application, or OpenAI secrets were found in the final client bundles. These checks did not open an authenticated browser or write to production.

The full dependency audit still reports a development-only `braces` advisory through ESLint/shadcn globbing. The published latest `braces` version remains affected; npm's suggested downgrade is not a compatible fix. Do not feed untrusted glob patterns to development tools. Review this advisory on dependency updates. The shadcn CLI is a development dependency because its CSS is needed at build time; four unused form/icon/calendar packages were removed.

## Before opening registration widely

1. Apply pending migrations, then deploy this build. See [database operations](database.md).
2. Verify a second account can create/edit its own records and cannot access the first account's data; verify normal upload, download, delete, parse, and export flows in staging.
3. Enable and verify Supabase email confirmation, appropriate password policy, CAPTCHA/rate limits, SMTP delivery, and an exact production redirect allowlist. Configure Google/GitHub providers in the next login phase. A browser password minimum alone is not server-side enforcement.
4. Verify the B2 bucket is private, its CORS permits only intended app origins, and its application key is restricted to that bucket. Check lifecycle handling for abandoned uploads and incomplete cleanup.
5. Review and deploy the [legal pages](legal-policies.md). Configure the public operator/contact details, establish a monitored request channel, and confirm retention and international processing arrangements. The pages disclose current activity storage and manual account deletion; they do not implement a new retention schedule or a self-service deletion flow.
6. Confirm backups and restore procedures, error monitoring, provider spend alerts, and an incident contact. The migration and application changes were prepared locally; production settings and real provider flows have not been changed or certified.

This is a tested hardening pass, not a claim that every public-release challenge has been eliminated. Large application-list/dashboard queries still need a dedicated pagination and aggregation pass as usage grows; stored entity export correctness and parser spending are handled here. Follow-up exports use the existing computed follow-up feed.
