window.KONA_CONFIG = {
  campaign: {
    goal: 50000,
    raised: 0,
    deadline: "2027-09-30",
    donateUrl: "",
    officialImfUrl: "https://www.ironmanfoundation.org/"
  },
  data: {
    // Optional legacy Google Sheet path; can stay blank.
    sheetCsvUrl: "",
    googleFormUrl: "",

    // Recommended live-update path:
    // Create a free Supabase project, then paste the Project URL + anon/public key here.
    // Historical workouts remain embedded in workouts-data.js.
    // New workouts are stored in Supabase and automatically appear for everyone.
    supabaseUrl: "",
    supabaseAnonKey: ""
  },

  admin: {
    // Deliberately lightweight. The stronger protection is the server-side password check
    // in the Supabase SQL function included with this site.
    password: "IRONMAN2027"
  },
  documentedTotalsAtBuild: {"sessions": 154, "hours": 135.2, "bikeMiles": 1133.4, "runMiles": 256.1, "swimYards": 71227, "strengthSessions": 9}
};