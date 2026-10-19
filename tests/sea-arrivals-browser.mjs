import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { piratePresets } from "../src/marine-content.js";

const c=structuredClone(DEFAULT_CONFIG);
Object.assign(c.enemies,structuredClone(piratePresets));
c.initial.firstWaveDelay=0;c.initial.boatSpeed=.5;
c.days=[c.days[0]];c.days[0].next=[];c.days[0].obstacles=[];c.days[0].mines=[];
c.days[0].waves=[{id:"sea",name:"四面来袭",hpScale:1,atkScale:1,startDelay:0,spawns:[[0,5],[14,5],[7,0],[7,10]].map(([x,y])=>({x,y,delay:0,interval:.5,enemies:[{type:"pirate_soldier",count:4,level:1},{type:"pirate_shield",count:2,level:1},{type:"pirate_captain",count:1,level:1}]}))}];
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5198","--strictPort"],{stdio:"ignore",windowsHide:true,env:{...process.env,FRIDAY_CONFIG_SYNC:"0"}});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:5198")).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(config=>{if(!localStorage.getItem("friday-defense-config-v1"))localStorage.setItem("friday-defense-config-v1",JSON.stringify(config));},c);
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:5198");await page.waitForFunction(()=>window.__game?.snapshot().frames>5);
  await page.locator('[data-card="hero_blue"]').click();await page.evaluate(()=>window.__game.clickCell(6,5));
  await page.locator("#start").click();await page.waitForFunction(()=>window.__game.snapshot().boats.length===4);
  await page.locator("#pause").click();await page.keyboard.press("Home");
  const snap=()=>page.evaluate(()=>window.__game.snapshot());
  let before=await snap();await page.waitForTimeout(180);assert.deepEqual((await snap()).boats,before.boats,"pause freezes voyages");
  await page.evaluate(()=>{const b=window.__game.snapshot().boats[0];window.__game.advance((b.remaining-.6)/.5);});
  await page.waitForFunction(()=>window.__game.snapshot().boatVisualCount===4);
  const aboard=await snap();assert.equal(aboard.enemies.length,28);assert.equal(aboard.boats[0].layers,2);
  assert.ok(aboard.boatVisuals.every(v=>v.width===1&&v.height===4),"each hull is one cell wide and four cells long");
  for(const boat of aboard.boats) {
    const crew=aboard.enemies.filter(e=>e.boatId===boat.id);
    assert.equal(new Set(crew.map(e=>e.seaX)).size,boat.dx?4:1);
    assert.equal(new Set(crew.map(e=>`${e.x},${e.y}`)).size,4);
    for(let i=4;i<7;i++)assert.ok(Math.abs(crew[i-4].seaY-crew[i].seaY-.48)<1e-8,"overflow crew stand on shoulders at their station");
    assert.ok(crew.every(e=>Math.abs(aboard.unitVisuals.find(v=>v.id===e.id).displaySize-.84)<1e-8));
  }
  assert.ok(aboard.enemies.every(e=>e.boatId&&Number.isInteger(e.x)&&Number.isInteger(e.y)));
  mkdirSync("logs",{recursive:true});await page.waitForTimeout(2200);
  await page.locator("#pause").click();await page.screenshot({path:"logs/sea-arrivals-four-shores.png"});await page.locator("#pause").click();
  const beforeEdit=await snap();
  const editor=await context.newPage();editor.on("pageerror",e=>errors.push(e.message));
  await editor.goto("http://127.0.0.1:5198/config.html");await editor.locator('[data-section="initial"]').click();
  assert.equal(await editor.locator('[data-path="initial.boatSpeed"]').inputValue(),"0.5");
  assert.equal(await editor.locator('[data-path="initial.landingKnockback"]').inputValue(),"2");
  await editor.locator('[data-path="initial.boatSpeed"]').fill("4");
  await editor.locator('[data-path="initial.landingKnockback"]').fill("3");
  await editor.locator("#save-config").click();
  await editor.waitForFunction(()=>JSON.parse(localStorage.getItem("friday-defense-config-v1")).initial.boatSpeed===4);
  await editor.screenshot({path:"logs/sea-arrivals-settings.png"});
  await page.waitForTimeout(150);assert.deepEqual((await snap()).enemies.map(e=>[e.id,e.x,e.y]),beforeEdit.enemies.map(e=>[e.id,e.x,e.y]),"live save preserves offshore positions");
  await page.evaluate(()=>window.__game.advance(.2));
  assert.equal((await snap()).enemies.filter(e=>!e.boatId).length,4,"new speed applies to all four boats");
  await page.waitForFunction(()=>{const s=window.__game.snapshot();return s.enemies.filter(e=>!e.boatId).every(e=>{const v=s.unitVisuals.find(v=>v.id===e.id);return v&&v.displaySize===v.size;});});
  await page.evaluate(()=>window.__game.advance(1));
  const landed=await snap();
  for(const boat of beforeEdit.boats) {
    const crew=landed.enemies.filter(e=>boat.members.includes(e.id)&&!e.boatId);
    assert.equal(crew.length,3,"three crew disembark at the configured interval");
    const expected=[-1,0,1].map(offset=>`${boat.gate.x+(boat.dy?offset:0)},${boat.gate.y+(boat.dx?offset:0)}`).sort();
    assert.deepEqual(crew.map(e=>`${e.x},${e.y}`).sort(),expected,"each shore spreads arrivals across the three landing cells");
  }
  await page.screenshot({path:"logs/sea-arrivals-three-cell-landing.png"});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:"logs/sea-arrivals-mobile.png"});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator("#pause").click();await page.waitForTimeout(300);
  await page.locator("#restart").click();await page.locator("#confirm-restart").click();await page.waitForFunction(()=>window.__game.snapshot().boatVisualCount===0);
  assert.equal((await snap()).boats.length,0);assert.deepEqual(errors,[]);
  console.log("PASS sea browser: 1x4 hulls, shoulder stacks, three-cell landing on four shores, landing scale, pause, live settings, mobile layout and reset cleanup");
} finally {await browser?.close();server.kill();}
