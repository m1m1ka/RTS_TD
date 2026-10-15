import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { attackModules } from "../src/attack-modules.js";
const url="http://127.0.0.1:5184";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5184","--strictPort"],{stdio:"ignore",windowsHide:true});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  const chrome=process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser=await chromium.launch({...(chrome?{executablePath:chrome}:{}),headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
  const game=await context.newPage(),editor=await context.newPage(),errors=[];
  for(const p of [game,editor])p.on("pageerror",e=>errors.push(e.message));
  await game.goto(url);await game.waitForFunction(()=>window.__game?.snapshot().frames>3);
  await editor.goto(url+"/config.html");
  const selector='[data-path="cards.hero_blue.unit.attackModule"]';
  assert.equal(await editor.locator(selector+' option').count(),7);
  assert.equal(await editor.locator('[data-path="cards.hero_blue.unit.type"]').count(),0);
  assert.equal(await editor.locator('[data-path="cards.hero_blue.unit.weapon"]').count(),0);
  await game.locator('[data-card="hero_blue"]').click();await game.evaluate(()=>window.__game.clickCell(7,3));
  for(const [id,spec] of Object.entries(attackModules)) {
    await editor.bringToFront();await editor.locator(selector).selectOption(id);await editor.locator('#save-config').click();
    await game.waitForFunction(({id,weapon})=>{
      const s=window.__game.snapshot(),h=s.heroes[0],rig=s.weapons.find(w=>w.id===h.id);
      return h.attackModule===id && h.weapon===weapon && (weapon?rig?.weapon===weapon:!rig);
    },{id,weapon:spec.weapon});
    assert.equal(await game.evaluate(()=>window.__game.snapshot().heroes[0].useIcon),"blue");
  }
  await editor.locator('[data-icon-select="cards.hero_blue.useIcon"]').selectOption("cavalier");
  await editor.locator('#save-config').click();
  await game.waitForFunction(()=>window.__game.snapshot().heroes[0].useIcon==="cavalier");
  assert.equal(await game.evaluate(()=>window.__game.snapshot().heroes[0].attackModule),"coffeeCannon");
  await editor.reload();assert.equal(await editor.locator(selector).inputValue(),"coffeeCannon");
  await editor.locator('[data-section="enemies"]').click();
  assert.equal(await editor.locator('[data-path="enemies.grunt.attackModule"] option').count(),7);
  await editor.locator('[data-path="enemies.grunt.attackModule"]').selectOption("musket");
  await editor.locator('#save-config').click();
  await game.bringToFront();await game.locator('#start').click();await game.evaluate(()=>window.__game.advance(3.5));
  await game.waitForFunction(()=>window.__game.snapshot().enemies.some(e=>e.enemyId==="grunt"&&e.attackModule==="musket"&&e.weapon==="musket"));
  await editor.bringToFront();await editor.locator('[data-section="cards"]').click();
  await editor.locator('[data-category="resource"]').click();
  await editor.locator('[data-select="tower"]').click();
  assert.equal(await editor.locator('[data-path="cards.tower.unit.attackModule"] option').count(),7);
  await editor.locator('[data-category="hero"]').click();await editor.locator('[data-select="hero_blue"]').click();
  mkdirSync("logs",{recursive:true});await editor.locator(selector).scrollIntoViewIfNeeded();
  await editor.screenshot({path:"logs/attack-modules-config.png"});
  assert.deepEqual(errors,[]);
  console.log("PASS attack modules browser: 7 choices for heroes/enemies/towers, live switching of every rig, unchanged icons, persistence and enemy spawning");
} finally {await browser?.close();server.kill();}
