import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import { AUDIO_EVENTS, defaultAudioConfig, assertAudioConfig, audioEventsFor } from "../src/audio/schema.js";
import { scanAudioDirectory, audioCatalogPlugin } from "../scripts/audio-catalog.js";
import { waveFile } from "./audio-fixture.mjs";
assert.equal(Object.keys(AUDIO_EVENTS).length,13);
const hero={side:"hero",level:1}, enemy={side:"enemy",level:1};
for(const [event,key] of [
  [{type:"hit",unit:enemy},"enemyHit"],[{type:"death",unit:enemy},"enemyDeath"],
  [{type:"hit",unit:hero},"heroHit"],[{type:"death",unit:hero},"heroDeath"],
  [{type:"attack",kind:"arrow"},"bowDraw"],[{type:"impact",kind:"arrow"},"arrowHit"],
  [{type:"attack",kind:"slash"},"swordSwing"],[{type:"impact",kind:"slash"},"swordHit"],
  [{type:"impact",kind:"orb"},"magicHit"],[{type:"upgrade",unit:hero},"heroUpgrade"],
  [{type:"deploy",unit:hero},"heroDeploy"],[{type:"victory"},"victory"],[{type:"day"},"battleStart"],
])assert.deepEqual(audioEventsFor(event),[key]);
for(const event of [{type:"impact",kind:"arrow",missed:true},{type:"hit",unit:{type:"mine",side:"neutral"}},{type:"death",unit:{side:"hero",level:0}},{type:"heroBattleStart",unit:hero},{type:"wave"},{type:"clear"}])assert.deepEqual(audioEventsFor(event),[]);
const config=defaultAudioConfig();assert.deepEqual(assertAudioConfig(JSON.parse(JSON.stringify(config))),config);
for(const mutate of [c=>c.events.enemyHit.volume=-1,c=>c.masterVolume=2,c=>c.events.heroDeath.sound="missing",c=>c.events.bowDraw.cooldown=-10,c=>c.events.victory.enabled="yes",c=>delete c.events.arrowHit]) { const c=structuredClone(config);mutate(c);assert.throws(()=>assertAudioConfig(c)); }
const asset={id:"test",name:"test.wav",path:"test.wav",source:"project",url:"/audio/test.wav",size:100};
for(const url of ["https://example.com/a.wav","/audio/../a.wav","/audio/%2e%2e/a.wav","/audio/test.wav?x=1","/audio/\\test.wav"])assert.throws(()=>assertAudioConfig({...config,assets:[{...asset,url}]}));
await mkdir("logs",{recursive:true});const root=await mkdtemp(path.resolve("logs/audio-scan-"));
try {
  await mkdir(path.join(root,"nested"));
  await writeFile(path.join(root,"nested","拉弓 01.WAV"),waveFile());
  await writeFile(path.join(root,"README.txt"),"ignored");
  const catalog=await scanAudioDirectory(root);assert.equal(catalog.length,1);assert.equal(catalog[0].path,"nested/拉弓 01.WAV");
  assert.equal(catalog[0].url,"/audio/nested/"+encodeURIComponent("拉弓 01.WAV"));
  assertAudioConfig({...config,assets:catalog});
  let emitted;await audioCatalogPlugin(root).generateBundle.call({emitFile:value=>{emitted=value;}});
  assert.equal(emitted.fileName,"audio-manifest.json");assert.deepEqual(JSON.parse(emitted.source).assets,catalog);
} finally {await unlink(path.join(root,"nested","拉弓 01.WAV"));await unlink(path.join(root,"README.txt"));await rmdir(path.join(root,"nested"));await rmdir(root);}
console.log("PASS audio: 13 event mappings, actual hits only, hero/tower filtering, once-per-day cue, config validation, recursive scan, encoded paths and build manifest");
