# Progress journal preview

Local review branch: `design/progress-journal`. Approved for publishing on October 7, 2026.

Run `python3 -m http.server 8766 --bind 127.0.0.1` in this checkout and open http://127.0.0.1:8766/?preview=1. The ignored `preview-data.json` contains a sanitized Oct 7 snapshot (public metrics and basic plan dates/sports/durations only). Preview mode disables authentication, writes, and push registration. Without that query parameter the application uses its normal API.

Changes: cumulative hours, clickable effort calendar, sport time distribution, two-week public plan view, shared persistent period for progress/muscles/lifting/log, public exercise search, progress landing in standalone mode. Best efforts stay explicitly all-time; calendar weeks have their own selector. Additional log dates narrow the main selected period.

Publishing requires frontend publishing and deployment of the updated fitness-api including public-plans.mjs. Only date, sport, planned duration and planned status are exposed for this and next calendar week. No auth, RLS, notification or sync schedules changed. Deploy the API and frontend together for public plans.

Validation: node --test tests/*.test.mjs plus browser checks of date filtering, lifting mode, plan view, and responsive layouts.
