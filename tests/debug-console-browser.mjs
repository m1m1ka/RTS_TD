import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
const config=structuredClone(DEFAULT_CONFIG),url="http://127.0.0.1:5210";
config.initial.cards={};
config.days[0].obstacles=[];config.days[0].mines=[];
const keys=Object.keys(config.cards).filter(k=>config.cards[k].category==="hero").slice(0,4);
for(const key of keys){config.initial.cards[key]=1;config.cards[key].effects=[];config.cards[key].triggerRules=[];config.cards[key].rankLevels=[2,3,4];}
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5210","--strictPort"],{stdio:"ignore",windowsHide:true,env:{...process.env,FRIDAY_CONFIG_SYNC:"0"}});
let browser;
try{
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  context.setDefaultTimeout(15000);
  await context.addInitScript(c=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(c)),config);
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"&&/shader|WebGL/i.test(m.text()))errors.push(m.text());});
  await page.goto(url);await page.waitForFunction(()=>window.__game?.snapshot().frames>3);
  for(const [i,key] of keys.entries()){
    await page.locator(`[data-card="${key}"]`).click();await page.evaluate(i=>window.__game.clickCell(4+i*2,6),i);
  }
  await page.keyboard.press("F2");assert.ok(await page.locator("#debug-console").evaluate(e=>e.open));
  let state=await page.evaluate(()=>window.__game.snapshot());
  const time=state.time;await page.waitForTimeout(120);
  assert.equal((await page.evaluate(()=>window.__game.snapshot())).time,time);
  await page.locator("#debug-card").selectOption("fireball");await page.locator("#debug-card-count").fill("3");
  await page.locator("[data-debug-generate]").click();
  state=await page.evaluate(()=>window.__game.snapshot());assert.equal(state.cards.fireball,3);assert.equal(state.skillCards.filter(c=>c.cardId==="fireball").length,3);
  for(let i=1;i<4;i++){
    await page.locator("#debug-hero").selectOption(String(state.heroes[i].id));
    await page.locator("#debug-levels").fill(String(i));await page.locator("[data-debug-level]").click();
  }
  await page.waitForFunction(()=>window.__game.snapshot().rankOutlines.filter(o=>o.visible).length===3);
  state=await page.evaluate(()=>window.__game.snapshot());
  assert.deepEqual(state.heroes.map(h=>h.rank),[0,1,2,3]);
  assert.deepEqual(state.rankOutlines.map(o=>o.visible),[false,true,true,true]);
  await page.locator("#debug-density").fill("20");
  await page.locator("#debug-width").fill("2");
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue("--crt-scan-period")),"5px");
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue("--crt-scan-width")),"2px");
  mkdirSync("logs",{recursive:true});await page.screenshot({path:"logs/debug-console.png"});
  await page.locator("[data-debug-reset-crt]").click();
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue("--crt-scan-period")),"");
  await page.keyboard.press("F2");
  await page.evaluate(()=>window.__game.advance(3));
  await page.waitForTimeout(100);
  await page.screenshot({path:"logs/hero-rank-outlines.png"});
  await page.locator("#debug-toggle").click();await page.locator("[data-debug-close]").click();
  assert.ok(!(await page.locator("#debug-console").evaluate(e=>e.open)));
  assert.deepEqual(errors,[]);
  console.log("PASS debug console: button/F2, pause, generated skill copies, rank 0–3 shaders, CRT live settings/reset and close");
}finally{await browser?.close();server.kill();}
