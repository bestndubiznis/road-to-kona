export const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function completed(rows) { return rows.filter(r => r.status !== 'planned' && r.status !== 'skipped'); }
export function totals(rows) {
  return completed(rows).reduce((a, r) => ({ sessions: a.sessions + 1, hours: a.hours + number(r.duration_hours), bike: a.bike + number(r.bike_miles), run: a.run + number(r.run_miles), swim: a.swim + number(r.swim_yards), strength: a.strength + (number(r.strength) > 0 || r.type === 'Strength' ? 1 : 0) }), { sessions: 0, hours: 0, bike: 0, run: 0, swim: 0, strength: 0 });
}
export function weekly(rows, end = localDate(), count = 12) {
  const monday = new Date(end + 'T12:00:00Z');
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(monday); d.setUTCDate(d.getUTCDate() - i * 7);
    out.push({ date: d.toISOString().slice(0, 10), endurance: 0, strength: 0, sessions: 0 });
  }
  for (const r of completed(rows)) {
    const d = new Date(r.date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    const w = out.find(w => w.date === d.toISOString().slice(0, 10));
    if (w) { w[r.type === 'Strength' ? 'strength' : 'endurance'] += number(r.duration_hours); w.sessions++; }
  }
  return out;
}
export function setVolume(sets) { return sets.reduce((n, s) => n + number(s.weight) * number(s.reps), 0); }
export function strengthHistory(rows, exercise) {
  return completed(rows).flatMap(r => (r.exercises || []).filter(e => e.name.toLowerCase() === exercise.toLowerCase()).map(e => {
    const sets = (e.sets || []).filter(s => s.kind !== 'warmup');
    // Estimates are only meaningful for loaded working sets with 1–10 reps.
    return { date: r.date, unit: e.unit || 'lb', volume: setVolume(sets), sets: sets.length, best: Math.max(0, ...sets.map(s => number(s.weight))), estimatedMax: Math.max(0, ...sets.filter(s => s.reps >= 1 && s.reps <= 10 && s.weight > 0).map(s => number(s.weight) * (1 + number(s.reps) / 30))) };
  })).sort((a, b) => a.date.localeCompare(b.date));
}
export function publicWorkout(r) {
  // Never spread private rows into a public response: explicitly allow these fields.
  return { id: r.id, date: r.date, type: r.type, title: r.type === 'Race' ? r.title : r.type + ' workout', duration_hours: number(r.duration_hours), bike_miles: number(r.bike_miles), run_miles: number(r.run_miles), swim_yards: number(r.swim_yards), strength: number(r.strength), source: r.source, status: r.status || 'completed' };
}
export function validateWorkout(r) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '') || new Date(r.date + 'T00:00:00Z').toISOString().slice(0, 10) !== r.date) throw new Error('Choose a valid date.');
  if (!['Swim','Bike','Run','Strength','Walk','Hike','Mobility','Race','Other','Brick'].includes(r.type)) throw new Error('Choose a workout type.');
  if (!['completed','planned','skipped'].includes(r.status || 'completed')) throw new Error('Choose a valid status.');
  for (const k of ['duration_hours','bike_miles','run_miles','swim_yards','average_hr','average_power','elevation_feet','tss']) if (!Number.isFinite(Number(r[k] || 0)) || Number(r[k] || 0) < 0) throw new Error('Duration and distances must be zero or greater.');
  if (number(r.duration_hours) > 48) throw new Error('Duration must be 48 hours or less.');
  if (r.rpe !== null && r.rpe !== undefined && r.rpe !== '' && (r.rpe < 1 || r.rpe > 10)) throw new Error('Effort must be between 1 and 10.');
  if ((r.exercises || []).length > 50) throw new Error('Maximum 50 exercises per workout.');
  for (const e of r.exercises || []) {
    if (!e.name?.trim() || !['lb','kg','bodyweight'].includes(e.unit) || !Array.isArray(e.sets) || e.sets.length > 100) throw new Error('Each exercise needs a name, a unit, and valid sets.');
    for (const s of e.sets) if (!Number.isInteger(Number(s.reps)) || s.reps < 1 || s.reps > 1000 || !Number.isFinite(Number(s.weight)) || s.weight < 0 || (s.rpe != null && (s.rpe < 1 || s.rpe > 10))) throw new Error('Sets need positive whole reps, nonnegative weight, and effort from 1 to 10.');
  }
  return r;
}
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i+1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i+1] === '\n') i++; row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  row.push(field); if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() || []).map(h => h.trim());
  return rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])));
}
export function trainingPeaksCsv(text) {
  return parseCsv(text).map((r, i) => {
    if (r.date) return validateWorkout({ ...r, duration_hours: number(r.duration_hours), bike_miles: number(r.bike_miles), run_miles: number(r.run_miles), swim_yards: number(r.swim_yards), strength: number(r.strength), status: r.status || 'completed', source: 'TrainingPeaks CSV' });
    const pick = (...keys) => keys.map(k => r[k]).find(v => v !== undefined && v !== '') || '';
    const rawDate = pick('WorkoutDay','Workout Date','Date');
    let date = rawDate.slice(0, 10);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(rawDate)) { const [m,d,y] = rawDate.split(/[ /]/); date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; }
    let type = pick('WorkoutType','Workout Type','Type');
    type = /strength|weight/i.test(type) ? 'Strength' : /bike|cycle/i.test(type) ? 'Bike' : /run/i.test(type) ? 'Run' : /swim/i.test(type) ? 'Swim' : /walk/i.test(type) ? 'Walk' : 'Other';
    const distance = number(pick('DistanceInMeters','Distance (meters)'));
    // TrainingPeaks TotalTime is hours; TotalTimePlanned is never used as actual time.
    const duration = pick('TotalTime','Total Time');
    const hours = duration.includes(':') ? duration.split(':').reduce((n,v) => n*60+number(v),0)/3600 : number(duration);
    return validateWorkout({ date, type, title: pick('Title','Workout Title') || type + ' workout', duration_hours: hours, bike_miles: type === 'Bike' ? distance/1609.344 : 0, run_miles: type === 'Run' ? distance/1609.344 : 0, swim_yards: type === 'Swim' ? distance/0.9144 : 0, strength: type === 'Strength' ? 1 : 0, summary: pick('Description'), details: pick('PostActivityComments','Post Activity Comments'), source: 'TrainingPeaks CSV', status: 'completed', import_row: i });
  });
}
export function parseCalendar(text) {
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('TrainingPeaks did not return a calendar.');
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); const events = []; let event = null;
  const unescape = s => s.replace(/\\[nN]/g,'\n').replace(/\\([,;\\])/g,'$1');
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') event = {};
    else if (line === 'END:VEVENT' && event) {
      if (event.DTSTART && event.UID && event.STATUS !== 'CANCELLED') {
        const raw = event.DTSTART; let date = raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8);
        if (/^\d{8}T\d{6}Z$/.test(raw)) date = localDate(new Date(date+'T'+raw.slice(9,11)+':'+raw.slice(11,13)+':'+raw.slice(13,15)+'Z'));
        const title = event.SUMMARY || 'Planned workout', description = event.DESCRIPTION || '';
        const type = /strength|lifting|weights|gym/i.test(title+' '+description) ? 'Strength' : /swim/i.test(title) ? 'Swim' : /bike|ride|cycle/i.test(title) ? 'Bike' : /run/i.test(title) ? 'Run' : 'Other';
        events.push({ external_id: 'tp-calendar:'+event.UID, date, type, title, details: description, status: 'planned', strength: type === 'Strength' ? 1 : 0, source: 'TrainingPeaks calendar', duration_hours: 0 });
      }
      event = null;
    } else if (event) { const at = line.indexOf(':'); if (at > 0) event[line.slice(0,at).split(';')[0]] = unescape(line.slice(at+1)); }
  }
  return events;
}
export function fromIntervals(a) {
  const type = /weight|strength/i.test(a.type) ? 'Strength' : /ride|cycling/i.test(a.type) ? 'Bike' : /run/i.test(a.type) ? 'Run' : /swim/i.test(a.type) ? 'Swim' : /walk/i.test(a.type) ? 'Walk' : /hike/i.test(a.type) ? 'Hike' : 'Other';
  return { external_id: 'intervals:'+a.id, date: String(a.start_date_local || a.start_date || '').slice(0,10), type, title: a.name || type+' workout', duration_hours: number(a.moving_time || a.elapsed_time)/3600, bike_miles: type === 'Bike' ? number(a.distance)/1609.344 : 0, run_miles: type === 'Run' ? number(a.distance)/1609.344 : 0, swim_yards: type === 'Swim' ? number(a.distance)/0.9144 : 0, strength: type === 'Strength' ? 1 : 0, average_hr: a.average_heartrate || null, average_power: a.average_watts || null, tss: a.icu_training_load || null, source: 'Intervals.icu', status: 'completed', details: a.description || '' };
}
