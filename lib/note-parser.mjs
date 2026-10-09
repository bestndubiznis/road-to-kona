// Conservative, local extraction. Original text stays in the private workout note.
const words={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,fifteen:15,twenty:20};
const unitPattern='(lb(?:s)?|pounds?|kg|kilos?|kilograms?)';
const unit=value=>/^kg|kilo/i.test(value||'')?'kg':value?'lb':'';
const name=value=>value.replace(/^\s*(?:i\s+)?(?:did|then|and|finished with|followed by|also did|also|after that)\s+/i,'').replace(/\s*(?:was|were|for|at|with|using|:)\s*$/i,'').replace(/^\s*(?:then|and)\s+/i,'').trim();
function parseLegacyNote(original) {
 const text=original.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/gi,w=>words[w.toLowerCase()]);
 const explicitUnit=/all (?:the )?weights? (?:are |were )?(?:in )?(pounds?|lbs?|kilograms?|kg)/i.exec(text);
 const defaultUnit=explicitUnit?unit(explicitUnit[1]):'';
 const parts=text.split(/\n|;|,\s*|\.(?=\s|$)|\s+and then\s+|\s+then\s+/i).filter(s=>s.trim());
 const exercises=[],issues=[],unparsed=[];let previous=null,pendingName=null;
 for(const part of parts) {
  let m=null,exerciseName='',count=0,reps=0,weight='',loadUnit='',matched='';
  const patterns=[
   {re:new RegExp('^(.*?)\\b(\\d+)\\s*(?:sets?\\s*(?:of\\s*)?|[x×]\\s*)(\\d+)\\s*(?:reps?\\s*)?(?:at|with|using|@)\\s*(\\d+(?:\\.\\d+)?)\\s*'+unitPattern+'?','i'),kind:'sets_first'},
   {re:new RegExp('^(.*?)\\b(\\d+(?:\\.\\d+)?)\\s*'+unitPattern+'?\\s*(?:for|with|:)\\s*(\\d+)\\s*sets?\\s*(?:of\\s*)?(\\d+)\\s*(?:reps?)?','i'),kind:'load_first'},
   {re:new RegExp('^(.*?)\\b(\\d+)\\s*reps?\\s*(?:at|with|@)\\s*(\\d+(?:\\.\\d+)?)\\s*'+unitPattern+'?\\s*(?:for|across)\\s*(\\d+)\\s*sets?','i'),kind:'reps_first'},
   {re:new RegExp('^(.*?)\\b(\\d+(?:\\.\\d+)?)\\s*'+unitPattern+'\\s*(?:[x×]|for)\\s*(\\d+)\\s*(?:reps?)?','i'),kind:'single'},
   {re:/^(.*?)\b(\d+)\s*(?:sets?\s*(?:of\s*)?|[x×]\s*)(\d+)\s*(?:reps?)?/i,kind:'unloaded'}
  ];
  let kind='';for(const p of patterns){m=p.re.exec(part.trim());if(m){kind=p.kind;break;}}
  if(!m){unparsed.push(part.trim());pendingName=/^[a-z][a-z\s()\-:]{1,60}$/i.test(part.trim())?{name:name(part.trim()),raw:part.trim()}:null;continue;}
  matched=m[0];exerciseName=name(m[1]);
  if(kind==='sets_first'){count=Number(m[2]);reps=Number(m[3]);weight=Number(m[4]);loadUnit=unit(m[5])||defaultUnit;}
  if(kind==='load_first'){weight=Number(m[2]);loadUnit=unit(m[3])||defaultUnit;count=Number(m[4]);reps=Number(m[5]);}
  if(kind==='reps_first'){reps=Number(m[2]);weight=Number(m[3]);loadUnit=unit(m[4])||defaultUnit;count=Number(m[5]);}
  if(kind==='single'){weight=Number(m[2]);loadUnit=unit(m[3]);count=1;reps=Number(m[4]);}
  if(kind==='unloaded'){count=Number(m[2]);reps=Number(m[3]);if(/body\s*weight|\bbw\b/i.test(part)){loadUnit='bodyweight';weight=0;}}
  if(!exerciseName && pendingName){exerciseName=pendingName.name;const index=unparsed.lastIndexOf(pendingName.raw);if(index>=0)unparsed.splice(index,1);pendingName=null;}
  if(!exerciseName && kind==='single' && previous)exerciseName=previous.name;
  if(kind==='unloaded' && /body\s*weight|\bbw\b/i.test(exerciseName+' '+part)){loadUnit='bodyweight';weight=0;}
  if(!exerciseName || /\b(?:ran|run|bike|ride|swam|swim|walk|miles?|minutes?)\b/i.test(exerciseName)){unparsed.push(part.trim());continue;}
  if(count<1||count>30||reps<1||reps>1000){issues.push('Check the set and rep count for '+exerciseName+'.');continue;}
  if(!loadUnit)issues.push(exerciseName+': choose lb, kg, or bodyweight before saving.');
  if(weight==='')issues.push(exerciseName+': load was not specified. Add it, or choose bodyweight.');
  if(/dumbbell|\bdb\b/i.test(exerciseName) && !/\((?:per hand|total load|load basis unspecified)\)/i.test(exerciseName)) {
   if(/\b(?:total(?: load| weight)?|combined(?: load| weight)?)\b/i.test(part))exerciseName+=' (total load)';
   else exerciseName+=' (per hand)';
  }
  exerciseName=exerciseName[0].toUpperCase()+exerciseName.slice(1);
  let exercise=exercises.find(e=>e.name===exerciseName&&e.unit===loadUnit);
  if(!exercise){exercise={name:exerciseName,unit:loadUnit,sets:[]};exercises.push(exercise);}
  exercise.sets.push(...Array.from({length:count},()=>({reps,weight,rpe:null,kind:'working'})));previous=exercise;
  const rest=part.trim().slice(matched.length).trim();if(rest && !/^(?:body\s*weight|bw|each|per hand|each hand|total(?: load| weight)?|combined(?: load| weight)?)[.!]?$/i.test(rest))unparsed.push(rest);
 }
 return {exercises,issues:[...new Set(issues)],unparsed,original};
}

