import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

const config=structuredClone(DEFAULT_CONFIG);
for(const card of Object.values(config.cards))if(card.category==="hero")card.triggerRules=[];
config.days[0].obstacles=[];config.days[0].mines=[];
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5200","--strictPort"],{stdio:"ignore",windowsHide:true,env:{...process.env,FRIDAY_CONFIG_SYNC:"0"}});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:5200")).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--enable-unsafe-swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(c=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(c)),config);
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  page.on("console",e=>{if(e.type()==="error")errors.push(e.text());});
  await page.goto("http://127.0.0.1:5200");await page.waitForFunction(()=>window.__game?.snapshot().frames>3);
  await page.addStyleTag({content:"#map-hint { visibility: hidden !important; }"});
  await page.locator("#pause").click();
  const snap=()=>page.evaluate(()=>window.__game.snapshot());
  const advance=t=>page.evaluate(t=>window.__game.advance(t),t);
  const use=async(key,x,y)=>{await page.locator("#pause").click();await page.locator(`[data-card="${key}"]`).first().click();await page.evaluate(({x,y})=>{window.__game.clickCell(x,y);document.querySelector("#pause").click();},{x,y});};
  mkdirSync("logs",{recursive:true});
  const center=await page.evaluate(()=>window.__game.cellToScreen(4,4));
  await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,-300);await page.mouse.wheel(0,-300);
  await use("hero_blue",4,4);await advance(.15);
  let s=await snap();assert.equal(s.combat.style,"square");assert.equal(s.combat.counts.deployments,1);assert.ok(s.combat.activeKinds.includes("deployDust"));
  await page.screenshot({path:"logs/vfx-deployment.png"});
  const age=s.combat.effectAges;await page.waitForTimeout(150);assert.deepEqual((await snap()).combat.effectAges,age,"pause freezes particles");
  await advance(1);const steps=(await snap()).combat.counts.footsteps;
  await page.evaluate(()=>{document.querySelector("#pause").click();window.__game.clickCell(4,4);window.__game.clickCell(4,3);document.querySelector("#pause").click();});await advance(.05);
  assert.ok((await snap()).combat.counts.footsteps>steps,"actual movement emits dust");
  await advance(1);const idleSteps=(await snap()).combat.counts.footsteps;await advance(1);assert.equal((await snap()).combat.counts.footsteps,idleSteps,"idle heroes emit no dust");
  await use("training",4,3);await advance(.22);
  assert.ok((await snap()).combat.activeKinds.includes("upgrade"));
  await page.screenshot({path:"logs/vfx-upgrade.png"});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:"logs/vfx-upgrade-mobile.png"});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const lifecycle=await page.evaluate(async()=>{
    const THREE=await import("/node_modules/three/build/three.module.js");
    const {CombatVFX}=await import("/src/combat-vfx.js");
    const scene=new THREE.Scene(),unit={id:1,x:0,y:0,side:"hero",hp:100},target={id:2,x:2,y:0,side:"enemy",hp:100};
    const v=new CombatVFX(scene,u=>new THREE.Vector3(u.x,u.y,1));
    const nearest=Object.entries(v.textures).filter(([k])=>!["slash","sword","claw"].includes(k)).every(([,t])=>t.magFilter===THREE.NearestFilter&&t.minFilter===THREE.NearestFilter);
    const restoredSlash=v.textures.slash.image.width===192&&v.textures.slash.magFilter===THREE.LinearFilter;
    const restoredClaw=v.textures.claw.image.width===192&&v.textures.claw.magFilter===THREE.LinearFilter;
    v.upgrade(unit);v.update(.2);const fx=v.effects[0],count=scene.children.length;
    unit.x=1;v.update(.1);const follows=fx.mesh.position.x===1;
    v.upgrade(unit);const merged=v.effects.length===1&&scene.children.length===count&&fx.age===0;
    v.update(1);const expired=scene.children.length===0;
    v.healTarget(unit);v.healTarget(unit);const healMerged=v.effects.length===1&&scene.children.length===4;v.update(1);
    for(const kind of ["arrow","bullet","orb","coffee","slash","claw"]){v.attack({id:kind,kind,source:unit,target,duration:.3});v.update(.1);v.land({id:kind,kind,target});}
    for(const card of ["fireball","frost","lightning"])v.castCard(card,7,5,2);
    v.hit(unit,target);v.hit(target,unit);v.death(target,unit);v.shield(unit);v.dust(unit);v.dust(unit,true);v.burst(unit,"#ffffff");
    const whiteDust=v.effects.filter(f=>["stepDust","deployDust"].includes(f.kind)).every(f=>f.mesh.material.color.getHex()===0xffffff);
    v.update(2);const onlyStain=scene.children.length===1;
    const stain=[...v.stains.values()][0],uniforms=stain.mesh.material.uniforms;
    const procedural=stain.mesh.material.isShaderMaterial&&!stain.mesh.material.map;
    const seed=uniforms.seed.value,age=uniforms.age.value;
    const spreadStops=age===.35;v.update(20);const noFurtherUpdates=uniforms.age.value===age;
    v.update(0);const pause=uniforms.age.value===age;
    v.stampBlood(target,unit);const persistent=v.stains.size===1&&uniforms.seed.value===seed&&uniforms.age.value===age&&stain.deaths===2&&stain.pending.length===1;
    v.stampBlood({x:7,y:-1,boatId:100},unit);const noSeaStain=v.stains.size===1;
    for(let i=0;i<40;i++)v.dust(unit);v.reset();const reset=scene.children.length===0&&v.effects.length===0;
    Object.values(v.textures).forEach(t=>t.dispose());v.geometry.dispose();
    return {nearest,restoredSlash,restoredClaw,whiteDust,procedural,spreadStops,noFurtherUpdates,pause,persistent,noSeaStain,follows,merged,expired,healMerged,onlyStain,reset};
  });
  for(const [key,value] of Object.entries(lifecycle))assert.ok(value,key);
  const preview=await page.evaluate(async()=>{
    const THREE=await import("/node_modules/three/build/three.module.js");
    const {CombatVFX}=await import("/src/combat-vfx.js");
    const {mapArt}=await import("/src/art.js");
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.5,3.5,1.8,-1.8,.1,30);
    camera.position.z=10;
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1120,576);renderer.outputColorSpace=THREE.SRGBColorSpace;
    const map=new THREE.CanvasTexture(mapArt());map.colorSpace=THREE.SRGBColorSpace;
    const geometry=new THREE.PlaneGeometry(15,11),material=new THREE.MeshBasicMaterial({map});scene.add(new THREE.Mesh(geometry,material));
    const v=new CombatVFX(scene,u=>new THREE.Vector3(u.x-7,5-u.y,1),renderer);
    v.stampBlood({x:5,y:5},{x:4,y:6});v.stampBlood({x:7,y:5},{x:7,y:6});v.stampBlood({x:9,y:5},{x:10,y:6});
    const seeds=[...v.stains.values()].map(s=>s.mesh.material.uniforms.seed.value);
    v.update(.5);renderer.render(scene,camera);
    const gl=renderer.getContext(),pixels=new Uint8Array(1120*576*4);gl.readPixels(0,0,1120,576,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>150&&pixels[i+1]<100&&pixels[i+2]<110)red++;
    const frozen=[...v.stains.values()].every(s=>s.frozen&&s.age===.35&&s.mesh.material.isMeshBasicMaterial);
    let released=0;for(const s of v.stains.values())s.target.addEventListener('dispose',()=>released++);
    const blood=renderer.domElement.toDataURL();
    // A settled first stain must not change as subsequent deaths animate elsewhere.
    v.reset();v.stampBlood({x:5,y:5},{x:4,y:6});v.update(.5);
    const captureFirst=()=>{
      renderer.render(scene,camera);
      const region=new Uint8Array(240*240*4);
      gl.readPixels(120,168,240,240,gl.RGBA,gl.UNSIGNED_BYTE,region);
      return region;
    };
    const first=captureFirst();let changedPixels=0;
    for(let frame=0;frame<90;frame++){
      if(frame===10)v.stampBlood({x:9,y:5},{x:10,y:5});
      if(frame===35)v.bloodSpray({x:8,y:5,side:"enemy"},{x:9,y:5},true);
      v.update(frame%3===0?0:.025);
      const next=captureFirst();
      for(let i=0;i<first.length;i++)if(next[i]!==first[i])changedPixels++;
    }
    const firstStain=v.stains.get('5,5'),savedMap=firstStain.mesh.material.map;
    v.stampBlood({x:5,y:5},{x:4,y:5});
    const restampStable=firstStain.age===.35&&firstStain.mesh.material.map===savedMap&&firstStain.pending.length===1;
    v.reset();v.attack({id:1,kind:"slash",source:{x:6.5,y:5},target:{x:7.5,y:5},duration:.3});v.update(.13);renderer.render(scene,camera);
    const slash=renderer.domElement.toDataURL();
    v.reset();Object.values(v.textures).forEach(t=>t.dispose());v.geometry.dispose();geometry.dispose();material.dispose();map.dispose();renderer.dispose();
    return {blood,slash,red,frozen,released,restampStable,changedPixels,uniqueSeeds:new Set(seeds).size};
  });
  assert.ok(preview.red>1000,"shader paints visible bright red pigment on the terrain");assert.equal(preview.uniqueSeeds,3);
  assert.equal(preview.changedPixels,0,"the first settled ground stain stays identical across consecutive frames and later deaths");
  assert.ok(preview.frozen&&preview.restampStable);assert.equal(preview.released,3,"reset disposes generated ground textures");
  writeFileSync("logs/vfx-ground-blood.png",Buffer.from(preview.blood.split(",")[1],"base64"));
  writeFileSync("logs/vfx-restored-slash.png",Buffer.from(preview.slash.split(",")[1],"base64"));
  const accumulation=await page.evaluate(async()=>{
    const THREE=await import("/node_modules/three/build/three.module.js");
    const {CombatVFX}=await import("/src/combat-vfx.js");
    const {mapArt}=await import("/src/art.js");
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.5,3.5,1.2,-1.2,.1,30);
    camera.position.z=10;
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1120,384);renderer.outputColorSpace=THREE.SRGBColorSpace;
    const map=new THREE.CanvasTexture(mapArt());map.colorSpace=THREE.SRGBColorSpace;
    const geometry=new THREE.PlaneGeometry(15,11),material=new THREE.MeshBasicMaterial({map});scene.add(new THREE.Mesh(geometry,material));
    const v=new CombatVFX(scene,u=>new THREE.Vector3(u.x-7,5-u.y,1),renderer);
    const originalRandom=Math.random;let seed=1337;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const read=stain=>{const data=new Uint8Array(192*192*4);renderer.readRenderTargetPixels(stain.target,0,0,192,192,data);return data;};
    const coverage=data=>{let area=0,ink=0;for(let i=3;i<data.length;i+=4){if(data[i]>25)area++;ink+=data[i];}return {area,ink};};
    const stages=[];let oldTexturesReleased=0,retainedPixels=true;
    try {
      // Side-by-side: one, three and eight deaths; batch deaths before first bake.
      for(const [x,count] of [[5,1],[7,3],[9,8]]) {
        for(let i=0;i<count;i++)v.stampBlood({x,y:5},{x:x-1,y:6});
        v.update(.5);
      }
      renderer.render(scene,camera);const comparison=renderer.domElement.toDataURL();
      const batched=[...v.stains.values()].every(s=>s.frozen&&!s.pending.length);
      v.reset();
      for(let count=1;count<=24;count++) {
        const previous=v.stains.get('7,5'),before=previous&&read(previous);
        previous?.target.addEventListener('dispose',()=>oldTexturesReleased++);
        v.stampBlood({x:7,y:5},{x:6,y:6});
        const stain=v.stains.get('7,5');
        v.update(0);
        if(previous)retainedPixels&&=read(stain).every((value,i)=>value===before[i]);
        v.update(.5);
        const after=read(stain);
        if(before)for(let i=3;i<before.length;i+=4)if(after[i]+1<before[i])retainedPixels=false;
        if([1,3,8,24].includes(count))stages.push({deaths:count,...coverage(after)});
      }
      const stain=v.stains.get('7,5'),stable=read(stain);
      let noFlicker=true;
      for(let i=0;i<90;i++){v.update(.025);renderer.render(scene,camera);noFlicker&&=read(stain).every((value,j)=>value===stable[j]);}
      const compact=scene.children.length===2&&v.stains.size===1&&stain.deaths===24&&stain.pending.length===0;
      let finalTextureReleased=0,pendingReleased=0;
      stain.target.addEventListener('dispose',()=>finalTextureReleased++);
      v.stampBlood({x:7,y:5},{x:8,y:5});
      stain.pending[0].mesh.material.addEventListener('dispose',()=>pendingReleased++);
      v.reset();
      return {comparison,stages,batched,retainedPixels,noFlicker,compact,oldTexturesReleased,finalTextureReleased,pendingReleased,clean:scene.children.length===1};
    } finally {
      Math.random=originalRandom;v.reset();Object.values(v.textures).forEach(t=>t.dispose());v.geometry.dispose();geometry.dispose();material.dispose();map.dispose();renderer.dispose();
    }
  });
  for(const key of ['batched','retainedPixels','noFlicker','compact','clean'])assert.ok(accumulation[key],key);
  for(let i=1;i<accumulation.stages.length;i++){
    assert.ok(accumulation.stages[i].area>accumulation.stages[i-1].area,"more deaths increase painted coverage");
    assert.ok(accumulation.stages[i].ink>accumulation.stages[i-1].ink,"more deaths deposit more pigment");
  }
  assert.ok(accumulation.stages[2].area>accumulation.stages[0].area*1.5,"eight deaths visibly expand the first stain");
  assert.equal(accumulation.oldTexturesReleased,23);assert.equal(accumulation.finalTextureReleased,1);assert.equal(accumulation.pendingReleased,1);
  writeFileSync("logs/vfx-blood-accumulation.png",Buffer.from(accumulation.comparison.split(',')[1],'base64'));
  console.log("Blood coverage by deaths:",accumulation.stages);
  // Exercise the production renderer as well as the isolated offscreen scene.
  const battleConfig=structuredClone(config);
  battleConfig.initial.firstWaveDelay=0;battleConfig.initial.boatSpeed=20;
  Object.assign(battleConfig.cards.hero_blue.unit,{atk:5000,range:1,rate:4});
  Object.assign(battleConfig.enemies.grunt,{maxHp:1,atk:0,speed:.5});
  battleConfig.days[0].waves=[{id:"first-death",name:"Blood stability",startDelay:0,hpScale:1,atkScale:1,spawns:[
    {x:0,y:5,delay:0,interval:1,enemies:[{type:"grunt",count:1,level:1}]},
    {x:14,y:5,delay:60,interval:1,enemies:[{type:"grunt",count:1,level:1}]},
  ]}];
  const battleContext=await browser.newContext({viewport:{width:1440,height:1000}});
  await battleContext.addInitScript(c=>localStorage.setItem("friday-defense-config-v1",JSON.stringify(c)),battleConfig);
  const battle=await battleContext.newPage();battle.on("pageerror",e=>errors.push(e.message));
  battle.on("console",e=>{if(e.type()==="error")errors.push(e.text());});
  await battle.goto("http://127.0.0.1:5200");await battle.waitForFunction(()=>window.__game?.snapshot().frames>3);
  await battle.locator('[data-card="hero_blue"]').click();await battle.evaluate(()=>window.__game.clickCell(1,5));
  await battle.locator('#start').click();
  await battle.waitForFunction(()=>window.__game.snapshot().combat.settledBloodStains===1);
  await battle.waitForTimeout(1200);
  const firstDeath=await battle.evaluate(()=>window.__game.snapshot());
  assert.equal(firstDeath.kills,1);assert.equal(firstDeath.phase,"battle");
  assert.ok(!firstDeath.combat.activeKinds.some(k=>k.startsWith('blood')),"the first death spray expires while its ground stain remains");
  await battle.screenshot({path:"logs/vfx-first-death-settled.png"});
  await battle.locator('#restart').click();await battle.locator('#confirm-restart').click();
  await battle.waitForFunction(()=>window.__game.snapshot().combat.bloodStains===0);
  await battleContext.close();
  assert.deepEqual(errors,[]);
  console.log("PASS VFX: restored slash, white dust, rendered procedural red ground stains, cumulative same-cell coverage and pigment, stable baking and texture cleanup, persistence/pause, upgrade, healing, attacks, mobile and cleanup");
} finally {await browser?.close();server.kill();}
