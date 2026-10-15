import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { RESOURCE_CARDS } from "../src/resource-effects.js";
const c = structuredClone(DEFAULT_CONFIG), keys = Object.keys(RESOURCE_CARDS);
c.days = c.days.slice(0,1); c.days[0].waves = [c.days[0].waves[0]];
c.days[0].waves[0].spawns = [{x:7,y:0,delay:0,interval:1,enemies:[{type:"grunt",count:1,level:1}]}];
c.initial.firstWaveDelay = 0; c.enemies.grunt.maxHp = 1;
c.cards.hero_green.unit.range = 24;
Object.assign(c.initial.cards, Object.fromEntries(keys.map(k => [k,2])));
const server = spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5180","--strictPort"],{stdio:"ignore",windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" }});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:5180")).ok)break;}catch{} await new Promise(r=>setTimeout(r,200));}
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context = await browser.newContext({viewport:{width:1440,height:950}});
  const page = await context.newPage(), editor = await context.newPage(), errors=[];
  for(const p of [page,editor]) p.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(config=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(config)),c);
  await page.goto("http://127.0.0.1:5180");
  await page.waitForFunction(()=>window.__game?.snapshot().frames>5);
  await editor.goto("http://127.0.0.1:5180/config.html");
  await editor.locator('[data-section="pools"]').click();
  await editor.locator('[data-action="add-pool"]').click();
  await editor.locator('[data-path="rewardPools.pool_1.name"]').fill("奇遇资源池");
  while(await editor.locator('[data-action="remove-inventory"]').count()) await editor.locator('[data-action="remove-inventory"]').first().click();
  for(const key of keys){
    await editor.locator('[data-inventory-choice="rewardPools.pool_1.cards"]').selectOption(key);
    await editor.locator('[data-action="add-inventory"]').click();
  }
  await editor.locator('[data-path="rewardPools.pool_1.cards.coin_purse"]').fill("4");
  await editor.locator('[data-section="waves"]').click();
  await editor.locator('[data-path="days.0.rewardPool"]').selectOption("pool_1");
  await editor.locator("#save-config").click();
  await editor.waitForFunction(()=>JSON.parse(localStorage.getItem("friday-defense-config-v1")).days[0].rewardPool==="pool_1");
  mkdirSync("logs",{recursive:true});
  await editor.locator('[data-section="pools"]').click();
  await editor.locator('[data-select="pool_1"]').click();
  await editor.screenshot({path:"logs/reward-pool-config.png"});
  await editor.locator('[data-section="cards"]').click();
  await editor.locator('[data-category="resource"]').click();
  for(const key of keys){
    await editor.locator(`[data-select="${key}"]`).click();
    await editor.waitForFunction(()=>[...document.querySelectorAll('.icon-editor img')].every(i=>i.complete&&i.naturalWidth>0));
  }
  assert.equal(await editor.locator('[data-path="cards.siphon.effects.0.limit"]').inputValue(),"3");
  await editor.screenshot({path:"logs/resource-effects-config.png"});
  await page.bringToFront();
  const state=()=>page.evaluate(()=>window.__game.snapshot());
  const use=async(key,x,y)=>{await page.locator(`[data-card="${key}"]`).click();await page.evaluate(({x,y})=>window.__game.clickCell(x,y),{x,y});};
  await use("hero_blue",7,3); await use("hero_green",6,3); await use("hero_purple",9,3);
  await use("coin_purse",1,1); assert.equal((await state()).gold,3);
  await use("war_drum",7,3); assert.equal((await state()).heroes[0].level,2); assert.equal((await state()).phase,"ready");
  await use("legacy",7,3); assert.equal((await state()).heroes.length,2);
  await page.waitForTimeout(100); assert.equal((await state()).healthBars.length,2);
  await page.locator("#start").click();
  await page.evaluate(()=>window.__game.advance(12));
  assert.equal((await state()).phase,"reward");
  assert.equal(await page.locator('[data-reward]').count(),5);
  assert.deepEqual(new Set((await state()).rewardOptions),new Set(keys),"editor pool binding is live");
  await page.waitForTimeout(1100);
  await page.screenshot({path:"logs/rewards-five-cards.png"});
  const confirm=page.locator('[data-reward-confirm]'); assert.ok(await confirm.isDisabled());
  await page.locator('[data-reward="0"]').click(); await page.locator('[data-reward="1"]').click();
  assert.equal(await page.locator('.reward-card.picked').count(),2); assert.ok(await confirm.isEnabled());
  await page.locator('[data-reward="2"]').click(); assert.equal(await page.locator('.reward-card.picked').count(),2);
  await page.locator('[data-reward="0"]').click(); assert.ok(await confirm.isDisabled());
  await page.locator('[data-reward="2"]').click();
  await page.screenshot({path:"logs/rewards-selection.png"});
  await page.keyboard.press("Escape"); assert.ok(await page.locator('#reward-dialog').isVisible());
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"logs/rewards-mobile.png"});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const before=await state();
  await confirm.click();
  await page.waitForFunction(()=>window.__game.snapshot().phase==="won");
  const after=await state();
  assert.equal(Object.values(after.cards).reduce((a,b)=>a+b,0),Object.values(before.cards).reduce((a,b)=>a+b,0)+2);
  for(const index of [1,2]){const key=before.rewardOptions[index];assert.equal(after.cards[key],(before.cards[key]||0)+1);}
  assert.equal(await page.locator('#reward-dialog').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log("PASS reward browser: editable pools, live per-day binding, resource art/use/removal, five cards, toggle/max-two, desktop/mobile layout, animated claim and exact inventory");
} finally {await browser?.close();server.kill();}
