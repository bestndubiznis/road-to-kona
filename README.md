# Walker Wells — Fitness Log

A static GitHub Pages frontend with a Supabase backend for private endurance, strength, and recovery records. The existing walkertokona.com domain continues to work; Kona fundraising and race commitments are replaced with lifelong fitness progress.

## What is preserved

All 154 historical workouts, original notes, TrainingPeaks records, Santa Cruz 70.3 (5:29:35), and September 20 ride are preserved in the private database. Totals remain 135.2 hours, 1,133.4 bike miles, 256.1 run miles, 71,227 swim yards, and 9 sessions including strength. Reconstructed historical metrics are retained as originally documented, rather than represented as newly measured values. Earlier lifting notes are not converted into invented sets.

The public historical bundles contain only session metrics. Original details previously committed to this public repository remain accessible in Git history; this change does not erase past publication. All new private notes, sets, recovery metrics, and integration credentials stay out of the repository.

## Everyday use

- Choose **Private log** and sign in with the configured owner email.
- Log endurance, strength, walking, hiking, mobility, and other sessions. Plans and skipped sessions are excluded from completed totals.
- Strength records support multiple exercises with working/warm-up sets, reps, lb/kg/bodyweight, and optional set and session RPE. Progression compares loads and volume in each recorded unit. Estimated 1RM uses Epley on 1–10-rep working sets; it is an estimate, not a measured maximum.
- Optional private daily check-ins record sleep, energy, soreness, body weight, resting HR, and HRV.
- Each workout can opt out of public progress. The public API explicitly returns only date, sport, duration, distance, source, and strength session counts. New titles are generalized except race names.
- If a sign-in email redirects to a different page, paste the full email link into the sign-in dialog. Configure Supabase Auth Site URL and redirect allowlist to https://walkertokona.com for normal direct sign-in.

## TrainingPeaks stays central

The coach continues to prescribe workouts in TrainingPeaks. A Premium calendar feed mirrors upcoming prescriptions without moving the coaching workflow. Get the private URL from Settings → Account → Calendar; enter it inside the signed-in site. URLs are stored server-side and never returned to the browser.

TrainingPeaks does not currently offer personal API access. Its calendar feed includes five past days and fourteen future days, can lag up to 24 hours, and must be checked for the coach's strength workouts. If those prescriptions are absent, add them manually using **Add prescription**. Calendar events are plans, not proof of completion. Workout Summary CSV imports support historical completed data with a preview and duplicate checks. CSV metric values use actual time/distance; planned time is never substituted.

Optional Intervals.icu connectivity collects completed device workouts while keeping TrainingPeaks for coaching. Connect devices there first, then add athlete ID and personal API key in this site's private connections panel. The sync reads the last 30 days and uses external IDs for idempotence. Existing matching workouts and private lifting sets are preserved. This connection is optional and is not active until credentials are supplied.

## Backend

- `FITNESS_SETUP.sql`: private tables, RLS, and permissions. Browser roles have no table access; fitness-api verifies the owner's email with Supabase Auth `getUser` before private operations.
- `supabase/functions/fitness-api/index.ts`: public projection, private CRUD, imports, and provider sync. JWT gateway verification is disabled because anonymous reads are allowed; function-level owner JWT validation protects every private action. A private scheduler key grants only provider synchronization.
- `lib/fitness.mjs`: shared parsing, validation, projections, totals, and progress calculations. Keep its function copy in sync.
- Hourly Supabase Cron runs `fitness-hourly-sync`. It reads its key from restricted server-side settings, not a public source file.
- `fitness_followups` tracks once-per-day chat prompts. See `FITNESS_OPERATIONS.md` for conversational logging instructions.
- Dependencies are pinned: vendored browser Supabase JS 2.117.2 and the same Edge Function version.

## Validation

Run `node --test tests/fitness.test.mjs` and `node --check app.mjs`. Preview with `python3 -m http.server 8765`. Verify public API responses never contain notes, sets, RPE, recovery, or credentials; private endpoints must reject anonymous and non-owner sessions.

The existing campaign database tables are retained as historical records. New fitness data is stored only in the private fitness tables.
