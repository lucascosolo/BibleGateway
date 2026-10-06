import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:3988';
const out='/srv/scratch/jot-discovery-20260915/final-shots';
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try {
for(const theme of ['light','dark']) for(const width of [390,1280]) {
 const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
 await ctx.addInitScript(t=>localStorage.setItem('jot-preferences',JSON.stringify({version:3,state:{theme:t,tourSeen:true,plainLabels:true}})),theme);
 const page=await ctx.newPage();
 for(const [name,path] of [['home','/'],['verse','/read/John.4.11?t=WEB']]) {
  await page.goto(base+path,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`${out}/${name}-${width}-${theme}.png`});
  if(name==='verse') {
   await page.locator('button.reader__listen').click();
   await page.waitForTimeout(700);
   await page.screenshot({path:`${out}/player-${width}-${theme}.png`});
   await page.getByRole('button',{name:'Close the player',exact:true}).click();
   await page.getByText('Bible cross-reference links for John 4:11',{exact:true}).click();
   await page.getByRole('link',{name:'Support Jot on Patreon',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/footer-${width}-${theme}.png`});
  }
  console.log(JSON.stringify({name,width,theme,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)}));
 }
 await ctx.close();
}
} finally {await browser.close();}
