// Specific movement aliases, rather than guessing from a lone "press" or "curl".
export const EXERCISE_CATALOGUE = [
 ['Squat',['quads','glutes'],['squat','squats','bulgarian split squat']],
 ['Lunge',['quads','glutes'],['lunge','lunges']],
 ['Step-up',['quads','glutes'],['step up','step ups']],
 ['Leg press',['quads','glutes'],['leg press']],
 ['Leg extension',['quads'],['leg extension','leg extensions']],
 ['Romanian deadlift',['hamstrings','glutes','back'],['romanian deadlift','rdl','deadlift','deadlifts','good morning','good mornings']],
 ['Leg curl',['hamstrings'],['leg curl','leg curls','hamstring curl','hamstring curls','nordic curl','nordic curls']],
 ['Hip thrust',['glutes'],['hip thrust','hip thrusts','glute bridge','glute bridges','glute kickback','glute kickbacks']],
 ['Calf raise',['calves'],['calf raise','calf raises','calves raise']],
 ['Bench press',['chest','triceps','shoulders'],['bench press','chest press','incline press','decline press','floor press']],
 ['Push-up',['chest','triceps','shoulders'],['push up','push ups','pushup','pushups']],
 ['Chest fly',['chest'],['chest fly','chest flies','chest flyes','pec fly','pec deck','cable fly','cable flies','cable flyes','dumbbell fly','dumbbell flies','dumbbell flyes','cable crossover','cable crossovers']],
 ['Shoulder press',['shoulders','triceps'],['shoulder press','overhead press','military press','arnold press','ohp','push press','landmine press']],
 ['Lateral raise',['shoulders'],['lateral raise','lateral raises','side raise','side raises']],
 ['Front raise',['shoulders'],['front raise','front raises']],
 ['Reverse fly',['back','shoulders'],['reverse fly','reverse flies','reverse flyes','rear delt fly','rear delt flies','rear delt flyes','rear delt raise','rear delt raises','face pull','face pulls']],
 ['Pull-up',['back','biceps'],['pull up','pull ups','pullup','pullups','chin up','chin ups','chinup','chinups']],
 ['Lat pulldown',['back','biceps'],['lat pulldown','lat pull down','pulldown','pull down']],
 ['Row',['back','biceps'],['row','rows']],
 ['Shrug',['back'],['shrug','shrugs']],
 ['Biceps curl',['biceps'],['bicep curl','biceps curl','bicep curls','biceps curls','hammer curl','hammer curls','preacher curl','preacher curls','concentration curl','concentration curls','incline curl','incline curls','reverse curl','reverse curls','ez bar curl','ez bar curls','dumbbell curl','dumbbell curls','barbell curl','barbell curls']],
 ['Triceps extension',['triceps'],['tricep extension','triceps extension','tricep extensions','triceps extensions','tricep kickback','triceps kickback','tricep kickbacks','triceps kickbacks','skull crusher','skull crushers','skullcrusher','skullcrushers']],
 ['Triceps pushdown',['triceps'],['pushdown','pushdowns','push down','push downs']],
 ['Dip',['triceps'],['dip','dips']],
 ['Plank',['core'],['plank','planks','side plank']],
 ['Crunch',['core'],['crunch','crunches','sit up','sit ups','situp','situps']],
 ['Ab rollout',['core'],['ab wheel','ab rollout','ab rollouts']],
 ['Dead bug',['core'],['dead bug','dead bugs','bird dog','bird dogs']],
 ['Pallof press',['core'],['pallof press']],
 ['Leg raise',['core'],['leg raise','leg raises','knee raise','knee raises']],
 ['Core rotation',['core'],['core rotation','russian twist','russian twists','wood chop','wood chops','woodchop','woodchops']],
].map(([name,muscles,aliases])=>({name,muscles,aliases}));

export function normalizeExerciseName(value='') {
 return String(value).normalize('NFKC').toLowerCase()
  .replace(/\((?:per hand|total load|load basis unspecified|reps per side|seconds per side)\)/g,' ')
  .replace(/\bdb\b/g,'dumbbell').replace(/\bbb\b/g,'barbell').replace(/\bkb\b/g,'kettlebell')
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
export function findExercise(value='') {
 const normalized=normalizeExerciseName(value);
 // Removing equipment allows "incline dumbbell chest press" to match "chest press".
 const movement=normalized.replace(/\b(?:dumbbells?|barbells?|kettlebells?|smith machine|machine)\b/g,' ').trim().replace(/\s+/g,' ');
 let best=null,length=0;
 for(const entry of EXERCISE_CATALOGUE)for(const alias of entry.aliases){
  const key=normalizeExerciseName(alias);
  if(key.length>length && [normalized,movement].some(n=>(' '+n+' ').includes(' '+key+' '))){best=entry;length=key.length;}
 }
 return best;
}
