// Conservative, local extraction. Original text stays in the private workout note.
const words={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,fifteen:15,twenty:20};
const unitPattern='(lb(?:s)?|pounds?|kg|kilos?|kilograms?)';
const unit=value=>/^kg|kilo/i.test(value||'')?'kg':value?'lb':'';
const name=value=>value.replace(/^\s*(?:i\s+)?(?:did|then|and|finished with|followed by|also did|also|after that)\s+/i,'').replace(/\s*(?:was|were|for|at|with|using|:)\s*$/i,'').replace(/^\s*(?:then|and)\s+/i,'').trim();
export function parseWorkoutNote(original) {
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
   if(/per hand|each hand|\beach\b/i.test(part))exerciseName+=' (per hand)';
   else if(/total(?: load| weight)?/i.test(part))exerciseName+=' (total load)';
   else {exerciseName+=' (load basis unspecified)';issues.push('Dumbbell weight basis is unclear. Confirm whether it is per hand or total.');}
  }
  exerciseName=exerciseName[0].toUpperCase()+exerciseName.slice(1);
  let exercise=exercises.find(e=>e.name===exerciseName&&e.unit===loadUnit);
  if(!exercise){exercise={name:exerciseName,unit:loadUnit,sets:[]};exercises.push(exercise);}
  exercise.sets.push(...Array.from({length:count},()=>({reps,weight,rpe:null,kind:'working'})));previous=exercise;
  const rest=part.trim().slice(matched.length).trim();if(rest && !/^(?:body\s*weight|bw|each|per hand|each hand|total(?: load| weight)?)[.!]?$/i.test(rest))unparsed.push(rest);
 }
 return {exercises,issues:[...new Set(issues)],unparsed,original};
}
