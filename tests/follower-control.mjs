import assert from "node:assert/strict";
import { Game, dist } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { withinFollowerArea, FOLLOW_DELAY } from "../src/followers.js";
const setup = (count=1) => {
  const c=structuredClone(DEFAULT_CONFIG);
  for(const day of c.days){day.obstacles=[];day.mines=[];}
  for(const card of Object.values(c.cards))if(card.category==="hero")card.triggerRules=[];
  const events=[];let g;g=new Game(e=>events.push({...e,at:g?.time??0}),c);
  g.playCard("hero_blue",4,4);const h=g.heroes[0];
  g.summonFollowers(h,{count,hpPercent:50,atkPercent:50});
  return {g,h,f:g.followers[0],events};
};
const advance=(g,time)=>{for(let t=0;t<time-1e-8;t+=.025)g.tick(Math.min(.025,time-t));};
const point=u=>({x:u.x,y:u.y});
{
  const {g,h,f,events}=setup(),start=point(f);
  g.select(0);g.move(8,4);g.tick(.025);
  const ownerStep=events.find(e=>e.type==="step"&&e.unit===h).at;
  assert.deepEqual(point(f),start,"follower does not step in the same tick as the owner");
  advance(g,FOLLOW_DELAY-.05);assert.deepEqual(point(f),start);
  advance(g,4);
  const followerStep=events.find(e=>e.type==="step"&&e.unit===f).at;
  assert.ok(followerStep-ownerStep>=FOLLOW_DELAY-1e-8);
  assert.equal(h.x,8);assert.ok(withinFollowerArea(f,h),"continuous owner movement never postpones follow forever");
  assert.ok(f.followTrail.length<=32);assert.equal(dist(h,f),1);
}
{
  const {g,h,f}=setup();g.selectFollower(f.id);
  assert.equal(g.selectedUnit(),f);assert.equal(g.selected,-1);
  const cells=g.reachableCells(f);
  assert.equal(cells.length,8,"the owner's cell is reachable when its occupant can yield");
  assert.ok(cells.every(c=>withinFollowerArea(c,h)));
  assert.ok(cells.some(c=>c.x===h.x+1&&c.y===h.y+1),"corners of the nine-cell square are available");
  const target={x:h.x+1,y:h.y+1};g.move(target.x,target.y);
  assert.ok(f.path.length>0);assert.ok(f.path.every(c=>withinFollowerArea(c,h)));
  advance(g,1.5);assert.deepEqual(point(f),target);
  advance(g,2);assert.deepEqual(point(f),target,"manual placement is not immediately undone by automatic follow");
  g.selectFollower(f.id);g.move(h.x+2,h.y);assert.equal(f.manualTarget,null);assert.equal(f.path.length,0);
  advance(g,.5);assert.deepEqual(point(f),target,"out-of-range order is rejected");
  g.select(0);assert.equal(g.selectedFollowerId,null);assert.equal(g.selectedUnit(),h);
}
{
  const {g,h,f}=setup();Object.assign(f,{x:3,y:3,followOffset:{x:-1,y:-1}});g.obstacles.add("4,3");g.obstacles.add("3,4");
  g.selectFollower(f.id);assert.deepEqual(g.reachableCells(f),[],"cannot leave the square to detour around a blockade");
  g.move(5,5);assert.equal(f.manualTarget,null);advance(g,.5);assert.deepEqual(point(f),{x:3,y:3});
  g.obstacles.clear();g.mines.push({id:999,x:4,y:3,hp:100});g.enemies.push({id:998,x:3,y:4,hp:100,side:"enemy"});
  assert.deepEqual(g.reachableCells(f),[],"mines and enemies block constrained routes too");
}
{
  const {g,h,f}=setup();g.selectFollower(f.id);g.move(5,5);f.moveCooldown=1;
  // Owner moves the nine-cell boundary before the pending command can execute.
  Object.assign(h,{x:7,y:4});g.tick(.025);
  assert.equal(f.manualTarget,null);assert.deepEqual(f.path,[]);
  assert.deepEqual(g.reachableCells(f),[],"stragglers cannot be ordered outside the owner's square");
  advance(g,3);assert.ok(withinFollowerArea(f,h),"cancelled route resumes automatic catch-up");
}
{
  const {g,h,f}=setup();g.selectFollower(f.id);g.move(3,3);f.moveCooldown=.4;
  g.obstacles.add("3,3");advance(g,1);
  assert.notDeepEqual(point(f),{x:3,y:3});assert.equal(f.manualTarget,null,"new obstruction cancels impossible order");
}
{
  const {g,h,f}=setup();g.phase="battle";
  g.spawnQueues=[{types:["grunt"],spawned:0,nextAt:999}];
  const enemy={id:999,side:"enemy",type:"grunt",x:3,y:3,hp:1000,maxHp:1000,atk:1,range:1,rate:1,speed:1,cooldown:0,moveCooldown:0};g.enemies.push(enemy);
  Object.assign(h,{x:8,y:4});advance(g,3);
  assert.ok(withinFollowerArea(f,h),"nearby combat cannot strand followers far from owner");
}
{
  const {g,h,f}=setup(2);assert.notEqual(g.followers[0].followDelay,g.followers[1].followDelay);
  g.selectFollower(f.id);g.phase="route";g.chooseDay(g.nextDays()[0]);assert.equal(g.selectedFollowerId,null);
  assert.equal(g.selectedUnit(),undefined);
}
console.log("PASS follower control: delayed/staggered following, continuous catch-up, independent selection, nine-cell paths/highlights, holding commands, moving boundaries, obstacles, combat and day cleanup");
