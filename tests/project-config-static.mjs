import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
const bundled=JSON.parse(await readFile("dist/config/game.json","utf8"));
assert.deepEqual(bundled,JSON.parse(await readFile("public/config/game.json","utf8")));
const url="http://127.0.0.1:5188";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","5188","--strictPort"],{stdio:"ignore",windowsHide:true});
let browser;
try{
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
  const context=await browser.newContext();context.setDefaultTimeout(15000);const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/config.html');
  await page.waitForFunction(()=>document.querySelector('[data-select="hero_blue"]'));
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('friday-defense-config-v1')));
  assert.deepEqual(await stored(),assertConfig(bundled),'new browser loads shipped config');
  await page.locator('[data-select="hero_blue"]').click();
  await page.locator('[data-path="cards.hero_blue.name"]').fill('Static local edit');
  await page.locator('#save-config').click();
  await page.waitForFunction(()=>document.querySelector('#save-state').textContent.includes('已保存'));
  await page.reload();assert.equal(await page.locator('[data-path="cards.hero_blue.name"]').inputValue(),'Static local edit');
  const updated=structuredClone(bundled);updated.cards.hero_blue.name='Pulled revision';
  await page.route('**/config/game.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(updated)}));
  await page.reload();assert.equal(await page.locator('[data-path="cards.hero_blue.name"]').inputValue(),'Pulled revision');
  const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('friday-defense-config-v1-local-backup')));
  assert.equal(backup.cards.hero_blue.name,'Static local edit');
  const old=await browser.newContext();await old.addInitScript(c=>localStorage.setItem('friday-defense-config-v1',JSON.stringify(c)),DEFAULT_CONFIG);
  const oldPage=await old.newPage();await oldPage.goto(url+'/config.html');
  await oldPage.waitForFunction(()=>document.querySelector('[data-select="hero_blue"]'));
  assert.deepEqual(await oldPage.evaluate(()=>JSON.parse(localStorage.getItem('friday-defense-config-v1'))),assertConfig(bundled));
  assert.deepEqual(errors,[]);
  console.log('PASS static config: shipped user settings, fresh browsers, stale caches, local edits retained until repository changes, and backup before applying updates');
}finally{await browser?.close();server.kill();}
