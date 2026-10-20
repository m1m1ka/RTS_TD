import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
const config = structuredClone(DEFAULT_CONFIG), url = "http://127.0.0.1:5208";
config.initial.firstWaveDelay = 0; config.initial.cards = {hero_blue:1};
config.days[0].obstacles = []; config.days[0].mines = [];
config.days[0].waves[0].spawns = [[0,5], [14,5], [3,0], [10,10]].map(([x,y]) => ({
  x, y, delay: 30, interval: 1, enemies: [{type:"grunt",count:2,level:1}, {type:"tank",count:1,level:1}],
}));
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5208", "--strictPort"],
  { stdio: "ignore", windowsHide: true, env: {...process.env,FRIDAY_CONFIG_SYNC:"0"} });
let browser;
try {
  for (let i=0;i<60;i++) { try {if((await fetch(url)).ok)break;}catch{} await new Promise(r=>setTimeout(r,200)); }
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless:true,args:["--enable-unsafe-swiftshader"]});
  const context = await browser.newContext({viewport:{width:1440,height:1000}}), errors=[];
  context.setDefaultTimeout(15000);
  await context.addInitScript(c=>{if(!localStorage.getItem("friday-defense-config-v1"))localStorage.setItem("friday-defense-config-v1",JSON.stringify(c));},config);
  const editor=await context.newPage();editor.on("pageerror",e=>errors.push(e.message));
  await editor.goto(url+"/config.html");await editor.locator('[data-section="enemies"]').click();
  await editor.locator('[data-select="grunt"]').click();
  const text="普通海盗士兵，近距离攻击目标。<b>原样显示</b>";
  await editor.locator('[data-path="enemies.grunt.description"]').fill(text);
  await editor.locator("#save-config").click();
  assert.ok(!(await editor.locator("#config-message").getAttribute("class")).includes("error"));
  await editor.reload();await editor.locator('[data-section="enemies"]').click();await editor.locator('[data-select="grunt"]').click();
  assert.equal(await editor.locator('[data-path="enemies.grunt.description"]').inputValue(),text);
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.__game?.snapshot().frames>3);
  assert.equal(await page.locator(".enemy-preview-group").count(),4);
  assert.equal(await page.locator("[data-enemy-preview]").count(),8);
  const button=page.locator('[data-landing="0,5"] [data-enemy-preview="grunt"]'), tip=page.locator("#enemy-preview-tip");
  await button.hover();await tip.waitFor({state:"visible"});
  assert.match(await tip.locator("strong").textContent(),/× 2/);
  assert.equal(await tip.locator("p").textContent(),text);assert.equal(await tip.locator("p b").count(),0);
  mkdirSync("logs",{recursive:true});await page.screenshot({path:"logs/enemy-preview.png"});
  await page.mouse.move(700,500);await tip.waitFor({state:"hidden"});
  await button.focus();await tip.waitFor({state:"visible"});await page.keyboard.press("Escape");await tip.waitFor({state:"hidden"});
  await page.locator('[data-card="hero_blue"]').click();await page.evaluate(()=>window.__game.clickCell(0,5));
  assert.ok(await page.evaluate(()=>window.__game.snapshot().heroes.some(h=>h.x===0&&h.y===5)));
  await page.locator("#start").click();assert.equal(await page.locator(".enemy-preview-group").count(),4);
  await page.evaluate(()=>window.__game.advance(31));
  await page.waitForFunction(()=>document.querySelectorAll(".enemy-preview-group").length===0);
  assert.deepEqual(errors,[]);
  console.log("PASS enemy preview browser: description persistence, four shores, icons/counts, safe tooltip, keyboard and launch cleanup");
}finally{await browser?.close();server.kill();}
