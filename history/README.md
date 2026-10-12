# Archived ApplyOS source

This directory preserves retired source and older operational notes. It is excluded from TypeScript, ESLint, Prettier, test discovery, and the Next.js application. Nothing here runs as part of deployment.

## October 11, 2026

`2026-10-11/` mirrors original paths:

- `src/app/(app)/job-drops/`, `src/components/job-drops/`, and `src/lib/data/job-drops.ts`: the disabled collaboration feature.
- `src/lib/features.ts`, `src/lib/utils/user-display.ts`, and `src/lib/types/job-drops.ts`: its flag, name helper, and types.
- `src/components/shared/floating-drawer.tsx` and eleven unused `src/components/ui/` primitives: no active callers remained.
- `supabase/reset.sql`: an obsolete destructive reset script, preserved as a historical reference. Do not run it against deployed data; it also predates newer tables.
- `SECURITY_REVIEW.md`: the September 16 review, whose dependency audit is no longer current.

The small active `/job-drops` route only redirects old bookmarks to the dashboard. The retired private-data admin routes continue returning 404 without database access. These safeguards are intentional.

## Why migrations stay in `supabase/migrations/`

Applied migrations are the upgrade ledger, not dead application code. Their filenames and order must remain stable for existing deployments. Moving them would break automated upgrades and the regression tests that execute the actual SQL. Existing Job Drops tables are retained to preserve user data, but the public-release migration revokes browser access.

Use `npm run db:bundle` to produce one SQL file for a fresh database. Use only pending migrations for an existing database. See [database operations](../docs/database.md).

## Restoring source

Archived imports still point to their original `@/` paths. Restoring a feature requires deliberate integration, dependency restoration, a new migration to restore database permissions, and fresh tests. Copying the folder alone does not enable it. Never import `history/` from active source.
