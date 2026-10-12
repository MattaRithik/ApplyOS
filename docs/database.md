# Database operations

`supabase/schema.sql` is the historical baseline. `supabase/migrations/` is the ordered upgrade ledger and supplies the current policies, telemetry, and resource guards. The baseline alone is not the current database.

## Fresh database

Run `npm run db:bundle`. Review `dist/database/bootstrap.sql` and execute it only against a fresh Supabase project. The command concatenates the baseline and every migration in timestamp order; it never connects to a database. The generated file is ignored by Git.

The full setup is tested in a disposable PostgreSQL fixture by `src/test/public-release.database.test.ts`. The fixture supplies Supabase's roles, auth schema, and realtime publication. It omits only the `pgcrypto` extension declaration because PostgreSQL already provides the UUID function and PGlite does not bundle that extension.

## Existing deployment

Back up the database and record the applied migration versions first. Apply only missing migration files in timestamp order. Never replay the baseline or fresh bootstrap over deployed data: the baseline recreates earlier policies and can undo later hardening. A linked Supabase CLI project needs its migration ledger reconciled with previously applied SQL before `supabase db push`; the repository does not configure that link automatically.

The new migration is `20261011180000_public_release_guards.sql`. It is transactional and safe to reapply. It:

- Adds a parser budget reservation column and service-only spending/reservation RPCs.
- Rechecks AI entitlement when acquiring a parser slot.
- Serializes user and global monthly budget decisions.
- Limits new resume reservations to 50 files and 100 MB per account, including archived and unfinished uploads.
- Revokes browser permissions on the archived Job Drops tables and membership helper.

Existing application data and resume records are preserved, including accounts already over quota. Those accounts must remove files before adding more. The migration creates no automatic cleanup job.

Deploy the migration before the updated application. Until it exists, parsing fails closed with a service-unavailable response. Previous code continues using its previous RPC; deploy the application promptly so the new budget guards become effective.

## Rollback and maintenance

Use a forward correction for database changes. Do not undo the new permissions or edit historical migrations to make an older build work. The new columns and RPCs can remain if application code is rolled back; the old application will not enforce the new AI budget reservations.

Before public launch, schedule and document cleanup for abandoned B2 upload objects, expired parser caches, old API rate-limit events, and activity records. Deleting resume rows alone does not delete B2 objects. Preserve cost records and reconcile unknown provider charges before releasing their reservations. No production cleanup was performed during this change.
