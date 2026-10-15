# Blocked accounts with data downloads

ApplyOS supports a workspace restriction separate from Supabase's authentication ban. A restricted account can sign in, see `/blocked`, download its own records and original uploaded resume files, read legal/support pages, and sign out. It cannot open workspace pages, call ordinary APIs, submit server actions, use AI parsing, or query/update workspace tables directly through Supabase.

The screen states: “You have been blocked from using ApplyOS.” No other user's identity or data appears on it.

## Installation and activation

1. Deploy the updated application code. It understands restricted accounts before any account is marked.
2. Apply `supabase/migrations/20261013220000_workspace_export_only.sql`. This adds a restrictive RLS policy to every existing public RLS table, the live account check, and an atomic owner-only access-change/audit RPC. It also rejects new parser usage and resume reservations for blocked accounts, including in-flight calls from older code.
3. In Settings → Administration, select the account and choose **Block workspace**. This preserves authentication and data. **Disable account** remains the separate operation that prevents sign-in entirely; do not use it when the user must download their data.

An operator CLI is also available:

```sh
node scripts/workspace-access.mjs block USER_UUID
node scripts/workspace-access.mjs restore USER_UUID
```

The CLI resolves the configured, verified owner and uses the same audited RPC. It never writes a flag to user-editable metadata. To prepare one reviewable SQL script that installs the migration and restricts the selected account atomically:

```sh
node scripts/workspace-access.mjs block USER_UUID --prepare-sql exports/block-account.sql
```

This preparation command only reads account metadata and writes a local SQL file. Run that file in Supabase **after deploying the application**. It leaves other accounts and all stored records/files intact. Auth-banned accounts must have sign-in re-enabled before the download-only workflow is used.

## Enforcement

Apply `supabase/migrations/20261015120000_blocked_screen_activity.sql` with the updated application to record blocked-screen visits. The blocked page sends authenticated heartbeats through the exact POST `/api/presence` endpoint. Restricted accounts may report only the `blocked` page; older workspace tabs still receive `WORKSPACE_BLOCKED` and redirect. This exception grants no workspace or direct database access.

Settings → Administration → **Live Activity** shows the latest **Last seen** timestamp and **Blocked screen** label even when the user opens the page without interacting. **Recent activity** retains one **Opened blocked screen** event per page opening/tab, without adding events for recurring heartbeats. **Users & AI Access** also shows the authentication provider's **Last sign-in** date and time; reopening an existing signed-in session is recorded as a screen visit, not a new login. Live Activity refreshes every 15 seconds while visible.

`workspace_access = export_only` lives in server-controlled `auth.users.raw_app_meta_data`. The proxy reads the validated current Auth user on each request. The app layout and privileged authentication helper provide additional checks. Active tabs move to the blocked screen when a heartbeat receives the restriction response.

RLS uses `workspace_access_allowed()`, a security-definer function restricted to returning the current user's boolean access status. It reads the current auth row, so old JWT claims do not preserve access. Users cannot lift a restriction by editing their profile, user metadata, cached client state, or token claims. The account-access RPC rejects non-owner actors and changes to the owner/self; access and audit updates commit together. New public data tables must carry an equivalent restrictive policy; a database test checks coverage.

Only exact POST endpoints `/api/presence`, `/api/account/export`, and `/api/account/sign-out` bypass the workspace gate. `/blocked` and legal pages allow GET only. The download route verifies authentication independently, accepts no target ID or storage parameters, rejects cross-site requests, limits requests to three per ten minutes, and scopes all privileged data reads to that authenticated account. Service credentials and raw storage keys are never exported.

## Archive contents

- `Your data.xlsx`: account/profile, all applications, companies, contacts, outreach, interviews, stored follow-ups, notes, templates, resume metadata, application status history, parsed job details, international profile/timelines, export history, parser usage/cache/input/result records, entitlements, and activity/download records. Archived rows are included. Long cells are split into a numbered `Long text` sheet to preserve the full value.
- `records.json`: the exported records with their full nested values and long text. This self-service archive includes the user's own optional profile information; the normal Export Center's narrower omissions remain unchanged.
- `resumes/<resume-id>/<original-file-name>`: each finalized uploaded file, in its original format and bytes. Duplicate file names are separated by resume ID. No PDF conversion occurs.
- `resume-manifest.json`: every resume record, whether its file is included, and its path within the archive. Failed or unfinished uploads have no finalized downloadable file and remain visible in this manifest.
- `README.txt`: scope and file instructions. Authentication secrets, storage credentials, internal administrative audit content, and retired shared-message content are excluded.

The ZIP streams file bytes from private B2 storage with backpressure and cancellation. It does not load every resume into memory or create a permanent public archive. An unreadable expected original aborts the download rather than silently providing a valid archive missing that file. Accounts over 2 GiB of resume data or 5,000 completed files need an assisted export. Hosting duration/streaming limits still apply; the route requests a 300-second maximum. Existing signed resume links can remain valid until their five-minute expiry.

Deployment configuration must support streaming responses. See [Vercel response limits](https://vercel.com/docs/functions/limitations) and [streaming responses](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions). No database migration, deployment, or access change is implied by running local tests or preparing SQL.

## Verification

Automated tests cover stale JWT restrictions, direct database read/write denial, user-metadata bypass attempts, owner-only access changes and audit atomicity, source-row preservation, scoped collection against the real database schema, API authentication/CSRF/target-parameter rejection, archive cancellation, duplicate names, missing-object failures, and long spreadsheet values. A read-only download check against the requested account verified 166 applications, 101 resume records, 100 original completed uploads, and a 25-sheet workbook in a valid ZIP. The unfinished resume record is listed in its manifest. That check did not change account access or sign in as that user.
