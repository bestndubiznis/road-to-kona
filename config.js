window.KONA_CONFIG = {
  campaign: {
    goal: 50000,
    raised: 0,
    deadline: "2027-09-30",
    donateUrl: "",
    officialImfUrl: "https://www.ironmanfoundation.org/"
  },
  data: {
    apiUrl: "https://mobesktajbsicjamgetc.supabase.co/functions/v1/kona-api"
  },

  admin: {
    // Deliberately lightweight. The stronger protection is the server-side password check
    // in the Supabase SQL function included with this site.
    password: "IRONMAN2027"
  },
  documentedTotalsAtBuild: {"sessions": 154, "hours": 135.2, "bikeMiles": 1133.4, "runMiles": 256.1, "swimYards": 71227, "strengthSessions": 9}
};