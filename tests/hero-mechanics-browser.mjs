import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
const c=structuredClone(DEFAULT_CONFIG),url="http://127.0.0.1:5191";
for(const card of Object.values(c.cards))if(card.category==="hero")card.triggerRules=[];
c.initial.cards={hero_blue:1,hero_green:1};c.initial.firstWaveDelay=0;
Object.assign(c.cards.hero_blue.unit,{maxHp:2000,atk:100,range:4,rate:2,attackModule:"bow",weapon:"bow",critChance:0});
Object.assign(c.cards.hero_green.unit,{maxHp:1,atk:0,range:1});
Object.assign(c.enemies.grunt,{maxHp:180,atk:20,range:1,rate:1,speed:.2,critChance:0});
c.days[0].mines=[];
c.days[0].waves=[{id:"mechanics",name:"机制",startDelay:0,hpScale:1,atkScale:1,spawns:[{x:11,y:5,delay:0,interval:1,enemies:[{type:"grunt",count:1,level:1}]}]}];
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5191","--strictPort"],{stdio:"ignore",windowsHide:true,env:{...process.env,FRIDAY_CONFIG_SYNC:"0"}});
let browser;
try{
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
  const editor=await context.newPage(),errors=[];editor.on("pageerror",e=>errors.push(e.message));
  await editor.goto(url+"/config.html");await editor.evaluate(c=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(c)),c);await editor.reload();
  assert.equal(await editor.locator('[data-mechanic]:checked').count(),0,"mechanics default to off");
  const game=await context.newPage();game.on("pageerror",e=>errors.push(e.message));await game.goto(url);await game.waitForFunction(()=>window.__game?.snapshot().frames>3);
  await editor.bringToFront();
  for(const key of ["immobile","dormant","deathsAsSacrifice","knockback","arrowReduction"])await editor.locator(`[data-mechanic="${key}"]`).check();
  await editor.locator('[data-path="cards.hero_blue.unit.mechanics.knockback.distance"]').fill("2");
  await editor.locator('[data-path="cards.hero_blue.unit.mechanics.arrowReduction.mode"]').selectOption("fixed");
  await editor.locator('[data-path="cards.hero_blue.unit.mechanics.arrowReduction.value"]').fill("5");
  await editor.locator('[data-trigger-template="victoryGold"]').click();
  assert.equal(await editor.locator('[data-path="cards.hero_blue.triggerRules.0.trigger.event"]').inputValue(),"victory");
  assert.equal(await editor.locator('[data-path="cards.hero_blue.triggerRules.0.effects.0.value"]').count(),1,"no duplicate amount control");
  await editor.locator('[data-path="cards.hero_blue.triggerRules.0.effects.0.value"]').fill("7");
  await editor.locator('#save-config').click();
  await editor.waitForFunction(()=>JSON.parse(localStorage.getItem("friday-defense-config-v1")).cards.hero_blue.triggerRules[0]?.effects[0].value===7);
  await editor.reload();assert.equal(await editor.locator('[data-mechanic]:checked').count(),5);
  mkdirSync("logs",{recursive:true});await editor.locator('.entity-form').screenshot({path:"logs/hero-mechanics-config.png"});
  await game.bringToFront();
  for(const[key,x,y]of[["hero_blue",9,4],["hero_green",10,5]]){
    await game.locator(`[data-card="${key}"]`).focus();await game.keyboard.press("Enter");await game.evaluate(([x,y])=>window.__game.clickCell(x,y),[x,y]);
  }
  await game.evaluate(()=>window.__game.clickCell(9,4));
  assert.match(await game.locator('#unit-side').innerText(),/沉睡/);
  assert.deepEqual(await game.evaluate(()=>window.__game.snapshot().movableCells),[]);
  await game.evaluate(()=>window.__game.clickCell(8,4));
  assert.deepEqual(await game.evaluate(()=>window.__game.snapshot().heroes[0].path),[]);
  await game.locator('#start').click();
  await game.waitForFunction(()=>window.__game.snapshot().enemies.some(e=>e.hp>0&&e.x>11));
  let s=await game.evaluate(()=>window.__game.snapshot());
  assert.ok(s.heroes[0].awakenedDayId);assert.equal(s.heroes[0].x,9);assert.equal(s.heroes[0].y,4);
  await game.waitForFunction(()=>window.__game.snapshot().phase==="victory");
  await game.locator('#pause').click();
  s=await game.evaluate(()=>window.__game.snapshot());assert.equal(s.settlement.total,11);assert.equal(s.gold,0);
  await game.evaluate(()=>window.__game.advance(4.4));
  await game.screenshot({path:"logs/hero-bonus-gold.png"});
  await game.evaluate(()=>window.__game.advance(3));
  assert.equal(await game.evaluate(()=>window.__game.snapshot().gold),11);
  // Exercise the saved conversion flag in a real battle with a plain victim.
  const converted = await editor.evaluate(()=>JSON.parse(localStorage.getItem("friday-defense-config-v1")));
  delete converted.cards.hero_blue.unit.mechanics.dormant;
  // Do not let knockback move the enemy away during its initial attack cooldown.
  delete converted.cards.hero_blue.unit.mechanics.knockback;
  converted.cards.hero_blue.unit.rate=1;
  converted.enemies.grunt.attackModule="slash";converted.enemies.grunt.weapon="";
  converted.cards.hero_blue.triggerRules=[{...newTriggerRule(),trigger:{event:"heroSacrifice",scope:"others",radius:-1},effects:[{type:"level",value:1}]}];
  const ctx2=await browser.newContext({viewport:{width:1440,height:1000}});ctx2.setDefaultTimeout(15000);
  await ctx2.addInitScript(config=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(config)),converted);
  const battlefield=await ctx2.newPage();battlefield.on("pageerror",e=>errors.push(e.message));
  await battlefield.goto(url);await battlefield.waitForFunction(()=>window.__game?.snapshot().frames>3);
  for(const[key,x,y]of[["hero_blue",9,4],["hero_green",10,5]]){
    await battlefield.locator(`[data-card="${key}"]`).focus();await battlefield.keyboard.press("Enter");await battlefield.evaluate(([x,y])=>window.__game.clickCell(x,y),[x,y]);
  }
  await battlefield.locator('#start').click();
  await battlefield.waitForFunction(()=>window.__game.snapshot().heroes[0].level===2);
  assert.equal(await battlefield.evaluate(()=>window.__game.snapshot().heroes[0].mechanics.deathsAsSacrifice),true);
  await battlefield.waitForFunction(()=>window.__game.snapshot().phase==="victory");
  assert.equal(await battlefield.evaluate(()=>window.__game.snapshot().heroes[0].level),2,"plain ally death activates the listener exactly once");
  await ctx2.close();
  assert.deepEqual(errors,[]);
  console.log("PASS mechanics browser: optional editor controls, persistence/live sync, immobility HUD, awakening, knockback, animated bonus gold and plain hero death converted to one sacrifice activation");
}finally{await browser?.close();server.kill();}