// Extract counts independently of word order; keep ambiguous and timed work in notes.
export function parseWorkoutNote(original) {
 const shorthand=/(?:^|[\n;,]|\.\s)\s*\d+\s*[x×]\s*\d+\b/i.test(original);
 const normalized=original.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/gi,w=>words[w.toLowerCase()]).replace(/\b(\d+)\s*[x×]\s*(\d+)\b/gi,'$1 sets of $2 reps');
 const parts=normalized.split(/\n|;|,\s*|\.(?=\s|$)/).filter(s=>s.trim());
 const result={exercises:[],issues:[],unparsed:[],original};
 for(const raw of parts){
  const part=raw.trim();
  const countMatch=/\b(\d+)\s*sets?\b/i.exec(part);
  if(!countMatch){const r=parseLegacyNote(part);result.exercises.push(...r.exercises);result.issues.push(...r.issues);result.unparsed.push(...r.unparsed);continue;}
  const time=/\b(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?)\b/i.exec(part);
  if(time){
   const seconds=Number(time[1])*(/^min/i.test(time[2])?60:1),count=Number(countMatch[1]);
   const load=new RegExp('\\b(\\d+(?:\\.\\d+)?)\\s*'+unitPattern+'\\b','i').exec(part);
   let label=name(part.replace(countMatch[0],'').replace(time[0],'').replace(load?.[0]||/$.^/,'').replace(/\b(?:of|each side|each leg|at|with)\b/gi,'').replace(/\s+/g,' '));
   if(/each (?:side|leg)/i.test(part))label+=' (seconds per side)';
   const u=load?unit(load[2]):/body\s*weight|\bbw\b/i.test(part)?'bodyweight':'',weight=load?Number(load[1]):u==='bodyweight'?0:'';
   if(!u)result.issues.push(label+': confirm load and unit.');
   if(count>=1&&count<=30&&seconds>0&&seconds<=86400&&label)result.exercises.push({name:label[0].toUpperCase()+label.slice(1),unit:u,sets:Array.from({length:count},()=>({seconds,weight,rpe:null,kind:'working'}))});else result.unparsed.push(part);
   continue;
  }
  const count=Number(countMatch[1]);
  const last=/\b(?:going up to|last set(?: of| was| at)?)\s*(\d+)\s*(?:reps?)?(?:\s+on (?:the )?last set)?/i.exec(part);
  const load=new RegExp('\\b(\\d+(?:\\.\\d+)?)\\s*'+unitPattern+'\\b','i').exec(part);
  let clean=part.replace(/\s+and then\s+going up to.*$/i,'').replace(countMatch[0],' ').replace(/\bof\s+(?=\d)/i,'');
  if(load)clean=clean.replace(load[0],' ');
  const repsMatch=/\b(\d+)\s*(?:reps?\b|each\b)/i.exec(clean)||/\b(\d+)\b/.exec(clean);
  if(!repsMatch){result.unparsed.push(part);result.issues.push('Reps missing: '+part+'. Add the reps before creating sets.');continue;}
  const reps=Number(repsMatch[1]);
  clean=clean.replace(/\b(?:per hand|each hand|total(?: load| weight)?|combined(?: load| weight)?)\b/gi,' ').replace(/^\s*of\s+/i,'').replace(/\s+dumbbells?\s*$/i,'');
  let exerciseName=name(clean.replace(repsMatch[0],' ').replace(/\b(?:each (?:leg|side|sides)|each sides?|at|with|using|reps?)\b/gi,' ').replace(/\s+/g,' '));
  if(!exerciseName||count<1||count>30||reps<1||reps>1000){const r=parseLegacyNote(part);result.exercises.push(...r.exercises);result.issues.push(...r.issues);result.unparsed.push(...r.unparsed);continue;}
  const perSide=/each (?:leg|side|sides)/i.test(part);
  exerciseName=exerciseName.replace(/\b(?:leg|side|sides)\s*$/i,'').trim();
  if(perSide)exerciseName+=' (reps per side)';
  let loadUnit=load?unit(load[2]):/body\s*weight|\bbw\b/i.test(part)?'bodyweight':'',weight=load?Number(load[1]):loadUnit==='bodyweight'?0:'';
  if(/dumbbells?|\bdb\b/i.test(part)){
   if(/\b(?:total(?: load| weight)?|combined(?: load| weight)?)\b/i.test(part))exerciseName+=' (total load)';
   else exerciseName+=' (per hand)';
  }
  if(!loadUnit)result.issues.push(exerciseName+': choose bodyweight, lb, or kg and confirm any missing load.');
  exerciseName=exerciseName[0].toUpperCase()+exerciseName.slice(1);
  const sets=Array.from({length:count},()=>({reps,weight,rpe:null,kind:'working'}));
  if(last){const lastReps=Number(last[1]);if(lastReps>=1&&lastReps<=1000)sets[count-1].reps=lastReps;else result.issues.push(exerciseName+': check last-set reps.');}
  result.exercises.push({name:exerciseName,unit:loadUnit,sets});
 }
 // Preserve legacy continuation handling for short conventional notes.
 if(!shorthand && !/each (?:leg|side)|seconds?|secs?|minutes?|mins?|last set|sets? of [a-z]|\d+\s+each\b/i.test(normalized))return parseLegacyNote(original);
 result.issues=[...new Set(result.issues)];return result;
}
