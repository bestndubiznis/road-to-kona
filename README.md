# Walker Wells — Road to Kona website v6

Everything already logged is preserved:
- Notes history beginning May 18, 2026
- TrainingPeaks completed workouts through Sep 10, 2026
- IRONMAN 70.3 Santa Cruz on Sep 13, 2026
- Sep 20 post-race bike file
- COMPLETE Notes entries use the scheduled workout when the completion note does not restate every metric; explicit actual values override the plan.

## New: + Add workout
The public website now has a `+ Add` button. After entering the admin password you can choose either `+ Workout` or `+ Donation`.

Password:
`IRONMAN2027`

The password unlocks a workout form inside the site.

To make new workouts persist for everyone who visits the website, connect the site to Supabase once.

## One-time Supabase setup
1. Create a free project at supabase.com.
2. Open SQL Editor.
3. Paste and run `SUPABASE_SETUP.sql`.
4. In Supabase Project Settings / API, copy:
   - Project URL
   - anon/public key
5. Open `config.js` and paste them into:
   - `supabaseUrl`
   - `supabaseAnonKey`
6. Upload the site to GitHub Pages.

The historical workouts remain bundled in the site. New workouts are stored in Supabase and load automatically for every visitor.

## Free hosting with GitHub Pages
1. Create a GitHub account if needed.
2. Create a new PUBLIC repository, e.g. `road-to-kona`.
3. Upload the CONTENTS of this folder — not the zip itself.
   `index.html` must be at the repository root.
4. In the repository open Settings -> Pages.
5. Under Build and deployment:
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/ (root)`
6. Save.
7. GitHub will give you a free URL such as:
   `https://YOURUSERNAME.github.io/road-to-kona/`

You can add a custom domain later. The hosting itself can stay free.

## Admin security note
This is intentionally lightweight, but the actual Supabase insert also checks the password server-side through the SQL function. There is no direct public INSERT policy on the workout table.

## Main files
- `index.html` public site + admin modal
- `workouts-data.js` complete historical workout log
- `config.js` campaign, Supabase, and admin settings
- `SUPABASE_SETUP.sql` one-time backend setup
- `data/workouts.json` / `data/workouts.csv` historical source data


## Fundraising admin
After entering `IRONMAN2027`, choose `+ Donation`.

You can enter:
- date
- amount
- donor / source
- whether the donor name should be public
- optional note

The public fundraising progress bar updates automatically from all saved donations.

`campaign.raised` in `config.js` can still be used as a starting balance if you already raised money before turning on the Supabase donation table.
