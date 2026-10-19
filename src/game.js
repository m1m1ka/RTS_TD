import { syncSkillCards, skillCopy, skillDefinition, fuseSkillCards } from "./skill-cards.js";
import { obstacleKeys, reachableTerrain } from "./terrain.js";
import { MINE_HP, victoryPayout } from "./gold.js";
import { criticalChance, criticalDamage } from "./critical.js";
import { attackModules, attackModuleId, attackProfile } from "./attack-modules.js";
import { effectAmount } from "./effect-values.js";
import { generationPool } from "./card-generation.js";
import { drawRewards } from "./rewards.js";
import { enterShop, refreshShop, buyShopHero, buyShopPack, choosePackCard, reconcileShop, shopPrices } from "./shop.js";
import { resourceTargets, applyResourceEffect } from "./resource-effects.js";
import { getWeaponSpec } from "./weapons.js";
import { getConfig, subscribeConfig } from "./config/store.js";
import { cardRadius } from "./config/schema.js";
import { waveCount } from "./config/migrate.js";
import { HeroTriggers } from "./hero-triggers.js";
import { summonFollowers, removeFollowers, moveFollowers, followerMoveArea, setFollowerDestination } from "./followers.js";
import { levelStats } from "./level-stats.js";
import { gridDistance } from "./grid-distance.js";
import { isHealer, tickHealer, healingDefaults } from "./healing-behavior.js";
import { rememberAttacker, tickRetaliation } from "./retaliation-behavior.js";
import { heroRank, rankedHeroCard } from "./hero-ranks.js";
import { isDormant, canMoveHero, syncHeroMechanics, knockback, finishVictoryBonuses } from "./hero-mechanics.js";
import { startDayId, nextDayIds, campaignLayout } from "./campaign.js";
import { launchBoat, tickBoats, landingGate } from "./sea-arrivals.js";
export const W = 15,
  H = 11,
  BASE = { x: 7, y: 5 };
export let days = getConfig().days;
export let heroSpecs = Object.values(getConfig().cards)
  .filter((c) => c.category === "hero")
  .map((c) => ({ ...c.unit, name: c.name }));
subscribeConfig((config) => {
  days = config.days;
  heroSpecs = Object.values(config.cards)
    .filter((c) => c.category === "hero")
    .map((c) => ({ ...c.unit, name: c.name }));
});
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const steps4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const steps8 = [...steps4, [1, -1], [1, 1], [-1, 1], [-1, -1]];
export const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const attackKind = (unit) =>
  isHealer(unit) ? "healing" : getWeaponSpec(unit)?.kind || attackModules[attackModuleId(unit)].kind;
