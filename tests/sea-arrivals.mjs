import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { gridDistance } from "../src/grid-distance.js";
import { SAIL_DISTANCE, landingCells, tickBoats } from "../src/sea-arrivals.js";

function fixture(x=7,y=0,count=7) {
  const c=structuredClone(DEFAULT_CONFIG);
  c.initial.firstWaveDelay=0;
  c.days=[c.days[0]];c.days[0].next=[];c.days[0].obstacles=[];c.days[0].mines=[];
  c.days[0].waves=[{id:"sea",name:"海盗登陆",hpScale:1,atkScale:1,startDelay:0,spawns:[{x,y,delay:0,interval:.5,enemies:[{type:"grunt",count,level:1}]}]}];
  Object.assign(c.enemies.grunt,{maxHp:10000,atk:0,speed:.5,range:1});
  return c;
}
const step=(g,t)=>{for(let left=t;left>1e-8;left-=.025)g.tick(Math.min(.025,left));};
function game(c, event=()=>{}) {const g=new Game(event,c);g.playCard("hero_blue",6,5);g.startDay();g.heroes[0].atk=0;g.tick(0);return g;}
function blockSides(g) {for(const p of landingCells(g.boats[0]).slice(1))g.obstacles.add(`${p.x},${p.y}`);}

