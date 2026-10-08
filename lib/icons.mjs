// Small, dependency-free stroke icons; adjacent text supplies accessible labels.
const paths={
 run:'<circle cx="14" cy="4" r="2"/><path d="m8 10 4-3 4 4 4 1M12 7l-2 7 5 3 1 4M10 14l-4 6H2M9 9l-3 4H3"/>',
 bike:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-9 5 9H5m5-9 9 9-3-13h-3M8 8h5"/>',
 swim:'<path d="m3 11 6-5 5 4 4 3M9 6l5-3M2 17q2-3 5 0t5 0 5 0 5 0M2 21q2-3 5 0t5 0 5 0 5 0"/><circle cx="18" cy="8" r="2"/>',
 strength:'<path d="M7 12h10M3 8v8m4-10v12M17 6v12m4-10v8M3 10H1v4h2m18-4h2v4h-2"/>',
 walk:'<circle cx="13" cy="4" r="2"/><path d="m8 10 4-3 3 5 4 2M12 7l-1 8-4 7M11 15l5 7M8 10l-2 5"/>',
 hike:'<path d="m2 21 7-15 5 10 3-6 5 11H2m4-8 3 2 3-2"/>',
 mobility:'<circle cx="12" cy="4" r="2"/><path d="M3 9h18M12 7v7m0 0-6 8m6-8 6 8"/>',
 race:'<path d="M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
 activity:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 external:'<path d="M14 3h7v7m0-7L10 14M10 5H4v15h15v-6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 refresh:'<path d="M20 7V2m0 5h-5M4 17v5m0-5h5M20 7a8 8 0 0 0-14-2M4 17a8 8 0 0 0 14 2"/>',
 dot:'<circle cx="12" cy="12" r="1"/>'
};
export function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]||paths.activity}</svg>`;}
export function sportIcon(type){return icon(({Run:'run',Bike:'bike',Swim:'swim',Strength:'strength',Walk:'walk',Hike:'hike',Mobility:'mobility',Race:'race'})[type]||'activity');}
