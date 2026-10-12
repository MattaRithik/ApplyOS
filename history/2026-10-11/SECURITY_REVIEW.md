# Security review — September 16, 2026

Local source review and hardening of authentication, admin authorization, API boundaries, server actions, database policies, resume storage, exports, dependency versions, and tracked secret patterns. This is not a penetration test of the deployed service or a guarantee that every vulnerability has been found.

## Changes

| Area | Finding and fix |
| --- | --- |
| Dependencies | The initial npm audit reported 16 affected packages (1 critical, 9 high, 6 moderate). Upgraded Next.js and its ESLint config to 16.3.5 and patched vulnerable transitive dependencies in the lockfile. Final audit: zero known vulnerabilities. Advisory applicability varies with runtime and configuration. |
| Login | The `next` query parameter reached `router.push` without validation. Login and the authentication callback now share local-path validation, rejecting external URLs, script schemes, backslashes, control characters, and paths that normalize to a protocol-relative destination. |
| Requests | JSON limits previously applied after the full body was buffered. The reader now enforces byte limits while streaming, cancels oversized streams, handles split UTF-8 characters, and rejects malformed encoding. Same-site requests without an Origin are also rejected. |
| Sessions | Authentication redirects preserve refreshed/cleared cookies. Anonymous API requests receive JSON 401 responses. Session-dependent responses, including callbacks, carry `private, no-store`. |
| Resume uploads | Signed PUT URLs now bind the declared byte length. Signature inspection uses the same ETag as the metadata check; promotion already had an ETag precondition. This closes the gap between the HEAD and signature-read operations. |
| Exports and links | Formula protection now covers joined arrays and whitespace-prefixed formulas. Export generation is limited to five requests per user per minute using the existing database limiter. Mailto addresses cannot introduce URI query headers. Stored Job Drops links are checked before rendering. |
| Database | Job Drops statuses must reference a message in the same thread for reads/inserts/updates. Its privileged membership helper cannot probe another user's membership. New message writes enforce HTTP(S), URL length, and caption limits. Existing data is preserved; inconsistent legacy statuses are hidden by RLS. |
| Configuration | Disabled the framework-identification header and ignored all environment-file variants except the example. No matches were found in the tracked-file scan for private keys and common OpenAI/GitHub/AWS credential patterns; this was not a history scan. |

The Next.js upgrade covers the maintainer's [Windows server advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) and [AVIF image-processing advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), among the audit findings.

## Validation

- All 326 tests across 35 files passed, covering authorization, redirects, oversized streams, export limits, formula injection, upload version checks, and existing app behavior.
- A disposable PGlite PostgreSQL database executes the actual Job Drops migrations and tests RLS with an authenticated role, including cross-thread attacks, allowed upserts, column permissions, migration reapplication, and data preservation. No production data is used.
- ESLint, TypeScript, and the Next.js production build passed.
- Local production HTTP checks verified anonymous page redirects, API 401s, cache protections, CSP, frame denial, `nosniff`, and absence of `X-Powered-By`.
- An offline AWS SDK signing check confirmed that `content-length` is included in the upload URL's signed headers.

## Deployment and boundaries

Apply `supabase/migrations/20260916120000_link_security_hardening.sql` after existing migrations, then deploy the app with the updated lockfile. The existing `20260712150000_security_hardening.sql` migration supplies the limiter used by exports and resumes. The new migration is transactional, repeatable, and does not delete user data. Its SQL is mirrored in `supabase/schema.sql` for fresh installations.

These changes have not been deployed or applied to the production database. Hosted Supabase policies/settings, Backblaze bucket privacy/CORS, production secrets, and authenticated browser uploads were not verified against the live services. Validate a normal upload/download after deployment; the browser supplies Content-Length automatically.

Existing boundaries remain: file signatures are not antivirus scanning; the CSP still permits inline scripts/styles; Supabase controls signup/password/recovery abuse protections; existing JWTs may remain valid until expiry after an account action; AI monthly budget checks are monitoring thresholds rather than atomic billing caps. Database tests cover the changed Job Drops policies, not every production table. Job Drops remains hidden.
