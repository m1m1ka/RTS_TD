import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { defaultAudioConfig } from "../src/audio/schema.js";
import { waveFile } from "./audio-fixture.mjs";
const url = "http://127.0.0.1:5187", directory = path.resolve("logs/project-config-test");
await fs.mkdir(directory, { recursive: true });
const fixture = structuredClone(DEFAULT_CONFIG); fixture.cards.hero_blue.name = "仓库英雄";
await fs.writeFile(path.join(directory,"game.json"), JSON.stringify(fixture));
await fs.writeFile(path.join(directory,"audio.json"), JSON.stringify(defaultAudioConfig()));
const original = await fs.readFile("public/config/game.json", "utf8");
const server = spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5187","--strictPort"],{stdio:"ignore",windowsHide:true,env:{...process.env,FRIDAY_CONFIG_DIR:directory,FRIDAY_CONFIG_SYNC:"1"}});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context = await browser.newContext({viewport:{width:1440,height:1000}}); context.setDefaultTimeout(15000);
  const editor = await context.newPage(), game = await context.newPage(), errors=[];
  for(const page of [editor,game])page.on("pageerror",e=>errors.push(e.message));
  await game.goto(url);await game.waitForFunction(()=>window.__game?.snapshot().frames>3);
  await game.locator('[data-card="hero_blue"]').click();await game.evaluate(()=>window.__game.clickCell(4,4));
  await editor.goto(url+"/config.html");await editor.locator('[data-select="hero_blue"]').click();
  const name=editor.locator('[data-path="cards.hero_blue.name"]');assert.equal(await name.inputValue(),"仓库英雄");
  const initial=await (await fetch(url+"/__project-config/game")).json();
  await name.fill("已同步英雄");await editor.locator("#save-config").click();
  await editor.waitForFunction(()=>document.querySelector('#save-state').textContent.includes('已保存'));
  const saved=JSON.parse(await fs.readFile(path.join(directory,"game.json"),"utf8"));assert.equal(saved.cards.hero_blue.name,"已同步英雄");
  await game.waitForFunction(()=>window.__game.snapshot().heroes[0]?.name==="已同步英雄");
  assert.equal(await game.evaluate(()=>window.__game.snapshot().heroes.length),1,"saving must not reload/reset the game");
  // A different device with stale browser settings must receive the repository version.
  const other=await browser.newContext();other.setDefaultTimeout(15000);
  await other.addInitScript(c=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(c)),DEFAULT_CONFIG);
  const fresh=await other.newPage();await fresh.goto(url+"/config.html");
  assert.equal(await fresh.locator('[data-path="cards.hero_blue.name"]').inputValue(),"已同步英雄");
  assert.ok(await fresh.evaluate(()=>localStorage.getItem("friday-defense-config-v1-local-backup")));
  const put=(value,revision,origin=url)=>fetch(url+"/__project-config/game",{method:"PUT",headers:{"Content-Type":"application/json",Origin:origin,"If-Match":revision},body:JSON.stringify(value)});
  assert.equal((await put(DEFAULT_CONFIG,initial.revision)).status,409,"stale saves cannot overwrite newer files");
  const latest=await (await fetch(url+"/__project-config/game")).json();
  assert.equal((await put({},latest.revision)).status,400);
  assert.equal((await put(DEFAULT_CONFIG,latest.revision,"https://unrelated.example")).status,403);
  assert.equal(JSON.parse(await fs.readFile(path.join(directory,"game.json"),"utf8")).cards.hero_blue.name,"已同步英雄");
  // Simulate git pull changing the file, then refresh a device with old cached values.
  saved.cards.hero_blue.name="拉取后的英雄";
  await fs.writeFile(path.join(directory,"game.json"),JSON.stringify(saved));
  await fresh.reload();assert.equal(await fresh.locator('[data-path="cards.hero_blue.name"]').inputValue(),"拉取后的英雄");
  // Imported audio must survive in a new IndexedDB, not just the original browser.
  const bytes=waveFile();
  await editor.evaluate(async ({data})=>{
    const store=await import('/src/audio/store.js');
    const file=new File([Uint8Array.from(data)],'test.wav',{type:'audio/wav'});
    const imported=await store.importAudioFiles([file],store.getAudioConfig());
    imported.config.events.heroDeath.sound=imported.config.assets[0].id;
    await store.saveAudioConfig(imported.config);
  },{data:[...bytes]});
  const audio=JSON.parse(await fs.readFile(path.join(directory,'audio.json'),'utf8'));
  assert.ok(audio.assets[0].data.startsWith('data:audio/wav;base64,'));
  const audioPage=await other.newPage();await audioPage.goto(url+'/audio.html');
  const restored=await audioPage.evaluate(async()=>{const s=await import('/src/audio/store.js');const c=s.getAudioConfig();return {sound:c.events.heroDeath.sound,size:(await s.audioBlob(c.assets[0])).size};});
  assert.equal(restored.sound,audio.events.heroDeath.sound);assert.equal(restored.size,bytes.length);
  assert.equal(await fs.readFile('public/config/game.json','utf8'),original,"test servers never write user configuration");
  assert.deepEqual(errors,[]);
  console.log('PASS project sync: disk persistence, live battle, clean/stale devices, pull updates, backups, conflict/invalid/origin protection and audio bytes across browsers');
} finally {await browser?.close();server.kill();}
