import {chromium} from 'playwright';
import {unzipSync,strFromU8} from 'fflate';
import {readFile} from 'node:fs/promises';
import {localDate} from '../lib/fitness.mjs';
const endpoint='https://mobesktajbsicjamgetc.supabase.co/functions/v1/fitness-api';
const token=process.env.FITNESS_RUNNER_KEY;
export async function report(body){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-fitness-runner-key':token||''},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new Error('Fitness endpoint rejected request');return r.json();
}
if(process.argv.includes('--report-failure')){if(token)await report({action:'hosted_report',status:'error'});process.exit(0);}
if(!token||!process.env.TP_USERNAME||!process.env.TP_PASSWORD){console.error('Hosted connection is not configured. Add the three repository secrets.');process.exit(1);}
let browser,stage='login';
try{
 await report({action:'hosted_report',status:'started'});
 browser=await chromium.launch();const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(45000);
 await page.goto('https://app.trainingpeaks.com/',{waitUntil:'domcontentloaded'});
 await page.getByRole('textbox',{name:/username|email/i}).fill(process.env.TP_USERNAME);
 await page.locator('input[type="password"]').fill(process.env.TP_PASSWORD);
 await page.getByRole('button',{name:/^log in$|^login$|^sign in$/i}).click();
 await page.getByText('Walker Wells',{exact:true}).first().waitFor({timeout:60000});
 stage='export';await page.getByText('Walker Wells',{exact:true}).first().click();await page.getByText('Settings',{exact:true}).first().click();
 await page.getByRole('heading',{name:'Account Settings',exact:true}).waitFor();await page.locator('span').filter({hasText:/^Export Data$/}).click();
 const panel=page.locator('.workoutExport').filter({has:page.getByRole('heading',{name:'Workout Summary',exact:true})});
 const shift=n=>{const d=new Date(localDate()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return `${d.getUTCMonth()+1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;};
 await panel.locator('input[name="startDate"]').fill(shift(-21));await panel.locator('input[name="endDate"]').fill(shift(14));await panel.getByRole('heading',{name:'Workout Summary'}).click();await panel.getByRole('button',{name:'Export',exact:true}).click();
 const link=page.getByRole('link',{name:/^WorkoutExport-.*\.zip$/});await link.waitFor({timeout:60000});
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:60000}),link.click()]);const path=await download.path();if(!path)throw new Error('Export download failed');
 const files=unzipSync(new Uint8Array(await readFile(path))),csvFiles=Object.keys(files).filter(n=>n.toLowerCase().endsWith('.csv'));if(csvFiles.length!==1)throw new Error('Export format changed');
 stage='import';const result=await report({action:'hosted_import',csv:strFromU8(files[csvFiles[0]])});
 // No credentials, workout payloads, browser traces, screenshots, or downloaded exports in CI logs/artifacts.
 console.log(`Hosted check complete: ${result.applied} changes; ${result.review_count} items need review.`);
}catch{
 if(token)try{await report({action:'hosted_report',status:stage==='login'?'needs_login':'error'});}catch{}
 console.error(stage==='login'?'TrainingPeaks sign-in needs attention.':'Hosted sync failed; review the private connection status.');process.exitCode=1;
}finally{await browser?.close();}