export function attackDuration(source, target) {
  const kind = attackKind(source);
  return kind === "slash"
    ? 0.14
    : kind === "claw"
      ? 0.18
      : Math.min(
          0.48,
          Math.max(
            0.22,
            dist(source, target) / (getWeaponSpec(source)?.speed || 10),
          ),
        );
}
export class Game {
  constructor(onEvent = () => {}, config = getConfig()) {
    this.config = config;
    this.onEvent = onEvent;
    this.reset();
  }
  emit(type, data = {}) {
    this.onEvent({ type, ...data });
  }
  reset() {
    this.id = 0;
    this.gold = 0;
    this.settlement = null;
    this.mines = [];
    this.time = 0;
    this.cards = { ...this.config.initial.cards };
    this.skillCards = [];
    this.skillCardId = 0;
    syncSkillCards(this);
    this.rewardOptions = [];
    this.shop = null;
    this.kills = 0;
    this.wave = 0;
    this.day = Math.max(0, this.config.days.findIndex((d) => d.id === startDayId(this.config)));
    this.routeHistory = [this.config.days[this.day].id];
    this.completedDays = [];
    this.dayPlan = null;
    this.activeWave = null;
    this.waveElapsed = 0;
    this.waveWait = 0;
    this.spawnQueues = [];
    this.boats = [];
    this.phase = "ready";
    this.baseMaxHp = this.config.initial.baseHp;
    this.baseHp = this.baseMaxHp;
    this.selected = 0;
    this.selectedFollowerId = null;
    this.enemies = [];
    this.towers = [];
    this.spawned = 0;
    this.attacks = [];
    this.attackId = 0;
    this.heroes = [];
    this.followers = [];
    this.heroReserve = [];
    this.heroTriggers = new HeroTriggers(this);
    this.obstacles = new Set();
    this.syncMines();
    this.syncTerrain();
    if (this.config.days[this.day].kind === "shop") enterShop(this);
    this.emit("reset");
  }
  syncMines(preserve = false) {
    const old = new Map(this.mines.map((m) => [`${m.x},${m.y}`, m]));
    this.mines = (this.config.days[this.day].mines || []).map((cell) => {
      const maxHp = cell.maxHp ?? MINE_HP, saved = preserve && old.get(`${cell.x},${cell.y}`);
      if (saved) { saved.hp = saved.hp / saved.maxHp * maxHp; saved.maxHp = maxHp; return saved; }
      return { id: ++this.id, x: cell.x, y: cell.y, hp: maxHp, maxHp, type: "mine", side: "neutral", name: "金矿" };
    });
  }
  syncTerrain(force = false) {
    const next = obstacleKeys(this.config.days[this.day]);
    const blocked = new Set([...next, ...this.mines.filter((m) => m.hp > 0).map((m) => `${m.x},${m.y}`)]);
    const gates = new Set([...this.config.days[this.day].waves, ...(this.dayPlan?.waves || [])].flatMap((w) => w.spawns).map((p) => `${p.x},${p.y}`));
    for (const boat of this.boats) gates.add(`${boat.gate.x},${boat.gate.y}`);
    const towerCells = this.towers.filter((u) => u.hp > 0).map((u) => `${u.x},${u.y}`);
    const previousRoutes = reachableTerrain(new Set([...blocked, ...towerCells]));
    if (!force && next.size === this.obstacles.size && [...next].every((key) => this.obstacles.has(key)) && [...gates].every((key) => previousRoutes.has(key))) return;
    const reachable = reachableTerrain(blocked);
    const units = [...this.heroes, ...this.followers, ...this.towers, ...this.enemies].filter((u) => u.hp > 0 && !u.boatId);
    const affected = units.filter((u) => next.has(`${u.x},${u.y}`) || !reachable.has(`${u.x},${u.y}`) || (force && u.side === "hero" && gates.has(`${u.x},${u.y}`)));
    const occupied = new Set(units.filter((u) => !affected.includes(u)).map((u) => `${u.x},${u.y}`));
    if ([...gates].some((key) => !reachable.has(key) || next.has(key))) {
      this.emit("toast", { text: "地图会封住当前出兵路线，请保存并重开应用" });
      return;
    }
    const moves = [];
    for (const unit of affected) {
      const free = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const key = `${x},${y}`;
        if (key !== "7,5" && reachable.has(key) && !next.has(key) && !occupied.has(key) && !gates.has(key)) free.push({ x, y });
      }
      free.sort((a, b) => dist(a, unit) - dist(b, unit));
      if (!free.length) {
        this.emit("toast", { text: "地图空地不足，障碍将在重新开局后应用" });
        return;
      }
      moves.push([unit, free[0]]);
      occupied.add(`${free[0].x},${free[0].y}`);
    }
    // Keep carried towers from sealing the selected branch's new spawn routes.
    const placed = new Set(blocked);
    for (const tower of this.towers.filter((u) => u.hp > 0)) {
      const pending = moves.find(([unit]) => unit === tower);
      const old = pending?.[1] || tower;
      const roadOpen = (position) => {
        const cells = reachableTerrain(new Set([...placed, `${position.x},${position.y}`]));
        return [...gates].every((key) => cells.has(key));
      };
      let position = old;
      if (!roadOpen(position)) {
        const free = [];
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const key = `${x},${y}`;
          if (key !== "7,5" && reachable.has(key) && !occupied.has(key) && !gates.has(key)) free.push({ x, y });
        }
        free.sort((a, b) => dist(a, tower) - dist(b, tower));
        position = free.find(roadOpen);
        if (!position) {
          this.emit("toast", { text: "地图空地不足以安置炮台，请保存并重开应用" });
          return;
        }
        occupied.delete(`${old.x},${old.y}`);
        occupied.add(`${position.x},${position.y}`);
        if (pending) pending[1] = position; else moves.push([tower, position]);
      }
      placed.add(`${position.x},${position.y}`);
    }
    this.obstacles = next;
    for (const [unit, position] of moves) Object.assign(unit, position);
    for (const hero of this.heroes) {
      if (hero.path.length) hero.path = this.path(hero, hero.path.at(-1), { units: true }) || [];
    }
  }
  blocked(x, y, ignore, units = false, ignoreAllies = false) {
    return (
      !inside(x, y) ||
      this.obstacles.has(`${x},${y}`) ||
      this.mines.some((m) => m.hp > 0 && m !== ignore && m.x === x && m.y === y) ||
      (x === 7 && y === 5) ||
      this.towers.some(
        (t) => t.hp > 0 && t !== ignore && t.x === x && t.y === y && !(ignoreAllies && t.side === ignore?.side),
      ) ||
      (units &&
        [...this.heroes, ...this.followers, ...this.enemies].some(
          (u) => u !== ignore && u.hp > 0 && u.x === x && u.y === y && !(ignoreAllies && u.side === ignore?.side),
        ))
    );
  }
  canStep(unit, from, to, units = true, ignoreAllies = this.canControl(unit)) {
    if (this.blocked(to.x, to.y, unit, units, ignoreAllies)) return false;
    // Diagonal movement cannot cut through solid corners or enemy units.
    if (from.x !== to.x && from.y !== to.y &&
        (this.blocked(to.x, from.y, unit, units, ignoreAllies) || this.blocked(from.x, to.y, unit, units, ignoreAllies))) return false;
    return true;
  }
  yieldPlan(mover, target) {
    const allies = [...this.heroes, ...this.followers, ...this.towers].filter(u => u.hp > 0 && u !== mover);
    const occupants = allies.filter(u => u.x === target.x && u.y === target.y);
    if (!occupants.length) return [];
    const gates = new Set(this.currentDay().waves.flatMap(w => w.spawns).map(p => `${p.x},${p.y}`));
    const reserved = new Set([`${target.x},${target.y}`]), plan = [];
    for (const unit of occupants) {
      if (!canMoveHero(this, unit)) return null;
      let owner = unit.isFollower ? this.heroes.find(h => h.id === unit.ownerId) : null;
      if (owner === mover) owner = target;
      const allowed = owner ? new Set(steps8.map(([dx,dy]) => `${owner.x+dx},${owner.y+dy}`).concat(`${owner.x},${owner.y}`)) : null;
      const next = steps8.map(([dx,dy]) => ({x:unit.x+dx,y:unit.y+dy})).find(p => {
        const key = `${p.x},${p.y}`;
        if (reserved.has(key) || gates.has(key) || (allowed && !allowed.has(key)) || this.blocked(p.x,p.y,mover,true)) return false;
        if (!this.canStep(unit, unit, p, true, true)) return false;
        if (this.towers.includes(unit)) {
          const blocked = new Set([...this.obstacles, ...this.mines.filter(m=>m.hp>0).map(m=>`${m.x},${m.y}`),
            ...this.towers.filter(t=>t.hp>0&&t!==unit).map(t=>`${t.x},${t.y}`),key]);
          const open = reachableTerrain(blocked);
          if ([...gates].some(gate => !open.has(gate))) return false;
        }
        return true;
      });
      if (!next) return null;
      reserved.add(`${next.x},${next.y}`);plan.push({unit,next});
    }
    return plan;
  }
  moveStep(unit, next, { final = false, yieldAllies = true } = {}) {
    if (!canMoveHero(this, unit)) return false;
    if (!this.canStep(unit, unit, next)) return false;
    const plan = final ? this.yieldPlan(unit, next) : [];
    if (!plan || (!yieldAllies && plan.length)) return false;
    Object.assign(unit, next);
    unit.moveCooldown = 1 / unit.speed;
    for (const displaced of plan) {
      const ally = displaced.unit;
      Object.assign(ally, displaced.next);
      ally.path = [];
      ally.moveCooldown = 1 / (ally.speed || 4);
      if (ally.isFollower) { setFollowerDestination(this, ally, ally); ally.manualTarget = null; }
      this.emit("step", { unit: ally, yielding: true });
    }
    this.emit("step", { unit });
    return true;
  }
  reachableCells(unit) {
    if (!this.canControl(unit)) return [];
    const allowed = unit.isFollower ? followerMoveArea(this, unit) : null;
    if (allowed && !allowed.has(`${unit.x},${unit.y}`)) return [];
    const queue = [{ x: unit.x, y: unit.y }];
    const seen = new Set([`${unit.x},${unit.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      for (const [dx, dy] of steps8) {
        const x = c.x + dx, y = c.y + dy, key = `${x},${y}`;
        if (seen.has(key) || (allowed && !allowed.has(key)) || !this.canStep(unit, c, {x,y})) continue;
        seen.add(key);
        queue.push({ x, y });
      }
    }
    return queue.slice(1).filter(p => this.yieldPlan(unit, p) !== null);
  }
  path(start, end, { adjacent = false, units = false, avoid = null, allowed = null, diagonal = this.canControl(start), ignoreAllies = this.canControl(start) } = {}) {
    const queue = [{ x: start.x, y: start.y, path: [] }],
      seen = new Set([`${start.x},${start.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (adjacent ? dist(c, end) <= 1 : dist(c, end) === 0) return c.path;
      const distance = diagonal ? gridDistance : dist;
      const next = (diagonal ? steps8 : steps4).map(([dx,dy]) => [c.x+dx,c.y+dy])
        .sort((a,b) => distance({x:a[0],y:a[1]},end) - distance({x:b[0],y:b[1]},end));
      for (const [x, y] of next) {
        const key = `${x},${y}`;
        if (seen.has(key) || avoid?.has(key) || (allowed && !allowed.has(key)) || !this.canStep(start,c,{x,y},units,ignoreAllies)) continue;
        seen.add(key);
        queue.push({ x, y, path: [...c.path, { x, y }] });
      }
    }
    return null;
  }
  move(x, y) {
    const h = this.selectedUnit();
    if (!h) return this.emit("toast", { text: "先拖入一张英雄牌" });
    if (!canMoveHero(this,h)) return this.emit("toast", {text:isDormant(this,h)?"队友全部阵亡后苏醒":"该英雄部署后无法移动"});
    if (h.hp <= 0)
      return this.emit("toast", { text: "英雄休整中，下一波将自动归队" });
    const allowed = h.isFollower ? followerMoveArea(this, h) : null;
    if (allowed && (!allowed.has(`${x},${y}`) || !allowed.has(`${h.x},${h.y}`)))
      return this.emit("toast", { text: "随从只能在主人周围九宫格内移动" });
    if (this.blocked(x, y, h, true, true))
      return this.emit("toast", { text: "这里无法落脚，换一块空地吧" });
    if (!this.yieldPlan(h, {x,y})) return this.emit("toast", { text: "友军周围没有可让出的空格" });
    const p = this.path(h, { x, y }, { units: true, allowed });
    if (!p) return this.emit("toast", { text: "道路被挡住了，试试另一条路" });
    h.path = p;
    h.healingTargetId = null;
    h.retaliationTargetId = null;
    if (h.isFollower) setFollowerDestination(this, h, { x, y });
    this.emit("move", { unit: h });
  }
  select(i) {
    if (!this.heroes[i]) return;
    this.selectedFollowerId = null;
    this.selected = i;
    this.emit("select");
  }
  isDormant(unit) { return isDormant(this,unit); }
  canControl(unit) { return !!unit && unit.hp > 0 && canMoveHero(this,unit) && (this.heroes.includes(unit) || this.followers.includes(unit)); }
  selectedUnit() { return this.selectedFollowerId !== null ? this.followers.find(u => u.id === this.selectedFollowerId && u.hp > 0) : this.heroes[this.selected]; }
  selectFollower(id) {
    if (!this.followers.some(u => u.id === id && u.hp > 0)) return;
    this.selected = -1;
    this.selectedFollowerId = id;
    this.emit("select");
  }
  clearSelection() { this.selected = -1; this.selectedFollowerId = null; }
  syncSkillCards() { return syncSkillCards(this); }
  cardDefinition(key, instanceId) {
    const card = this.config.cards[key];
    return skillDefinition(card, card?.category === "battle" ? skillCopy(this, key, instanceId)?.tier : 1);
  }
  fuseSkillCards(key, tier) { return fuseSkillCards(this, key, tier); }
  cardTarget(key, x, y, instanceId) {
    const card = this.cardDefinition(key, instanceId);
    if (!card || !(this.cards[key] > 0))
      return { valid: false, reason: "没有这张牌了" };
    if (!["ready", "waiting", "battle", "between"].includes(this.phase))
      return { valid: false, reason: "现在不能出牌" };
    if (card.category === "battle") {
      const copy = skillCopy(this, key, instanceId);
      if (!copy) return { valid: false, reason: "没有这张技能牌了" };
      if (copy.readyAt > this.time + 1e-9) return { valid: false, reason: `技能冷却中 · ${Math.ceil(copy.readyAt - this.time)} 秒` };
    }
    if (!inside(x, y)) return { valid: false, reason: "拖到战场内使用" };
    const hero = this.heroes.find((h) => h.hp > 0 && h.x === x && h.y === y);
    if (card.category === "hero") {
      const deployed = this.heroes.find(h => h.cardId === key && !h.destroyed);
      if (deployed) {
        if (deployed.hp <= 0) return { valid: false, reason: "该英雄已上场，等待复活后可使用重复牌升级" };
        if (hero !== deployed) return { valid: false, reason: "不能重复上场，请对同名英雄使用：等级 +3" };
        return { valid: true, hero: deployed, upgradeHero: true };
      }
    }
    if (card.target === "any") {
      return { valid: true };
    } else if (card.target === "ground") {
      if (x < 1 || x > 13 || y < 1 || y > 9 || this.blocked(x, y, null, true))
        return { valid: false, reason: "需要一块内部空地" };
      if (card.effects.some((e) => e.type === "summon") &&
        [...this.config.days.flatMap((d) => d.waves), ...(this.dayPlan?.waves || [])]
          .some((w) => w.spawns.some((p) => p.x === x && p.y === y)))
        return { valid: false, reason: "敌方出生点不能放置炮台" };
    } else if (card.target === "hero") {
      if (!hero) return { valid: false, reason: "拖到我方英雄身上" };
      for (const effect of card.effects) {
        if (["swapLevels", "sacrifice", "drainLevels"].includes(effect.type)) {
          const others = resourceTargets(this, hero, effect);
          if (!others.some(h => effect.type !== "drainLevels" || h.level > 1)) return { valid: false, reason: effect.type === "drainLevels" ? "范围内没有可吸取等级的英雄" : "范围内需要另一位存活英雄" };
        }
      }
      if (card.effects.every((e) => e.type === "heal") && hero.hp >= hero.maxHp)
        return { valid: false, reason: "生命已满" };
      if (card.category === "equipment" && hero.equipment.includes(key))
        return { valid: false, reason: "已装备相同物品" };
    } else {
      if (this.phase !== "battle")
        return { valid: false, reason: "战斗中使用" };
      if (
        !this.enemies.some(
          (e) => e.hp > 0 && dist(e, { x, y }) <= cardRadius(card),
        )
      )
        return { valid: false, reason: "范围内没有敌人" };
    }
    return { valid: true, hero };
  }
  playCard(key, x, y, instanceId) {
    const check = this.cardTarget(key, x, y, instanceId);
    if (!check.valid) {
      this.emit("toast", { text: check.reason });
      return false;
    }
    const card = this.cardDefinition(key, instanceId);
    const copy = card.category === "battle" ? skillCopy(this, key, instanceId) : null;
    const cardListeners = this.heroTriggers.cardListeners();
    if (check.upgradeHero) {
      const hero = check.hero;
      this.cards[key]--;
      if (!this.cards[key]) delete this.cards[key];
      hero.level += 3;
      this.rebuildHero(hero);
      this.heroTriggers.syncSourceEffects();
      this.emit("upgrade", { unit: hero, levels: 3, useIcon: card.useIcon });
      this.emit("cardPlayed", { card: key, x, y, upgradeHero: true });
      this.heroTriggers.cardPlayed(key, cardListeners);
      return true;
    }
    const deploying =
      card.category === "hero" || card.effects.some((e) => e.type === "summon");
    let hero = check.hero;
    const reserveIndex = card.category === "hero" ? this.heroReserve.findIndex((u) => u.cardId === key) : -1;
    const returning = reserveIndex >= 0;
    if (deploying) {
      const unit = returning ? this.heroReserve.splice(reserveIndex, 1)[0] : {
        ...card.unit,
        name: card.name,
        useIcon: card.useIcon,
        cardId: key,
        x,
        y,
        home: { x, y },
        id: ++this.id,
        hp: card.unit.maxHp,
        level: 1,
        cooldown: 0,
        moveCooldown: 0,
        path: [],
        side: "hero",
        equipment: [],
        permanentEffects: [],
        dayEffects: [],
        triggerPermanentEffects: [],
      };
      Object.assign(unit, { x, y, home: { x, y }, cooldown: 0, moveCooldown: 0, path: [], retaliationTargetId: null, dayEffects: [] });
      hero = unit;
      this.rebuildHero(unit, returning);
      if (!returning) unit.hp = unit.maxHp;
      else if (unit.hp <= 0) unit.hp = Math.max(1, unit.maxHp * this.config.initial.reviveHp);
      if (card.category === "hero") {
        this.heroes.push(unit);
        this.heroTriggers.syncSourceEffects();
        this.selectedFollowerId = null;
        this.selected = this.heroes.length - 1;
        this.emit("deploy", { unit });
      } else {
        this.towers.push(unit);
        if (
          !landingGate(this, BASE) ||
          this.boats.some(b => !this.path(b.gate, BASE, { adjacent: true })) ||
          this.currentDay().waves
            .flatMap((w) => w.spawns)
            .some((g) => !this.path(g, BASE, { adjacent: true }))
        ) {
          this.towers.pop();
          this.emit("toast", { text: "需要保留通向核心的道路" });
          return false;
        }
        this.emit("build", { unit });
        this.heroTriggers.towerBuilt(unit);
        unit.hp = unit.maxHp;
      }
    }
    if (card.category === "equipment") {
      hero.equipment.push(key);
      this.rebuildHero(hero, false);
      this.emit("equip", { unit: hero, card: key });
    } else if (card.category === "battle") {
      this.emit("cardImpact", {
        card: key,
        visual: card.visual,
        useIcon: card.useIcon,
        x,
        y,
        radius: cardRadius(card),
      });
      const source = { x, y: y - 1, side: "hero", type: "spell" };
      for (const effect of card.effects)
        for (const enemy of this.enemies.filter(
          (e) => e.hp > 0 && dist(e, { x, y }) <= (effect.radius || 0),
        )) {
          if (effect.type === "damage") this.hit(enemy, effectAmount(effect, enemy), source);
          if (effect.type === "slow") {
            enemy.slowUntil = Math.max(
              enemy.slowUntil || 0,
              this.time + effect.duration,
            );
            enemy.slowAmount = effect.value;
          }
        }
      this.enemies = this.enemies.filter((e) => e.hp > 0);
    } else if (hero && !returning) {
      for (const effect of card.effects) {
        if (hero.destroyed) break;
        if (["summon", "generateCard", "gold"].includes(effect.type)) continue;
        if (["battleStart", "swapLevels", "sacrifice", "drainLevels"].includes(effect.type)) { applyResourceEffect(this, hero, effect); continue; }
        if (effect.type === "level") {
          hero.level += effect.value;
          this.rebuildHero(hero, false);
          hero.hp = Math.min(
            hero.maxHp,
            hero.hp + this.config.initial.levelGrowth.heal * effect.value,
          );
          this.emit("upgrade", { unit: hero, useIcon: card.useIcon });
        } else if (effect.type === "heal") {
          const amount = Math.min(effectAmount(effect, hero), hero.maxHp - hero.hp);
          hero.hp += amount;
          this.emit("heal", { unit: hero, amount, useIcon: card.useIcon });
        } else if (!deploying) {
          if (card.category === "resource")
            hero.permanentEffects.push(structuredClone(effect));
          this.applyUnitEffect(hero, effect);
        }
      }
    }
    if (!returning) for (const effect of card.effects)
      if (effect.type === "generateCard") this.generateCards(effect);
      else if (effect.type === "gold") { this.gold += effect.value; this.emit("goldGranted", { amount: effect.value }); }
    if (copy) {
      copy.cooldown = card.cooldown;
      copy.readyAt = this.time + card.cooldown;
    } else {
      this.cards[key]--;
      if (this.cards[key] === 0) delete this.cards[key];
    }
    this.emit("cardPlayed", { card: key, x, y });
    if (card.category === "hero") this.heroTriggers.prepare([hero]);
    this.heroTriggers.cardPlayed(key, cardListeners, copy);
    return true;
  }
  summonFollowers(owner, effect) { return summonFollowers(this, owner, effect); }
  clearTemporaryCards() {
    const removed = {};
    for (const [key, count] of Object.entries(this.cards)) if (this.config.cards[key]?.temporary) {
      removed[key] = count;
      delete this.cards[key];
    }
    syncSkillCards(this);
    if (Object.keys(removed).length) this.emit("temporaryCardsExpired", { cards: removed });
  }
  removeFollowers(ownerId) { removeFollowers(this, ownerId); }
  generateCards(effect) {
    const pool = generationPool(effect, this.config.cards), generated = {};
    if (!pool.length) return generated;
    for (let i = 0; i < effect.count; i++) {
      const key = pool[Math.floor(Math.random() * pool.length)];
      this.cards[key] = (this.cards[key] || 0) + 1;
      generated[key] = (generated[key] || 0) + 1;
    }
    this.emit("cardsGenerated", { cards: generated, count: effect.count });
    return generated;
  }
  applyUnitEffect(unit, effect) {
    if (effect.type === "stat")
      unit[effect.stat] =
        effect.mode === "multiply"
          ? unit[effect.stat] * effect.value
          : effect.mode === "percent"
            ? unit[effect.stat] * (1 + effect.value / 100)
            : unit[effect.stat] + effect.value;
    if (effect.type === "stat" && effect.stat === "critChance") unit.critChance = criticalChance(unit);
    if (effect.type === "stat" && effect.stat === "critDamage") unit.critDamage = criticalDamage(unit);
    if (effect.type === "stat" && effect.stat === "lifeSteal") unit.lifeSteal = Math.min(0.95, Math.max(0, unit.lifeSteal));
    if (effect.type === "lifesteal")
      unit.lifeSteal = Math.min(0.95, (unit.lifeSteal || 0) + effect.value);
    if (effect.type === "mitigation")
      unit.damageReduction =
        1 - (1 - (unit.damageReduction || 0)) * (1 - effect.value);
    if (effect.type === "weapon") {
      unit.weapon = effect.weapon;
      unit.range = Math.max(unit.range, effect.range);
    }
    if (effect.type === "splash") {
      unit.splash = effect.value;
      unit.splashRadius = effect.radius;
    }
  }
  rebuildHero(unit, preserveRatio = true) {
    const baseCard = this.config.cards[unit.cardId];
    const card = rankedHeroCard(baseCard, unit.level);
    if (!card?.unit) return;
    const previousRank = unit.rank;
    if (card.category === "hero") unit.rank = heroRank(baseCard, unit.level);
    const hp = unit.hp,
      ratio = hp / unit.maxHp;
    Object.assign(unit, card.unit, {
      combatBehavior: isHealer(card.unit) ? "heal" : "attack",
      healing: isHealer(card.unit) ? structuredClone(card.unit.healing || healingDefaults) : undefined,
      mechanics: structuredClone(card.unit.mechanics || {}),
      name: card.name,
      useIcon: card.useIcon,
      lifeSteal: 0,
      damageReduction: 0,
      splash: undefined,
      splashRadius: 1,
      critChance: card.unit.critChance ?? 0,
      critDamage: card.unit.critDamage ?? 200,
    });
    const growth = this.config.initial.levelGrowth;
    Object.assign(unit, attackProfile(card.unit));
    Object.assign(unit, levelStats(card.unit, unit.level, growth));
    const passive = (e) => !["level", "heal", "summon", "generateCard"].includes(e.type);
    for (const e of [
      ...card.effects.filter(passive),
      ...(unit.permanentEffects || []),
    ])
      this.applyUnitEffect(unit, e);
    for (const key of unit.equipment)
      for (const e of this.config.cards[key]?.effects || [])
        this.applyUnitEffect(unit, e);
    for (const e of [...(unit.triggerPermanentEffects || []), ...(unit.dayEffects || [])])
      if (this.heroTriggers.effectActive(e)) this.applyUnitEffect(unit, e);
    unit.maxHp = Math.max(1, unit.maxHp);
    unit.rate = Math.min(50, Math.max(0.05, unit.rate));
    unit.speed = Math.min(50, Math.max(0.05, unit.speed));
    unit.range = Math.min(24, Math.max(0, unit.range));
    unit.critChance = criticalChance(unit);
    unit.hp =
      hp <= 0
        ? 0
        : Math.min(
            unit.maxHp,
            preserveRatio ? Math.max(1, ratio * unit.maxHp) : hp,
          );
    if (!canMoveHero(this,unit)) { unit.path = []; unit.healingTargetId = null; }
    if (!canMoveHero(this,unit) || isHealer(unit)) unit.retaliationTargetId = null;
    if (card.category === "hero" && previousRank !== undefined && unit.rank > previousRank)
      this.emit("rankUp", { unit, from: previousRank, rank: unit.rank });
  }
  applyConfig(config) {
    const previous = this.config,
      oldDay = previous.days[this.day];
    this.config = config;
    const untouched =
      this.phase === "ready" && !this.heroes.length && !this.towers.length;
    this.baseHp = untouched
      ? config.initial.baseHp
      : (this.baseHp / this.baseMaxHp) * config.initial.baseHp;
    this.baseMaxHp = config.initial.baseHp;
    if (untouched) this.cards = { ...config.initial.cards };
    for (const key of Object.keys(this.cards))
      if (!config.cards[key]) delete this.cards[key];
    syncSkillCards(this);
    const mappedDay = config.days.findIndex((d) => d.id === oldDay?.id);
    if (mappedDay < 0) {
      this.reset();
      this.emit("config");
      this.emit("toast", { text: "当前关卡已删除，已返回路线起点" });
      return;
    }
    this.day = mappedDay >= 0 ? mappedDay : Math.min(this.day, config.days.length - 1);
    const nextDay = config.days[this.day];
    if (this.phase !== "shop" && nextDay.kind !== "shop") {
      this.syncMines(true);
      this.syncTerrain(true);
    }
    if (this.dayPlan) {
      const nextIndex = nextDay.waves.findIndex((w) => w.id === this.dayPlan.waves[this.wave]?.id);
      // Preserve this wave's issued orders; edits to later waves apply immediately.
      if (nextIndex >= 0 && nextDay.id === this.dayPlan.id) {
        this.dayPlan.waves = [...this.dayPlan.waves.slice(0, this.wave + 1), ...structuredClone(nextDay.waves.slice(nextIndex + 1))];
        this.dayPlan.rewardPool = nextDay.rewardPool;
        if (this.phase === "waiting") {
          this.dayPlan.waves[this.wave] = structuredClone(nextDay.waves[nextIndex]);
          this.waveWait = Math.max(0, (this.wave === 0 ? config.initial.firstWaveDelay : nextDay.waves[nextIndex].startDelay) - (this.time - this.waitStartedAt));
        }
      }
    }
    this.heroReserve = this.heroReserve.filter((h) => config.cards[h.cardId]?.category === "hero");
    for (const h of [...this.heroes, ...this.towers, ...this.heroReserve]) this.rebuildHero(h);
    for (const e of this.enemies) {
      const spec = config.enemies[e.enemyId];
      if (!spec) continue;
      const ratio = e.hp / e.maxHp,
        w = this.activeWave || this.currentWave();
      const stats = levelStats(spec, e.level || 1);
      Object.assign(e, spec, {
        ...attackProfile(spec),
        mechanics: structuredClone(spec.mechanics || {}),
        maxHp: Math.max(1, Math.round(stats.maxHp * w.hpScale)),
        atk: Math.round(stats.atk * w.atkScale),
      });
      e.hp = ratio <= 0 ? 0 : Math.max(1, e.maxHp * ratio);
    }
    if (this.phase === "reward" && this.rewardOptions.some(key => !config.cards[key]))
      this.rewardOptions = drawRewards(config, nextDay);
    if (this.phase === "route" && !this.nextDays().length) {
      this.phase = "won";
      this.emit("end", { won: true });
    }
    if (["ready", "between"].includes(this.phase) && nextDay.kind === "shop") enterShop(this);
    reconcileShop(this);
    this.emit("config");
  }
  chooseReward(indices) {
    if (
      this.phase !== "reward" ||
      !Array.isArray(indices) || indices.length !== 1 ||
      indices.some(i => !Number.isInteger(i) || !this.config.cards[this.rewardOptions[i]])
    )
      return false;
    const chosen = indices.map(i => this.rewardOptions[i]);
    for (const key of chosen) this.cards[key] = (this.cards[key] || 0) + 1;
    this.rewardOptions = [];
    this.emit("rewardChosen", { cards: chosen });
    this.completeNode();
    return true;
  }
  completeNode() {
    const currentId = this.config.days[this.day].id;
    if (!this.completedDays.includes(currentId)) this.completedDays.push(currentId);
    if (!this.nextDays().length) {
      this.phase = "won";
      this.emit("end", { won: true });
    } else {
      this.phase = "route";
      this.emit("route");
    }
  }
  refreshShop() { return refreshShop(this); }
  buyShopHero(index) { return buyShopHero(this, index); }
  buyShopPack(index) { return buyShopPack(this, index); }
  choosePackCard(index) { return choosePackCard(this, index); }
  leaveShop() {
    if (this.phase !== "shop" || this.shop.opening) return false;
    this.shop = null;
    this.completeNode();
    return true;
  }
  nextDays() {
    return nextDayIds(this.config, this.config.days[this.day].id)
      .filter((id) => this.config.days.some((d) => d.id === id) && !this.completedDays.includes(id));
  }
  chooseDay(id) {
    if (this.phase !== "route" || !this.nextDays().includes(id)) return false;
    this.clearTemporaryCards();
    this.removeFollowers();
    for (const hero of [...this.heroes, ...this.towers]) {
      hero.dayEffects = [];
      hero.path = [];
      hero.retaliationTargetId = null;
      this.rebuildHero(hero, false);
      hero.cooldown = hero.moveCooldown = 0;
    }
    this.selected = -1;
    this.selectedFollowerId = null;
    this.attacks = [];
    this.day = this.config.days.findIndex((d) => d.id === id);
    this.routeHistory.push(id);
    this.wave = 0;
    this.dayPlan = this.activeWave = null;
    this.spawned = 0;
    this.spawnQueues = [];
    this.phase = "between";
    this.shop = null;
    this.settlement = null;
    const revived = this.heroes.filter(hero => hero.hp <= 0);
    for (const hero of this.heroes) hero.hp = hero.maxHp;
    this.heroTriggers.syncSourceEffects();
    for (const hero of this.heroes) hero.hp = hero.maxHp;
    if (this.config.days[this.day].kind === "shop") enterShop(this);
    else {
      this.syncMines();
      this.syncTerrain(true);
    }
    for (const hero of revived) this.emit("revive", { unit: hero });
    this.emit("daySelected", { id });
    this.heroTriggers.prepare();
    return true;
  }
  dayNumber() {
    return (campaignLayout(this.config).nodes.find((node) => node.day.id === this.config.days[this.day].id)?.depth ?? this.day) + 1;
  }
  currentDay() { return this.dayPlan || this.config.days[this.day]; }
  currentWave() { return this.activeWave || this.currentDay().waves[this.wave]; }
  remainingEnemies() {
    if (this.phase === "battle") return this.enemies.filter((e) => e.hp > 0).length + this.spawnQueues.reduce((n, q) => n + q.types.length - q.spawned, 0);
    return ["shop", "victory", "reward", "route", "won", "lost"].includes(this.phase) ? 0 : waveCount(this.currentWave());
  }
  startDay() {
    if (!["ready", "between"].includes(this.phase)) return;
    if (!this.heroes.length) {
      this.emit("toast", { text: "先放置一位英雄" });
      return false;
    }
    this.dayPlan = structuredClone(this.config.days[this.day]);
    this.dayEnemySpecs = structuredClone(this.config.enemies);
    this.wave = 0;
    // Lock the start action before resolving effects; clicking again cannot replay it.
    this.phase = "waiting";
    this.heroTriggers.timers.clear();
    for (const hero of this.heroes) hero.hp = hero.maxHp;
    syncHeroMechanics(this);
    this.heroTriggers.syncSourceEffects();
    this.heroTriggers.start();
    // Start effects can increase maximum health; begin combat at the final maximum.
    for (const hero of this.heroes) hero.hp = hero.maxHp;
    this.emit("day", { day: this.dayNumber() });
    this.waitForWave(this.config.initial.firstWaveDelay);
  }
  waitForWave(delay) {
    this.phase = "waiting";
    this.activeWave = null;
    this.spawned = 0;
    this.spawnQueues = [];
    this.waveElapsed = 0;
    this.waveWait = delay;
    this.waitStartedAt = this.time;
    if (delay <= 0) this.beginWave();
  }
  beginWave() {
    this.phase = "battle";
    this.activeWave = structuredClone(this.dayPlan.waves[this.wave]);
    this.activeEnemySpecs = structuredClone({ ...this.dayEnemySpecs, ...this.config.enemies });
    this.waveWait = 0;
    this.waveElapsed = 0;
    this.spawnQueues = this.activeWave.spawns.map((p) => ({
      x: p.x, y: p.y, interval: p.interval, nextAt: p.delay, spawned: 0,
      types: p.enemies.flatMap((e) => Array(e.count).fill(e.type)),
      levels: p.enemies.flatMap((e) => Array(e.count).fill(e.level ?? 1)),
    }));
    this.emit("wave", { day: this.dayNumber(), wave: this.wave + 1 });
  }
  spawn(queue, voyage = null) {
    if (!queue || queue.spawned >= queue.types.length || (!voyage && this.blocked(queue.x, queue.y, null, true))) return false;
    const data = this.activeWave, enemyId = queue.types[queue.spawned];
    const spec = this.config.enemies[enemyId],
      scale = data.hpScale;
    // A live edit may remove a type from future config; retain active-wave specs.
    const definition = spec || this.activeEnemySpecs[enemyId];
    const level = queue.levels?.[queue.spawned] ?? 1;
    const stats = levelStats(definition, level);
    const e = {
      ...definition,
      ...attackProfile(definition),
      x: queue.x, y: queue.y,
      maxHp: Math.max(1, Math.round(stats.maxHp * scale)),
      atk: Math.round(stats.atk * data.atkScale),
      level,
      id: ++this.id,
      enemyId,
      side: "enemy",
      cooldown: 0.5,
      moveCooldown: 0,
      ...voyage,
    };
    e.hp = e.maxHp;
    this.enemies.push(e);
    this.spawned++;
    queue.spawned++;
    queue.nextAt = this.waveElapsed + queue.interval;
    this.emit("spawn", { unit: e });
    return true;
  }
  reviveHero(hero, effect, source) {
    if (!this.heroes.includes(hero) || hero.destroyed || hero.hp > 0) return false;
    const dayId = this.config.days[this.day].id;
    const used = hero.reviveUsage?.dayId === dayId ? hero.reviveUsage.used : 0;
    if (used >= effect.maxRevives) return false;
    let cell = { x: hero.x, y: hero.y };
    if (this.blocked(cell.x, cell.y, hero, true)) {
      const options = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++)
        if (!this.blocked(x, y, hero, true)) options.push({ x, y });
      options.sort((a, b) => gridDistance(a, hero) - gridDistance(b, hero));
      if (!options.length) return false;
      cell = options[0];
    }
    hero.reviveUsage = { dayId, used: used + 1 };
    Object.assign(hero, cell, { hp: 1, path: [], moveCooldown: 0, retaliationTargetId: null });
    // Restore source-bound max-health bonuses before calculating revival health.
    this.rebuildHero(hero, false);
    this.heroTriggers.syncSourceEffects();
    hero.hp = Math.max(1, Math.min(hero.maxHp, Math.ceil(hero.maxHp * effect.hpPercent / 100)));
    hero.cooldown = 1 / hero.rate;
    this.emit("revive", { unit: hero, source, fromEffect: true, used: used + 1, limit: effect.maxRevives });
    return true;
  }
  hit(target, damage, source, critical = false, kind = null, heroAttack = this.heroes.includes(source)) {
    if (damage <= 0) return;
    if (target === BASE) {
      this.baseHp = Math.max(0, this.baseHp - damage);
      this.emit("hit", { unit: BASE, damage, source, critical });
      return;
    }
    if (target.hp <= 0) return;
    rememberAttacker(this, target, source);
    damage = Math.max(
      1,
      Math.ceil(damage * (1 - (target.damageReduction || 0))),
    );
    const armor = target.mechanics?.arrowReduction;
    if (armor && source?.side === "enemy" && (kind || attackKind(source)) === "arrow") {
      damage = Math.max(0, Math.ceil(armor.mode === "percent" ? damage * (1 - armor.value / 100) : damage - armor.value));
      if (!damage) { this.emit("blocked", {unit:target,source}); return; }
    }
    const rangedArmor = target.side === "enemy" && target.mechanics?.rangedReduction;
    if (rangedArmor && heroAttack && ["arrow", "bullet", "orb"].includes(kind || attackKind(source))) {
      const incoming = damage;
      damage = Math.max(0, Math.ceil(rangedArmor.mode === "percent" ? damage * (1 - rangedArmor.value / 100) : damage - rangedArmor.value));
      if (damage < incoming) this.emit("blocked", { unit: target, source, amount: incoming - damage, damage, kind, mechanic: "rangedReduction" });
      if (!damage) return;
    }
    const actual = Math.min(target.hp, damage);
    target.hp = Math.max(0, target.hp - damage);
    if (target.hp <= 0 && this.heroes.includes(target)) {
      target.retaliationTargetId = null;
      this.heroTriggers.syncSourceEffects();
    }
    if (source?.lifeSteal && source.hp > 0) {
      const amount = Math.min(
        source.maxHp - source.hp,
        Math.ceil(actual * source.lifeSteal),
      );
      if (amount > 0) {
        source.hp += amount;
        this.emit("lifeSteal", { unit: source, amount });
      }
    }
    this.emit("hit", { unit: target, damage, source, critical });
    if (target.hp <= 0) {
      if (target.side === "enemy") {
        this.kills++;
      }
      this.emit("death", { unit: target, source });
      if (this.heroes.includes(target)) this.heroTriggers.resolve(target, "sacrifice");
      syncHeroMechanics(this);
    }
  }
  attack(source, target) {
    if (isDormant(this,source)) return;
    const duration = attackDuration(source, target);
    const chance = criticalChance(source);
    const critical = chance >= 100 || (chance > 0 && Math.random() * 100 < chance);
    const attack = {
      id: ++this.attackId,
      source,
      target,
      damage: source.atk * (critical ? criticalDamage(source) / 100 : 1),
      critical,
      splash: source.splash ?? getWeaponSpec(source)?.splash ?? 0,
      splashRadius: source.splashRadius ?? 1,
      kind: attackKind(source),
      heroAttack: this.heroes.includes(source),
      origin: {x:source.x,y:source.y},
      knockback: source.mechanics?.knockback?.distance || 0,
      duration,
      remaining: duration,
    };
    this.attacks.push(attack);
    this.emit("attack", attack);
  }
  resolveAttacks(dt) {
    const waiting = [];
    for (const attack of this.attacks) {
      attack.remaining -= dt;
      if (attack.remaining > 0) {
        waiting.push(attack);
        continue;
      }
      const { source, target, damage, splash } = attack;
      const missed = target === BASE ? this.baseHp <= 0 : target.hp <= 0;
      this.emit("impact", { ...attack, missed });
      if (missed) continue;
      this.hit(target, damage, source, attack.critical, attack.kind, attack.heroAttack);
      if (splash)
        for (const other of source.side === "enemy"
          ? [...this.heroes, ...this.followers, ...this.towers]
          : this.enemies) {
          if (
            other !== target &&
            other.hp > 0 &&
            dist(other, target) <= attack.splashRadius
          )
            this.hit(other, Math.round(damage * splash), source, attack.critical, attack.kind, attack.heroAttack);
        }
      if (source.side === "hero") knockback(this,target,attack.origin || source,attack.knockback);
    }
    this.attacks = waiting;
  }
  tick(dt) {
    syncHeroMechanics(this);
    this.heroTriggers.syncSourceEffects();
    if (this.phase === "victory") {
      const s = this.settlement;
      s.elapsed += dt;
      while (s.paid < s.coins.length && s.coins[s.paid].at <= s.elapsed) {
        const coin = s.coins[s.paid++];
        this.gold += coin.amount || 1;
        this.emit("gold", { ...coin, total: this.gold });
      }
      if (s.elapsed >= s.duration) {
        this.phase = "reward";
        this.rewardOptions = drawRewards(this.config, this.dayPlan);
        this.emit("clear", { day: this.dayNumber() });
      }
      return;
    }
    if (["shop", "won", "lost", "reward", "route"].includes(this.phase)) return;
    this.time += dt;
    for (const h of this.heroes) {
      if (!canMoveHero(this,h)) { h.path = []; continue; }
      h.moveCooldown -= dt;
      if (h.hp > 0 && h.path.length && h.moveCooldown <= 0) {
        const next = h.path[0];
        if (this.moveStep(h, next, { final: h.path.length === 1 })) h.path.shift();
        else {
          const route = this.path(h, h.path.at(-1), { units: true });
          if (route?.length) h.path = route;
          h.moveCooldown = .15;
        }
      }
    }
    moveFollowers(this, dt);
    this.heroTriggers.tick(dt);
    if (this.phase === "waiting") {
      this.waveWait = Math.max(0, this.waveWait - dt);
      if (this.waveWait > 1e-9) return;
      this.beginWave();
      // Wave-local clocks begin now, independently of the waiting period.
      dt = 0;
    }
    if (this.phase !== "battle") return;
    this.resolveAttacks(dt);
    this.waveElapsed += dt;
    for (const queue of this.spawnQueues)
      if (queue.spawned < queue.types.length && this.waveElapsed + 1e-9 >= queue.nextAt) launchBoat(this, queue);
    tickBoats(this, dt);
    for (const h of [...this.heroes, ...this.followers, ...this.towers]) {
      if (h.hp <= 0 || isDormant(this,h)) continue;
      h.cooldown -= dt;
      if (isHealer(h) && this.heroes.includes(h)) { tickHealer(this, h); continue; }
      const retaliationTarget = this.heroes.includes(h) ? tickRetaliation(this, h) : null;
      const targets = this.enemies
        .filter((e) => e.hp > 0 && gridDistance(h, e) <= h.range)
        .sort((a, b) => gridDistance(h, a) - gridDistance(h, b));
      if (h.cooldown <= 0 && targets.length) {
        const target = retaliationTarget || targets[0];
        h.cooldown = 1 / h.rate;
        this.attack(h, target);
      }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.cooldown -= dt;
      e.moveCooldown -=
        dt * (e.slowUntil > this.time ? 1 - (e.slowAmount ?? 0.55) : 1);
      const nearby = [...this.heroes, ...this.followers, ...this.towers, ...this.mines]
        .filter((h) => h.hp > 0 && gridDistance(e, h) <= e.range)
        .sort((a, b) => gridDistance(e, a) - gridDistance(e, b));
      const target = nearby[0] || (gridDistance(e, BASE) <= e.range ? BASE : null);
      if (target) {
        if (e.cooldown <= 0) {
          e.cooldown = 1 / e.rate;
          this.attack(e, target);
        }
      } else if (!e.boatId && e.moveCooldown <= 0) {
        const destinations = [BASE, ...this.mines.filter((m) => m.hp > 0)].map((goal) => ({ goal, path: this.path(e, goal, { adjacent: true }) })).filter((v) => v.path);
        destinations.sort((a, b) => a.path.length - b.path.length);
        const goal = destinations[0]?.goal || BASE;
        const p = this.path(e, goal, { adjacent: true, units: true });
        if (p?.length) {
          Object.assign(e, p[0]);
          e.moveCooldown = 1 / e.speed;
          this.emit("step", { unit: e });
        } else {
          const p2 = this.path(e, goal, { adjacent: true });
          if (p2?.length && !this.blocked(p2[0].x, p2[0].y, e, true)) {
            Object.assign(e, p2[0]);
            e.moveCooldown = 1 / e.speed;
            this.emit("step", { unit: e });
          } else e.moveCooldown = 0.3;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.boats = this.boats.filter(b => this.enemies.some(e => e.boatId === b.id));
    this.towers = this.towers.filter((t) => t.hp > 0);
    this.followers = this.followers.filter((u) => u.hp > 0);
    if (this.baseHp <= 0) {
      this.phase = "lost";
      this.clearTemporaryCards();
      this.attacks = [];
      this.emit("end", { won: false });
      return;
    }
    if (
      this.spawnQueues.every((q) => q.spawned === q.types.length) &&
      !this.enemies.length
    ) {
      // The final kill ends the wave, even if missed projectiles are still flying.
      this.attacks = [];
      if (this.wave + 1 === this.dayPlan.waves.length) {
        // Only actual survivors receive victory effects; recovery waits until the next day.
        this.phase = "victory";
        this.settlement = victoryPayout(this.mines);
        this.heroTriggers.victory();
        finishVictoryBonuses(this.settlement);
        this.clearTemporaryCards();
      }
      this.emit("waveClear", { day: this.dayNumber(), wave: this.wave + 1 });
      if (this.wave + 1 < this.dayPlan.waves.length) {
        this.wave++;
        this.waitForWave(this.dayPlan.waves[this.wave].startDelay);
      } else {
        this.emit("victory", { total: this.settlement.total });
      }
    }
  }

  snapshot() {
    return {
      obstacles: [...this.obstacles].map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y };
      }),
      phase: this.phase,
      gold: this.gold,
      mines: this.mines.map((m) => ({ ...m })),
      settlement: this.settlement ? { elapsed: this.settlement.elapsed, total: this.settlement.total, paid: this.settlement.paid } : null,
      day: this.dayNumber(),
      dayId: this.config.days[this.day].id,
      dayIndex: this.day,
      routeHistory: [...this.routeHistory],
      completedDays: [...this.completedDays],
      availableDays: this.phase === "route" ? this.nextDays() : [],
      wave: this.wave + 1,
      waveWait: this.waveWait,
      waveElapsed: this.waveElapsed,
      wavesInDay: this.currentDay().waves.length,
      remainingEnemies: this.remainingEnemies(),
      baseHp: this.baseHp,
      baseMaxHp: this.baseMaxHp,
      cards: { ...this.cards },
      skillCards: syncSkillCards(this).map(copy => ({ ...copy, remaining: Math.max(0, copy.readyAt - this.time) })),
      heroReserve: this.heroReserve.map((h) => ({ id: h.id, cardId: h.cardId, level: h.level, equipment: [...h.equipment] })),
      rewardOptions: [...this.rewardOptions],
      shop: this.shop ? { ...structuredClone(this.shop), prices: shopPrices(this) } : null,
      kills: this.kills,
      spawned: this.spawned,
      pendingAttacks: this.attacks.length,
      selected: this.selected,
      selectedFollowerId: this.selectedFollowerId,
      heroes: this.heroes.map((h) => ({
        ...h,
        equipment: [...h.equipment],
        path: h.path.map((p) => ({ ...p })),
      })),
      enemies: this.enemies.map((e) => ({ ...e })),
      boats: this.boats.map(b => ({ ...b, gate: { ...b.gate }, members: [...b.members] })),
      followers: this.followers.map((u) => ({ ...u, equipment: [], path: u.path.map(p => ({ ...p })), followTrail: u.followTrail.map(p => ({ ...p })) })),
      towers: this.towers.map((t) => ({ ...t })),
    };
  }
}
