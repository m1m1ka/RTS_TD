import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { withinFollowerArea } from "../src/followers.js";
const point=u=>({x:u.x,y:u.y});
const advance=(g,t)=>{for(let s=0;s<t;s+=.025)g.tick(.025);};
const setup=()=>{
  const c=structuredClone(DEFAULT_CONFIG);for(const card of Object.values(c.cards))if(card.category==="hero")card.triggerRules=[];
  const events=[],g=new Game(e=>events.push(e),c);g.playCard("hero_blue",3,3);g.playCard("hero_green",4,3);
  return {g,a:g.heroes[0],b:g.heroes[1],events};
};
{
  const {g,a}=setup();g.select(0);g.move(5,5);assert.equal(a.path.length,2,"diagonal distance is one step");
  advance(g,1);assert.deepEqual(point(a),{x:5,y:5});
  g.obstacles.add("6,5");assert.ok(g.path(a,{x:6,y:6},{units:true}).length>1,"no cutting through solid corners");
}
{
  const {g,a,b,events}=setup();g.select(0);g.move(5,3);
  assert.deepEqual(a.path,[{x:4,y:3},{x:5,y:3}],"allies do not force path detours");
  g.tick(.025);assert.deepEqual(point(a),point(b),"passing through an ally is allowed");
  advance(g,.5);assert.deepEqual(point(a),{x:5,y:3});assert.deepEqual(point(b),{x:4,y:3});
  assert.equal(events.filter(e=>e.yielding).length,0,"passing allies are not unnecessarily displaced");
}
{
  const {g,a,b,events}=setup();assert.ok(g.reachableCells(a).some(p=>p.x===b.x&&p.y===b.y));
  g.select(0);g.move(b.x,b.y);g.tick(.025);
  assert.deepEqual(point(a),{x:4,y:3});assert.ok(Math.max(Math.abs(b.x-4),Math.abs(b.y-3))===1);
  assert.notDeepEqual(point(a),point(b));assert.equal(events.filter(e=>e.yielding).length,1);
  assert.equal(b.path.length,0);advance(g,1);assert.notDeepEqual(point(a),point(b));
}
{
  const {g,a,b}=setup();for(let y=2;y<=4;y++)for(let x=3;x<=5;x++)if(![[3,3],[4,3]].some(p=>p[0]===x&&p[1]===y))g.obstacles.add(`${x},${y}`);
  g.select(0);g.move(4,3);g.tick(.025);assert.deepEqual(point(a),{x:4,y:3});assert.deepEqual(point(b),{x:3,y:3},"one-step swap uses mover's vacated cell");
}
{
  const {g,a,b}=setup();Object.assign(a,{x:1,y:1});for(let y=2;y<=4;y++)for(let x=3;x<=5;x++)if(x!==4||y!==3)g.obstacles.add(`${x},${y}`);
  g.select(0);g.move(4,3);assert.equal(a.path.length,0,"no free neighboring cell rejects rather than overlaps or teleports");
}
{
  const {g,a,b}=setup();g.playCard("tower",5,3);const tower=g.towers[0];
  g.select(0);g.move(6,3);assert.equal(a.path.length,3);advance(g,1);assert.deepEqual(point(tower),{x:5,y:3});
  g.select(0);g.move(5,3);advance(g,.5);assert.deepEqual(point(a),{x:5,y:3});assert.notDeepEqual(point(a),point(tower));
}
{
  const {g,a,b}=setup();Object.assign(b,{x:8,y:4});const [f]=g.summonFollowers(b,{count:1,hpPercent:50,atkPercent:50});
  const target=point(f);g.select(0);g.move(target.x,target.y);advance(g,3);
  assert.deepEqual(point(a),target);assert.ok(withinFollowerArea(f,b),"yielding follower stays in owner's nine cells");
  const held=point(f);advance(g,2);assert.deepEqual(point(f),held,"yielded follower does not immediately reclaim the tile");
}
{
  const {g,a}=setup();g.enemies.push({id:999,x:4,y:4,hp:100,side:"enemy"});
  assert.ok(!g.path(a,{x:5,y:5},{units:true}).some(p=>p.x===4&&p.y===4));
  assert.equal(g.cardTarget("hero_purple",4,3).valid,false,"deployment still forbids overlapping allies");
}
console.log("PASS friendly movement: diagonal step costs, friendly transit, adjacent yielding/swaps, full destination rejection, tower safety, follower bounds and enemy/placement collisions");
