# Hosted TrainingPeaks mirror

GitHub Actions runs an isolated Chromium browser at approximately 8:05 p.m. Pacific (two UTC schedules with a DST-aware gate). Standard public-repository Linux runners are used. No downloads, cookies, screenshots, workout files, or traces are uploaded as artifacts. Actions can delay or miss scheduled runs; the independent Supabase watchdog alerts after 36 hours without a successful check.

## One-time owner setup

Only the owner can generate a narrowly scoped runner key in the private site's connection settings. That key allows import of recent/upcoming TrainingPeaks exports and sync-health reporting; it cannot read private workouts, recovery entries, sign-in tokens, or notification subscriptions. Supabase stores only its SHA-256 digest.

The owner must explicitly approve storing the TrainingPeaks sign-in in GitHub Actions encrypted secrets, then enter these directly in GitHub's repository secrets UI:

- `TP_USERNAME`: TrainingPeaks username.
- `TP_PASSWORD`: existing TrainingPeaks password.
- `FITNESS_RUNNER_KEY`: generated in the owner's private fitness log.

Do not send these through chat or commit them. Enable the hosted check in the private site, then dispatch the workflow once. A fresh sign-in is performed each run; passwords are never stored in Supabase or the website. MFA/CAPTCHA or an account challenge is not bypassed: the job reports `needs_login` and requires owner attention. Browser sign-in remains unverified until this first real run succeeds.

Enable push notifications on the phone from the installed site's private log and send a test. No device was subscribed when this integration was prepared. Failure notifications link to the private connection section and deduplicate per unresolved reason and device. Expired subscriptions are removed. The server watches runner silence independently of GitHub's failure-report step. Alerts need the Supabase project and browser push service to be available; they are not an unconditional delivery guarantee.

After the hosted runner's first successful import, replace the local daily TrainingPeaks mirror with a quiet monitor/fallback. Keep the evening actual-workout check-in. If a website change breaks selectors, fix `hosted/run.mjs`, dispatch again, and verify the server success timestamp before claiming restoration.

## Server deployment

Apply `HOSTED_SYNC.sql` for the service-role-only atomic import RPC. Deploy `supabase/functions/fitness-api/` including `tp-hosted.mjs`, kept identical to `lib/tp-hosted.mjs`. The existing custom owner/scheduler authentication remains; the new runner key is separately scoped. A signed-in browser gets only safe status fields, never the key digest or repository credentials.

Run `node --test tests/*.test.mjs`. The hosted job uses the pinned `hosted/package-lock.json`; `npm ci --prefix hosted` and Chromium installation happen in the runner. Import rejects unexpected CSV headers, dates outside the 21-day-history/14-day-plan window, ambiguous duplicate matches, or concurrent user edits. Plans carry no actual totals; user notes, sets, privacy, skipped decisions, and original history survive.
