# Fitness log operations for this chat

The user wants endurance and strength progress over time, public aggregate progress and private detailed logs. Their coach continues to prescribe workouts in TrainingPeaks. The user chose this Codex chat for prescribed-lifting follow-ups around 8:30 p.m. America/Los_Angeles.

Supabase project: `mobesktajbsicjamgetc`. All `fitness_*` tables require server privileges; use the authorized Supabase connector. Do not put private data, email addresses, calendar feed URLs, API keys, or auth tokens in GitHub commits or public files.

## Daily check-in

At 8:30 p.m. Pacific, first check whether phone push is configured in `fitness_push_subscriptions` and inspect today's `fitness_push_deliveries`. A successful phone reminder replaces the chat prompt. If a subscription exists but delivery is still pending, allow the server its 8:30–10 p.m. delivery window; do not duplicate the phone reminder. If delivery repeatedly fails or subscriptions expire, give one actionable notice and resume chat fallback. If no subscription exists, determine today's date in America/Los_Angeles. Read `fitness_workouts` with `data->>'date'` matching today and `data->>'status'='planned'`. Ask only when a strength prescription exists and its completed lifting details have not been supplied. A mixed workout counts when its `strength` flag is positive. Do not infer a prescribed day from past patterns. Skip already asked dates using `fitness_followups` and stay quiet on non-strength days, rest days, disconnected calendars, and unchanged state. Identify scheduled session title and ask which exercises were actually done, sets × reps × weight, units, and optional effort. The user may report a skipped or substituted workout.

Record the prompt date and workout IDs in `fitness_followups`. Mark `answered_at` after saving the answer. Do not repeatedly nag if the user has not replied. Report an integration failure once when actionable, then stay quiet while unchanged. Never claim TrainingPeaks was checked when the feed is disconnected or stale. If a new strength-builder workout is missing from the calendar feed, the user can add a prescription through the private site.

## Logging replies

User authorization includes saving workout details reported in this chat to the private fitness log. Preserve all explicit exercises, reps, sets, weights, units, and effort. Do not infer omitted weights, reps, or whether dumbbell weight is per hand. Clarify only material missing information; still save what is known in private notes. Confirm the workout date when ambiguous. A rest/skipped response updates the prescription status to `skipped` and contributes no completed totals.

Each `fitness_workouts` row has UUID `id`, unique nullable `external_id`, `data` JSONB, and timestamps. Update a matching prescribed row rather than inserting a second completed copy. Preserve `external_id` and all source notes. For a substituted session update actual sport and exercises. The `data` shape is:

```
{date, type, title, status, duration_hours, bike_miles, run_miles, swim_yards,
 strength, source, public_progress, private_notes, rpe,
 exercises:[{name,unit:"lb"|"kg"|"bodyweight",sets:[{reps,weight,rpe,kind:"working"|"warmup"}]}]}
```

Only explicitly reported measurements go into numeric metrics. Use null for omitted RPE; preserve unknown reps/load in notes instead of inventing numeric sets. Mixed historical strength is already included in the original sport record. Detailed exercise progression requires explicit sets. Never overwrite historical original notes. Plans/skipped sessions do not count as completed.

Use safely quoted JSON SQL or connector parameters. After saving, query the affected record to verify, then acknowledge the workout and any meaningful progression. Changes immediately appear in the site's private log and allowed public totals. Do not send email, texts, or messages to any other person.
