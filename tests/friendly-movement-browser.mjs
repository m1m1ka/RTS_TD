import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
const url="http://127.0.0.1:5185";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5185","--strictPort"],{stdio:"ignore",windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" }});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  const chrome=process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser=await chromium.launch({...(chrome?{executablePath:chrome}:{}),headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.__game?.snapshot().frames>3);
  assert.equal(await page.locator("#hero-deployment-count").textContent(),"0/5");
  const click=async(x,y)=>{const p=await page.evaluate(([x,y])=>window.__game.cellToScreen(x,y),[x,y]);await page.mouse.click(p.x,p.y);};
  for(const [key,x,y] of [["hero_blue",3,3],["hero_green",4,3]]){await page.locator(`[data-card="${key}"]`).click();await click(x,y);}
  await click(3,3);
  await page.waitForFunction(()=>document.querySelector("#hero-deployment-count").textContent==="2/5");
  const goldBox=await page.locator(".loot").first().boundingBox(), countBox=await page.locator(".hero-counter").boundingBox();
  assert.ok(countBox.x>goldBox.x+goldBox.width);
  await page.waitForFunction(()=>window.__game.snapshot().movableCells.includes("4,3"));
  assert.equal(await page.evaluate(()=>window.__game.snapshot().movementArrowVisible),true);
  mkdirSync("logs",{recursive:true});
  await page.screenshot({path:"logs/movement-selection.png"});
  await click(4,3);
  await page.waitForFunction(()=>!window.__game.snapshot().movementArrowVisible);
  assert.equal(await page.evaluate(()=>window.__game.snapshot().inspectedUnitId),null,"clicking occupied friendly destination orders movement, not a selection switch");
  await page.waitForFunction(()=>{const [a,b]=window.__game.snapshot().heroes;return a.x===4&&a.y===3&&(b.x!==4||b.y!==3);});
  const moved=await page.evaluate(()=>window.__game.snapshot());
  assert.equal(Math.max(Math.abs(moved.heroes[1].x-4),Math.abs(moved.heroes[1].y-3)),1);
  await click(4,3);await click(6,5);
  const route=await page.evaluate(()=>window.__game.snapshot().heroes[0].path);
  assert.ok(route.length<=2);assert.ok(route.every(p=>p.x-p.y===1));
  await page.waitForFunction(()=>{const a=window.__game.snapshot().heroes[0];return a.x===6&&a.y===5;});
  assert.equal(await page.evaluate(()=>window.__game.snapshot().inspectedUnitId),null);
  assert.deepEqual(errors,[]);
  console.log("PASS friendly movement browser: real mouse selection, occupied-tile highlights, one-cell yielding, deselection and direct diagonal route");
} finally {await browser?.close();server.kill();}
