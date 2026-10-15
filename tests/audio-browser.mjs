import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync, mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { AUDIO_EVENTS } from "../src/audio/schema.js";
import { waveFile } from "./audio-fixture.mjs";
const filename="__audio_test.wav", filepath="public/audio/"+filename;
writeFileSync(filepath,waveFile());
const c=structuredClone(DEFAULT_CONFIG);c.initial.firstWaveDelay=0;c.enemies.grunt.maxHp=1;c.cards.hero_blue.unit.range=24;
c.days[0].waves=[c.days[0].waves[0]];c.days[0].waves[0].spawns=[{x:7,y:0,delay:0,interval:1,enemies:[{type:"grunt",count:1,level:1}]}];
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5182","--strictPort"],{stdio:"ignore",windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" }});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:5182")).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const game=await context.newPage(),page=await context.newPage(),errors=[];
  for(const p of [game,page]){p.setDefaultTimeout(15000);p.on("pageerror",e=>errors.push(e.message));}
  await game.addInitScript(config=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(config)),c);
  await game.goto("http://127.0.0.1:5182");await game.waitForFunction(()=>window.__game?.snapshot().frames>3);
  await page.goto("http://127.0.0.1:5182/audio.html");
  await page.locator(`[data-preview-file="project:${filename}"]`).waitFor();
  assert.equal(await page.locator('[data-event]').count(),13);
  for(const key of Object.keys(AUDIO_EVENTS)) await page.locator(`[data-event-sound="${key}"]`).selectOption("project:"+filename);
  await page.locator('[data-event-volume="enemyHit"]').fill("35");await page.locator('[data-event-cooldown="enemyHit"]').fill("120");
  await page.locator('#master-volume').fill("60");
  await page.locator('[data-preview-event="enemyHit"]').click();await page.waitForFunction(()=>document.querySelector('#stop-preview').textContent.startsWith("■"));
  await page.locator('#stop-preview').click();
  await page.locator('#save-audio').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("friday-defense-audio-v1")));
  assert.equal(saved.events.enemyHit.volume,.35);assert.equal(saved.masterVolume,.6);
  const playback=await page.evaluate(async()=>{
    const {SoundPlayer}=await import("/src/audio/player.js"),{getAudioConfig}=await import("/src/audio/store.js");
    const config=getAudioConfig(), played=[],errors=[],player=new SoundPlayer(config,{enabled:true,onPlayed:e=>played.push(e),onError:e=>errors.push(e)});
    for(const key of Object.keys(config.events))await player.play(key);
    const keys=played.map(e=>e.key);
    player.stop();player.last.clear();played.length=0;
    await player.play("enemyHit");await player.play("enemyHit");const throttled=played.length;
    player.stop();played.length=0;player.setEnabled(false);await player.play("victory");const muted=played.length;
    player.setEnabled(true);config.events.enemyHit.enabled=false;player.setConfig(config);await player.play("enemyHit");const disabled=played.length;
    player.stop();player.context.close();return {keys,errors,throttled,muted,disabled};
  });
  assert.deepEqual(new Set(playback.keys),new Set(Object.keys(AUDIO_EVENTS)));assert.deepEqual(playback.errors,[]);
  assert.equal(playback.throttled,1);assert.equal(playback.muted,0);assert.equal(playback.disabled,0);
  mkdirSync("logs",{recursive:true});await page.screenshot({path:"logs/audio-config-desktop.png"});
  await game.bringToFront();await game.locator('#sound').click();
  const play=async(key,x,y)=>{await game.locator(`[data-card="${key}"]`).click();await game.evaluate(({x,y})=>window.__game.clickCell(x,y),{x,y});};
  await play("hero_blue",7,3);await play("training",7,3);
  await game.waitForFunction(()=>window.__game.snapshot().audio.counts.heroUpgrade>0&&window.__game.snapshot().audio.counts.heroDeploy>0);
  await game.locator('#start').click();
  await game.waitForFunction(()=>window.__game.snapshot().phase==="victory");
  await game.waitForFunction(()=>window.__game.snapshot().audio.counts.victory>0);
  const audio=await game.evaluate(()=>window.__game.snapshot().audio);
  for(const key of ["enemyHit","enemyDeath","swordSwing","swordHit","battleStart","victory"])assert.ok(audio.counts[key]>0,key);
  await game.locator('#sound').click();assert.equal(await game.evaluate(()=>window.__game.snapshot().audio.voices),0);
  // Folder/files import uses persistent browser storage, and exports actual audio bytes.
  await page.bringToFront();
  await page.locator('#audio-files-input').setInputFiles({name:"导入音效.wav",mimeType:"audio/wav",buffer:waveFile(660)});
  await page.waitForFunction(()=>document.querySelector('#audio-count').textContent.includes("2"));
  const localId=await page.locator('[data-event-sound="bowDraw"] option').last().getAttribute('value');
  await page.locator('[data-event-sound="bowDraw"]').selectOption(localId);
  await page.locator('#save-audio').click();
  await page.reload();await page.locator('[data-event-sound="bowDraw"]').waitFor();assert.equal(await page.locator('[data-event-sound="bowDraw"]').inputValue(),localId);
  const download=page.waitForEvent("download");await page.locator('#export-audio-config').click();const exported=await download;
  await exported.saveAs("logs/audio-portable.json");const bundle=JSON.parse(readFileSync("logs/audio-portable.json","utf8"));assert.equal(bundle.assets.length,2);assert.ok(bundle.assets.every(a=>a.data.startsWith("data:")));
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:"logs/audio-config-mobile.png"});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // A new device can play both originally local and project files without the project WAV.
  unlinkSync(filepath);
  const other=await browser.newContext(),fresh=await other.newPage();fresh.on("pageerror",e=>errors.push(e.message));
  await fresh.goto("http://127.0.0.1:5182/audio.html");await fresh.locator('#audio-config-input').setInputFiles("logs/audio-portable.json");
  await fresh.waitForFunction(()=>document.querySelector('#audio-count').textContent.includes("2"));await fresh.locator('#save-audio').click();
  await fresh.locator('[data-preview-event="bowDraw"]').click();await fresh.waitForFunction(()=>document.querySelector('#stop-preview').textContent.startsWith("■"));
  await fresh.locator('#stop-preview').click();await fresh.locator('[data-preview-event="enemyDeath"]').click();await fresh.waitForFunction(()=>document.querySelector('#stop-preview').textContent.startsWith("■"));
  await other.close();assert.deepEqual(errors,[]);
  console.log("PASS audio browser: recursive discovery, 13 bindings, preview/decode, volumes, save/live game playback, mute, persistent imports, portable embedded audio and mobile layout");
} finally {await browser?.close();server.kill();try{unlinkSync(filepath);}catch{}}
