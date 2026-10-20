import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
const url="http://127.0.0.1:5209", config=structuredClone(DEFAULT_CONFIG);
config.days[0].kind="shop";config.days[0].waves=[];
config.initial.cards={hero_blue:2,fireball:2,coin_purse:2};
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5209","--strictPort"],
  {stdio:"ignore",windowsHide:true,env:{...process.env,FRIDAY_CONFIG_SYNC:"0"}});
let browser;
try{
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
  context.setDefaultTimeout(15000);
  await context.addInitScript(c=>{if(!localStorage.getItem("friday-defense-config-v1"))localStorage.setItem("friday-defense-config-v1",JSON.stringify(c));},config);
  const editor=await context.newPage();editor.on("pageerror",e=>errors.push(e.message));
  await editor.goto(url+"/config.html");await editor.locator('[data-section="initial"]').click();
  for(const [key,value] of Object.entries({commonHeroSellPrice:7,rareHeroSellPrice:8,epicHeroSellPrice:9,battleSellPrice:5,resourceSellPrice:3,equipmentSellPrice:4}))
    await editor.locator(`[data-path="initial.economy.${key}"]`).fill(String(value));
  await editor.locator("#save-config").click();
  assert.ok(!(await editor.locator("#config-message").getAttribute("class")).includes("error"));
  const shop=await context.newPage();shop.on("pageerror",e=>errors.push(e.message));await shop.goto(url);
  await shop.locator('[data-shop-sell="hero_blue"]').waitFor();
  let before=await shop.evaluate(()=>window.__game.snapshot());
  await shop.locator('[data-shop-sell="hero_blue"]').click();
  let after=await shop.evaluate(()=>window.__game.snapshot());
  assert.equal(after.gold,before.gold+7);assert.equal(after.cards.hero_blue,1);
  before=after;const skillId=await shop.locator('[data-shop-sell="fireball"]').first().getAttribute("data-instance");
  await shop.locator('[data-shop-sell="fireball"]').first().click();
  after=await shop.evaluate(()=>window.__game.snapshot());
  assert.equal(after.gold,before.gold+5);assert.equal(after.cards.fireball,1);assert.ok(!after.skillCards.some(c=>c.id===skillId));
  mkdirSync("logs",{recursive:true});await shop.locator(".shop-sales").screenshot({path:"logs/card-selling.png"});
  const battle=structuredClone(DEFAULT_CONFIG);
  battle.initial.cards={hero_blue:1,hero_green:1};battle.initial.firstWaveDelay=0;
  battle.days[0].obstacles=[];battle.days[0].mines=[];
  battle.days[0].waves=[{id:"selection",name:"选择测试",startDelay:0,hpScale:1,atkScale:1,spawns:[{x:0,y:5,delay:2,interval:1,enemies:[{type:"grunt",count:1,level:1}]}]}];
  for(const key of ["hero_blue","hero_green"]){battle.cards[key].effects=[];battle.cards[key].triggerRules=[];battle.cards[key].unit.atk=0;}
  battle.cards.hero_blue.unit.maxHp=1;battle.enemies.grunt.atk=10000;battle.enemies.grunt.maxHp=10000;
  const context2=await browser.newContext({viewport:{width:1440,height:1000}});
  context2.setDefaultTimeout(15000);
  await context2.addInitScript(c=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(c)),battle);
  const page=await context2.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto(url);
  await page.waitForFunction(()=>window.__game?.snapshot().frames>3);
  assert.equal(await page.locator(".hand-tray").evaluate(e=>getComputedStyle(e).backgroundImage),"none");
  await page.locator('[data-card="hero_blue"]').click();await page.evaluate(()=>window.__game.clickCell(7,5));
  assert.equal((await page.evaluate(()=>window.__game.snapshot())).selectedCard,null);
  assert.equal((await page.evaluate(()=>window.__game.snapshot())).cards.hero_blue,1);
  const card=await page.locator('[data-card="hero_blue"]').boundingBox(),core=await page.evaluate(()=>window.__game.cellToScreen(7,5));
  await page.mouse.move(card.x+card.width/2,card.y+card.height/2);await page.mouse.down();
  await page.mouse.move(core.x,core.y,{steps:8});await page.mouse.up();
  assert.equal((await page.evaluate(()=>window.__game.snapshot())).selectedCard,null);
  for(const [key,x,y] of [["hero_blue",0,5],["hero_green",10,8]]){
    await page.locator(`[data-card="${key}"]`).click();await page.evaluate(([x,y])=>window.__game.clickCell(x,y),[x,y]);
  }
  // Select the vulnerable hero before the incoming attack.
  await page.keyboard.press("Digit1");
  assert.equal((await page.evaluate(()=>window.__game.snapshot())).selected,0);
  await page.locator("#start").click();await page.evaluate(()=>window.__game.advance(6));
  let state=await page.evaluate(()=>window.__game.snapshot());assert.ok(state.heroes[0].hp<=0);
  await page.evaluate(()=>window.__game.clickCell(10,8));
  state=await page.evaluate(()=>window.__game.snapshot());assert.equal(state.selected,1);
  assert.equal(state.inspectedUnitId,state.heroes[1].id);
  assert.deepEqual(errors,[]);
  console.log("PASS card interactions browser: sale prices/configuration/inventory, transparent tray, failed click/drag cancellation and selection after hero death");
}finally{await browser?.close();server.kill();}
