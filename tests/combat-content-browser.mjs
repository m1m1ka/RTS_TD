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
  await editor.locator('[data-trigger-template="battleCooldown"]').click();
  await editor.locator('[data-path="cards.hero_blue.triggerRules.1.effects.0.chance"]').fill("100");
  await editor.locator("#save-config").click();assert.ok(!(await editor.locator("#config-message").getAttribute("class")).includes("error"));
  await editor.locator('[data-category="battle"]').click();await editor.locator('[data-select="coffee"]').click();
  assert.equal(await editor.locator('[data-path="cards.coffee.target"]').inputValue(),"hero");
  assert.equal(await editor.locator('[data-path="cards.coffee.cooldown"]').inputValue(),"12");
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto(url);
  await page.waitForFunction(()=>window.__game?.snapshot().frames>3);
  assert.equal(await page.locator('[data-card="coffee"].battle').count(),2);
  await page.locator('[data-card="hero_blue"]').click();await page.evaluate(()=>window.__game.clickCell(7,3));
  let state=await page.evaluate(()=>window.__game.snapshot());
  assert.equal(state.followers.length,8);assert.ok(state.heroes[0].hp<state.heroes[0].maxHp);
  const oldHp=state.heroes[0].hp,copy=state.skillCards.find(c=>c.cardId==="coffee").id;
  await page.locator(`[data-hand-slot="${copy}"]`).click();await page.evaluate(()=>window.__game.clickCell(7,3));
  state=await page.evaluate(()=>window.__game.snapshot());assert.equal(state.heroes[0].hp,Math.min(oldHp+120,state.heroes[0].maxHp));
  assert.equal(state.cards.coffee,2);assert.equal(state.skillCards.find(c=>c.id===copy).remaining,0);
  await page.locator('[data-card="arcane"]').click();await page.evaluate(()=>window.__game.clickCell(7,3));
  await page.waitForFunction(()=>window.__game.snapshot().weapons.some(w=>w.weapon==="bow"));
  const layers=await page.evaluate(async()=>{
    const {WeaponRig}=await import("/src/weapon-rig.js"),THREE=await import("/node_modules/three/build/three.module.js");
    const rig=new WeaponRig("staff",new THREE.Group());
    const zs=[-Math.PI/2,0,Math.PI/2,Math.PI].map(a=>{rig.angle=a;rig.pose();return rig.root.position.z;});
    rig.dispose();return zs;
  });
  assert.deepEqual(layers,[.12,.12,.12,.12]);assert.deepEqual(errors,[]);
  console.log("PASS combat content browser: reset effect editor, healing skill targeting/copies, eight followers and weapons above sprites in all directions");
}finally{await browser?.close();server.kill();}