for(const [x,y,dx,dy] of [[0,5,1,0],[14,5,-1,0],[7,0,0,1],[7,10,0,-1]]) {
  const g=game(fixture(x,y)), b=g.boats[0];
  assert.equal(g.enemies.length,7);assert.equal(b.layers,2);assert.deepEqual([b.dx,b.dy],[dx,dy]);
  assert.equal(g.remainingEnemies(),7,"offshore passengers count toward wave completion");
  const points=g.enemies.map(e=>[e.x,e.y]);assert.equal(new Set(points.map(p=>p.join())).size,4,"four combat positions along the hull");
  for(let i=1;i<4;i++) assert.deepEqual(points[i],[points[0][0]-dx*i,points[0][1]-dy*i],"positions are one cell apart along the sailing direction");
  for(let i=4;i<7;i++) {
    assert.deepEqual(points[i],points[i-4],"extra crew stack on the four existing positions");
    assert.ok(Math.abs(g.enemies[i-4].seaY-g.enemies[i].seaY-.48)<1e-8);
  }
  assert.equal(gridDistance(g.heroes[0],g.enemies[0]),gridDistance(g.heroes[0],g.enemies[4]),"visual height never changes range");
  assert.ok(g.enemies.every(e=>dx ? e.x<0||e.x>14 : e.y<0||e.y>10));
  step(g,1);
  assert.ok(Math.abs(b.remaining-(SAIL_DISTANCE-2))<1e-8);
  const saved=g.snapshot();g.tick(0);assert.deepEqual(g.snapshot(),saved,"pause freezes ships, attacks and unloading");
  const h=g.heroes[0];Object.assign(h,{x,y,path:[],mechanics:{immobile:true}});
  blockSides(g);
  step(g,2.025);
  assert.deepEqual([h.x,h.y],[x+dx*2,y+dy*2],"forced landing push overrides voluntary immobility");
  assert.equal(g.enemies.filter(e=>!e.boatId).length,1);
  assert.equal(g.boats.length,1,"remaining passengers keep the boat at the shore");
  assert.ok(g.enemies.every(e=>Number.isInteger(e.x)&&Number.isInteger(e.y)));
}
{
  const c=fixture(7,0,3), attacks=[];
  c.initial.boatSpeed=1;c.enemies.grunt.atk=5;
  const g=game(c,e=>{if(e.type==="attack")attacks.push({side:e.source.side,aboard:!!e.source.boatId,targetAboard:!!e.target.boatId,distance:gridDistance(e.source,e.target),range:e.source.range});});
  Object.assign(g.heroes[0],{x:7,y:0,atk:5,range:1,maxHp:10000,hp:10000});
  step(g,5.7);
  assert.ok(g.boats[0].remaining>0,"both sides trade blows before docking");
  assert.ok(attacks.some(a=>a.side==="hero"&&a.targetAboard));
  assert.ok(attacks.some(a=>a.side==="enemy"&&a.aboard));
  assert.ok(attacks.every(a=>a.distance<=a.range));
  assert.ok(g.heroes[0].hp<10000);
}
{
  const c=fixture(0,5,1);c.initial.landingKnockback=4;
  const g=game(c);Object.assign(g.heroes[0],{x:0,y:5,path:[]});g.obstacles.add("2,5");
  blockSides(g);
  step(g,3.025);assert.equal(g.heroes[0].x,1,"push stops before an obstacle");
  assert.equal(g.enemies[0].boatId,undefined);
}
for(const [x,y] of [[0,5],[14,5],[7,0],[7,10]]) {
  const c=fixture(x,y,7);c.initial.boatSpeed=20;c.initial.landingKnockback=0;
  const g=game(c),hero=g.heroes[0];Object.assign(hero,{x,y,atk:0});
  blockSides(g);
  const survivor=g.enemies.at(-1);
  for(const e of g.enemies.slice(0,-1))g.hit(e,1000000,hero);
  step(g,.35);
  assert.equal(gridDistance(hero,survivor),1,"last survivor moves to the gangway, even after the front row dies");
  const hp=hero.hp;survivor.atk=10;survivor.cooldown=0;step(g,.25);
  assert.ok(hero.hp<hp,"a blocked ship can still fight its way ashore");
}
{
  const c=fixture(0,5,1);c.initial.landingKnockback=0;
  const g=game(c);Object.assign(g.heroes[0],{x:0,y:5,path:[]});blockSides(g);step(g,4);
  assert.equal(g.heroes[0].x,0);assert.ok(g.enemies[0].boatId,"blocked gangway does not stack units");
  g.heroes[0].x=2;step(g,.025);assert.equal(g.enemies[0].boatId,undefined);
  assert.equal(g.boats.length,0);
}
{
  const g=game(fixture()), old=g.snapshot(), config=structuredClone(g.config);
  config.initial.boatSpeed=4;g.applyConfig(config);
  assert.deepEqual(g.enemies.map(e=>[e.id,e.x,e.y,e.boatId]),old.enemies.map(e=>[e.id,e.x,e.y,e.boatId]),"hot edits don't relocate or duplicate offshore passengers");
  step(g,1);assert.ok(Math.abs(g.boats[0].remaining-2)<1e-8,"speed changes immediately");
  for(const e of g.enemies)g.hit(e,1000000,g.heroes[0]);step(g,.025);
  assert.equal(g.boats.length,0);assert.equal(g.phase,"victory","destroying all passengers at sea completes the wave");
  g.reset();assert.equal(g.boats.length,0);assert.equal(g.enemies.length,0);
}
{
  const c=fixture(4,4,1),g=game(c);assert.ok(g.boats[0].gate.x===0||g.boats[0].gate.y===0,"interior gates use the nearest shore");
  const legacy=fixture();delete legacy.initial.boatSpeed;delete legacy.initial.landingKnockback;
  const updated=assertConfig(legacy);assert.equal(updated.initial.boatSpeed,2);assert.equal(updated.initial.landingKnockback,2);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(updated))),updated);
  for(const [key,value] of [["boatSpeed",0],["boatSpeed",NaN],["landingKnockback",-1],["landingKnockback",1.5]]) {
    const bad=fixture();bad.initial[key]=value;assert.ok(validateConfig(bad).length);
  }
}
{
  const c=fixture(6,5,1),g=new Game(()=>{},c);
  for(let y=3;y<=7;y++)for(let x=5;x<=9;x++)
    if((x===5||x===9||y===3||y===7)&&!(x===7&&y===3))g.towers.push({id:++g.id,x,y,hp:100,side:"hero"});
  assert.equal(g.playCard("tower",7,3),false,"towers cannot seal every shore even when the authored gate is inland");
}
for(const [x,y] of [[0,5],[14,5],[7,0],[7,10]]) {
  const events=[],g=game(fixture(x,y),e=>events.push(e)),b=g.boats[0],cells=landingCells(b);
  Object.assign(g.heroes[0],{x,y,path:[]});
  b.remaining=0;tickBoats(g,0);
  assert.deepEqual([g.enemies[0].x,g.enemies[0].y],[x,y],"prefer the bow cell even when both side cells are free");
  assert.deepEqual([g.heroes[0].x,g.heroes[0].y],[x+b.dx*2,y+b.dy*2],"push the hero inland before landing at the bow");
  tickBoats(g,.49);assert.equal(g.enemies.filter(e=>!e.boatId).length,1,"side landings respect unloading interval");
  tickBoats(g,.01);
  assert.deepEqual([g.enemies[1].x,g.enemies[1].y],[cells[1].x,cells[1].y]);
  tickBoats(g,.5);
  assert.deepEqual([g.enemies[2].x,g.enemies[2].y],[cells[2].x,cells[2].y],"divert when the bow is occupied by a landed enemy");
  assert.equal(events.filter(e=>e.type==="knockback").length,1);
  assert.equal(new Set(g.enemies.filter(e=>!e.boatId).map(e=>`${e.x},${e.y}`)).size,3,"three landed enemies never overlap");
  tickBoats(g,.5);assert.equal(g.enemies.filter(e=>!e.boatId).length,3,"wait when all three cells contain enemies");
}
for (const disabled of [false,true]) {
  const c=fixture(0,5);if(disabled)c.initial.landingKnockback=0;
  const g=game(c),b=g.boats[0];b.remaining=0;
  Object.assign(g.heroes[0],{x:0,y:5});if(!disabled)g.obstacles.add("1,5");
  tickBoats(g,0);
  assert.deepEqual([g.heroes[0].x,g.heroes[0].y],[0,5]);
  assert.deepEqual([g.enemies[0].x,g.enemies[0].y],[0,4],"use a free adjacent cell if the bow hero cannot be displaced");
}
{
  const events=[],g=game(fixture(0,5),e=>events.push(e)),b=g.boats[0];b.remaining=0;
  Object.assign(g.heroes[0],{x:0,y:5,path:[]});g.obstacles.add("1,5");
  g.followers.push({...g.heroes[0],id:++g.id,x:0,y:4,path:[]});
  g.mines.push({x:0,y:6,hp:100});
  tickBoats(g,0);
  assert.deepEqual([g.enemies[0].x,g.enemies[0].y],[0,4],"try an adjacent push when center push is obstructed");
  assert.deepEqual([g.heroes[0].x,g.heroes[0].y],[0,5],"failed center attempt leaves the hero untouched");
  assert.equal(g.followers[0].x,2);
  assert.equal(events.filter(e=>e.type==="knockback").length,1);
}
{
  const g=game(fixture(0,5)),b=g.boats[0];b.remaining=0;
  g.obstacles.add("0,5");g.obstacles.add("0,3");g.obstacles.add("1,4");
  tickBoats(g,0);
  assert.deepEqual([g.enemies[0].x,g.enemies[0].y],[0,6],"skip an empty adjacent shore cell isolated from the island");
}
for(const [x,y,dx,dy] of [[0,0,1,0],[0,0,0,1],[14,10,-1,0],[14,10,0,-1]]) {
  const cells=landingCells({gate:{x,y},dx,dy});
  assert.equal(cells.length,2,"corners have only one adjacent cell on the same shoreline");
  assert.ok(cells.every(p=>p.x>=0&&p.x<15&&p.y>=0&&p.y<11&&(dx?p.x===x:p.y===y)));
}
// A landing impulse crosses units and displaces allies occupying its endpoint.
for (const [x,y,dx,dy] of [[0,3,1,0],[14,3,-1,0],[5,0,0,1],[5,10,0,-1]]) {
  const events=[],g=game(fixture(x,y,1),e=>events.push(e)),boat=g.boats[0];boat.remaining=0;
  const hero=g.heroes[0];Object.assign(hero,{x,y,path:[]});
  const add=(n,extra={})=>{const h={...hero,id:++g.id,x:x+dx*n,y:y+dy*n,path:[{x:6,y:6}],...extra};g.heroes.push(h);return h;};
  const behind=add(1),endpoint=add(2,{mechanics:{immobile:true}}),further=add(4);
  tickBoats(g,0);
  assert.deepEqual([hero.x,hero.y],[x+dx*2,y+dy*2],"intermediate allies never shorten the landing impulse");
  assert.deepEqual([behind.x,behind.y],[x+dx,y+dy],"units crossed in flight stay in place");
  assert.notDeepEqual([endpoint.x,endpoint.y],[x+dx*2,y+dy*2],"endpoint occupant yields even if voluntarily immobile");
  assert.equal(endpoint.path.length,0);assert.ok(endpoint.moveCooldown>=.25);
  assert.equal(new Set(g.heroes.map(h=>`${h.x},${h.y}`)).size,4,"all heroes finish in separate cells");
  assert.deepEqual([g.enemies[0].x,g.enemies[0].y],[x,y],"prefer the front despite the crowded formation");
  assert.ok(events.some(e=>e.type==="knockback"&&e.unit===endpoint));
}
{
  const events=[],g=game(fixture(0,3,1),e=>events.push(e)),boat=g.boats[0];boat.remaining=0;
  const hero=g.heroes[0];Object.assign(hero,{x:0,y:3,path:[]});
  // Pack a narrow lane, leaving only its final cell vacant. All intervening
  // occupants must move as one plan; a one-neighbor-only workaround cannot pass.
  for(let x=1;x<=8;x++){g.obstacles.add(`${x},2`);g.obstacles.add(`${x},4`);}
  g.obstacles.add('9,3');
  for(let x=1;x<=7;x++)g.followers.push({...hero,id:++g.id,x,y:3,path:[]});
  tickBoats(g,0);
  assert.equal(hero.x,2);assert.equal(g.enemies[0].boatId,undefined);
  assert.ok(events.filter(e=>e.type==="knockback").length>=4,"packed endpoints push an entire chain");
  assert.equal(new Set([...g.heroes,...g.followers].map(h=>`${h.x},${h.y}`)).size,8);
}
{
  const events=[],g=game(fixture(0,3,1),e=>events.push(e)),boat=g.boats[0];boat.remaining=0;
  const hero=g.heroes[0];Object.assign(hero,{x:0,y:3,path:[]});
  // Fully enclosed occupied lane: failed displacement must commit no moves.
  for(let x=1;x<=2;x++){g.obstacles.add(`${x},2`);g.obstacles.add(`${x},4`);g.heroes.push({...hero,id:++g.id,x,y:3,path:[]});}
  g.obstacles.add('3,3');blockSides(g);
  const before=g.heroes.map(h=>[h.x,h.y]);tickBoats(g,0);
  assert.deepEqual(g.heroes.map(h=>[h.x,h.y]),before);assert.ok(g.enemies[0].boatId);
  assert.equal(events.filter(e=>e.type==="knockback").length,0,"failed chains have no partial knockback effects");
}
{
  const g=game(fixture(0,3,1)),boat=g.boats[0];boat.remaining=0;
  const hero=g.heroes[0];Object.assign(hero,{x:0,y:3,path:[]});
  g.enemies.push({id:++g.id,x:1,y:3,hp:100,side:"enemy"});
  tickBoats(g,0);assert.equal(hero.x,2,"intermediate enemies do not block flight either");
  assert.equal(g.enemies.at(-1).x,1,"landing knockback never relocates an enemy");
}
console.log("PASS sea arrivals: four shores, four stations, shoulder stacks, sea combat, bow-first landing, unit-crossing knockback, occupied endpoints and chained displacement, atomic failure, adjacent fallback, live settings and cleanup");
