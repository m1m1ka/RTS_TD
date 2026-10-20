import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
const config=structuredClone(DEFAULT_CONFIG),url="http://127.0.0.1:5211";
config.initial.cards={hero_blue:1,coffee:2,arcane:1};
config.days[0].obstacles=[];config.days[0].mines=[];
config.cards.hero_blue.effects=[{type:"level",value:1}];
config.cards.hero_blue.unit.levelGrowth.maxHp=200;
config.cards.hero_blue.unit.attackModule="bow";config.cards.hero_blue.unit.weapon="bow";
config.cards.hero_blue.triggerRules=[{...newTriggerRule(),trigger:{event:"preparation",scope:"any",radius:-1},effects:[{type:"summonFollower",count:8,hpPercent:50,atkPercent:50}]}];
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5211","--strictPort"],{stdio:"ignore",windowsHide:true,env:{...process.env,FRIDAY_CONFIG_SYNC:"0"}});
let browser;
try{
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
  context.setDefaultTimeout(15000);
  await context.addInitScript(c=>{if(!localStorage.getItem("friday-defense-config-v1"))localStorage.setItem("friday-defense-config-v1",JSON.stringify(c));},config);
  const editor=await context.newPage();editor.on("pageerror",e=>errors.push(e.message));await editor.goto(url+"/config.html");

  await editor.locator('[data-path="cards.hero_blue.rankDescriptions.0"]').fill("测试零阶描述");
  await editor.locator("#save-config").click();
  assert.ok(!(await editor.locator("#config-message").getAttribute("class")).includes("error"));
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto(url);
  await page.waitForFunction(()=>window.__game?.snapshot().frames>3);
  assert.equal(await page.locator('[data-card="hero_blue"] .card-kind').textContent(),"战士");
  assert.equal(await page.locator('[data-card="hero_blue"] .hero-card-level').textContent(),"Lv.1");
  await page.locator('[data-card="hero_blue"]').click();await page.evaluate(()=>window.__game.clickCell(7,3));
  await page.evaluate(()=>window.__game.clickCell(7,3));
  await page.waitForFunction(()=>document.getElementById("unit-description").textContent==="0阶：测试零阶描述");
  assert.equal(await page.locator("#unit-inspector").getAttribute("data-rarity"),config.cards.hero_blue.rarity);
  const colors=await page.locator("#unit-inspector").evaluate(el=>["common","rare","epic"].map(r=>{el.dataset.rarity=r;return getComputedStyle(el).backgroundColor}));
  assert.equal(await page.locator('[data-card="hero_blue"] .card-kind').count(),0);
  assert.equal(await page.locator("#unit-inspector #unit-profile").count(),0);
  const boxes=await page.evaluate(()=>["unit-inspector","unit-profile"].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right}}));
  assert.ok(boxes[1].left>boxes[0].right);
  const fonts=await page.locator("#unit-profile").evaluate(el=>[...el.children].map(e=>getComputedStyle(e).fontSize));
  assert.equal(new Set(fonts).size,1);
  assert.equal(new Set(colors).size,3);assert.deepEqual(errors,[]);
  console.log("PASS profile browser: editable descriptions saved and shown, three rarity backgrounds");
}finally{await browser?.close();server.kill();}
