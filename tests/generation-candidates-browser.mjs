import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";

const config=structuredClone(DEFAULT_CONFIG),url="http://127.0.0.1:5202";
for(const card of Object.values(config.cards))if(card.category==="hero")card.triggerRules=[];
config.initial.cards={hero_purple:1,coffee:1};
config.cards.resource_1={...structuredClone(config.cards.coffee),name:"现有指定卡牌"};
const effect={type:"generateCard",pool:"category",category:"resource",cards:["deleted_tower","resource_1"],count:3};
config.cards.hero_purple.triggerRules=[{...newTriggerRule(),effects:[effect]}];
for(const effects of [config.cards.fireball.effects,config.cards.fireball.skillTiers[0].effects])
  effects.push({...structuredClone(effect),pool:"selected",cards:["resource_1","coffee"]});
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5202","--strictPort"],
  {stdio:"ignore",windowsHide:true,env:{...process.env,FRIDAY_CONFIG_SYNC:"0"}});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
  context.setDefaultTimeout(15000);
  await context.addInitScript(c=>{if(!localStorage.getItem("friday-defense-config-v1"))localStorage.setItem("friday-defense-config-v1",JSON.stringify(c));},config);
  const editor=await context.newPage();editor.on("pageerror",e=>errors.push(e.message));
  await editor.goto(url+"/config.html");await editor.locator('[data-select="hero_purple"]').click();
  const path="cards.hero_purple.triggerRules.0.effects.0";
  await editor.locator(`[data-path="${path}.pool"]`).selectOption("selected");
  assert.ok(await editor.locator(`[data-generation-path="${path}"][data-generation-card="resource_1"]`).isChecked());
  await editor.locator(`[data-generation-path="${path}"][data-generation-card="coffee"]`).check();
  await editor.locator("#save-config").click();
  await editor.waitForFunction(()=>JSON.parse(localStorage.getItem("friday-defense-config-v1")).cards.hero_purple.triggerRules[0].effects[0].pool==="selected");
  const saved=()=>editor.evaluate(()=>JSON.parse(localStorage.getItem("friday-defense-config-v1")));
  assert.deepEqual((await saved()).cards.hero_purple.triggerRules[0].effects[0].cards,["coffee","resource_1"]);
  assert.doesNotMatch(await editor.locator("#config-message").textContent(),/候选卡牌不存在/);
  // Deleting a candidate updates triggers, ordinary effects and upper skill tiers.
  await editor.locator('[data-category="resource"]').click();await editor.locator('[data-select="resource_1"]').click();
  editor.once("dialog",dialog=>dialog.accept());await editor.locator('[data-action="delete-card"]').click();
  await editor.locator("#save-config").click();
  await editor.waitForFunction(()=>!JSON.parse(localStorage.getItem("friday-defense-config-v1")).cards.resource_1);
  const after=await saved();assert.deepEqual(after.cards.hero_purple.triggerRules[0].effects[0].cards,["coffee"]);
  assert.deepEqual(after.cards.fireball.effects.at(-1).cards,["coffee"]);
  assert.deepEqual(after.cards.fireball.skillTiers[0].effects.at(-1).cards,["coffee"]);
  await editor.reload();await editor.locator('[data-select="hero_purple"]').click();
  assert.ok(await editor.locator(`[data-generation-path="${path}"][data-generation-card="coffee"]`).isChecked());
  // The repaired rule must generate exactly the chosen card in the game.
  const game=await context.newPage();game.on("pageerror",e=>errors.push(e.message));await game.goto(url);
  await game.waitForFunction(()=>window.__game?.snapshot().frames>3);
  await game.locator('[data-card="hero_purple"]').click();await game.evaluate(()=>window.__game.clickCell(6,3));
  await game.locator("#start").click();
  await game.waitForFunction(()=>window.__game.snapshot().cards.coffee===4);
  assert.deepEqual(errors,[]);
  console.log("PASS generation candidates browser: stale hidden IDs, existing/custom selection, save/reload, deletion cleanup across triggers/base/tier effects and actual fixed-card generation");
} finally {await browser?.close();server.kill();}
