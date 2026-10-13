import { obstacleKeys, reachableTerrain } from "./terrain.js";
import { MINE_HP, victoryPayout } from "./gold.js";
import { criticalChance } from "./critical.js";
import { presetById } from "./hero-presets.js";
import { effectAmount } from "./effect-values.js";
import { generationPool } from "./card-generation.js";
import { drawRewards } from "./rewards.js";
import { resourceTargets, applyResourceEffect } from "./resource-effects.js";
import { getWeaponSpec } from "./weapons.js";
import { getConfig, subscribeConfig } from "./config/store.js";
import { cardRadius } from "./config/schema.js";
import { waveCount } from "./config/migrate.js";
import { HeroTriggers } from "./hero-triggers.js";
import { levelStats } from "./level-stats.js";
import { startDayId, nextDayIds, campaignLayout } from "./campaign.js";
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
export const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const attackKind = (unit) =>
  getWeaponSpec(unit)?.kind || presetById[unit.type]?.melee || (unit.type === "blue" ? "slash" : "claw");
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
    this.rewardOptions = [];
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
    this.phase = "ready";
    this.baseMaxHp = this.config.initial.baseHp;
    this.baseHp = this.baseMaxHp;
    this.selected = 0;
    this.enemies = [];
    this.towers = [];
    this.spawned = 0;
    this.attacks = [];
    this.attackId = 0;
    this.heroes = [];
    this.heroReserve = [];
    this.heroTriggers = new HeroTriggers(this);
    this.obstacles = new Set();
    this.syncMines();
    this.syncTerrain();
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
    const towerCells = this.towers.filter((u) => u.hp > 0).map((u) => `${u.x},${u.y}`);
    const previousRoutes = reachableTerrain(new Set([...blocked, ...towerCells]));
    if (!force && next.size === this.obstacles.size && [...next].every((key) => this.obstacles.has(key)) && [...gates].every((key) => previousRoutes.has(key))) return;
    const reachable = reachableTerrain(blocked);
    const units = [...this.heroes, ...this.towers, ...this.enemies].filter((u) => u.hp > 0);
    const affected = units.filter((u) => next.has(`${u.x},${u.y}`) || !reachable.has(`${u.x},${u.y}`));
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
  blocked(x, y, ignore, units = false) {
    return (
      !inside(x, y) ||
      this.obstacles.has(`${x},${y}`) ||
      this.mines.some((m) => m.hp > 0 && m !== ignore && m.x === x && m.y === y) ||
      (x === 7 && y === 5) ||
      this.towers.some(
        (t) => t.hp > 0 && t !== ignore && t.x === x && t.y === y,
      ) ||
      (units &&
        [...this.heroes, ...this.enemies].some(
          (u) => u !== ignore && u.hp > 0 && u.x === x && u.y === y,
        ))
    );
  }
  reachableCells(unit) {
    if (!this.heroes.includes(unit) || unit.hp <= 0) return [];
    const queue = [{ x: unit.x, y: unit.y }];
    const seen = new Set([`${unit.x},${unit.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const x = c.x + dx, y = c.y + dy, key = `${x},${y}`;
        if (seen.has(key) || this.blocked(x, y, unit, true)) continue;
        seen.add(key);
        queue.push({ x, y });
      }
    }
    return queue.slice(1);
  }
  path(start, end, { adjacent = false, units = false } = {}) {
    const queue = [{ x: start.x, y: start.y, path: [] }],
      seen = new Set([`${start.x},${start.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (adjacent ? dist(c, end) <= 1 : dist(c, end) === 0) return c.path;
      const next = [
        [c.x, c.y - 1],
        [c.x + 1, c.y],
        [c.x, c.y + 1],
        [c.x - 1, c.y],
      ].sort(
        (a, b) =>
          Math.abs(a[0] - end.x) +
          Math.abs(a[1] - end.y) -
          (Math.abs(b[0] - end.x) + Math.abs(b[1] - end.y)),
      );
      for (const [x, y] of next) {
        const key = `${x},${y}`;
        if (seen.has(key) || this.blocked(x, y, start, units)) continue;
        seen.add(key);
        queue.push({ x, y, path: [...c.path, { x, y }] });
      }
    }
    return null;
  }
  move(x, y) {
    const h = this.heroes[this.selected];
    if (!h) return this.emit("toast", { text: "先拖入一张英雄牌" });
    if (h.hp <= 0)
      return this.emit("toast", { text: "英雄休整中，下一波将自动归队" });
    if (this.blocked(x, y, h, true))
      return this.emit("toast", { text: "这里无法落脚，换一块空地吧" });
    const p = this.path(h, { x, y }, { units: true });
    if (!p) return this.emit("toast", { text: "道路被挡住了，试试另一条路" });
    h.path = p;
    this.emit("move", { unit: h });
  }
  select(i) {
    if (!this.heroes[i]) return;
    this.selected = i;
    this.emit("select");
  }
  cardTarget(key, x, y) {
    const card = this.config.cards[key];
    if (!card || !(this.cards[key] > 0))
      return { valid: false, reason: "没有这张牌了" };
    if (!["ready", "waiting", "battle", "between"].includes(this.phase))
      return { valid: false, reason: "现在不能出牌" };
    if (!inside(x, y)) return { valid: false, reason: "拖到战场内使用" };
    const hero = this.heroes.find((h) => h.hp > 0 && h.x === x && h.y === y);
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
  playCard(key, x, y) {
    const check = this.cardTarget(key, x, y);
    if (!check.valid) {
      this.emit("toast", { text: check.reason });
      return false;
    }
    const card = this.config.cards[key];
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
        level: card.category === "hero" ? 1 : 0,
        cooldown: 0,
        moveCooldown: 0,
        path: [],
        side: "hero",
        equipment: [],
        permanentEffects: [],
        dayEffects: [],
        triggerPermanentEffects: [],
      };
      Object.assign(unit, { x, y, home: { x, y }, cooldown: 0, moveCooldown: 0, path: [], dayEffects: [] });
      hero = unit;
      this.rebuildHero(unit, returning);
      if (!returning) unit.hp = unit.maxHp;
      else if (unit.hp <= 0) unit.hp = Math.max(1, unit.maxHp * this.config.initial.reviveHp);
      if (card.category === "hero") {
        this.heroes.push(unit);
        this.selected = this.heroes.length - 1;
        this.emit("deploy", { unit });
      } else {
        this.towers.push(unit);
        if (
          this.currentDay().waves
            .flatMap((w) => w.spawns)
            .some((g) => !this.path(g, BASE, { adjacent: true }))
        ) {
          this.towers.pop();
          this.emit("toast", { text: "需要保留通向核心的道路" });
          return false;
        }
        this.emit("build", { unit });
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
    this.cards[key]--;
    if (this.cards[key] === 0) delete this.cards[key];
    this.emit("cardPlayed", { card: key, x, y });
    return true;
  }
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
    const card = this.config.cards[unit.cardId];
    if (!card?.unit) return;
    const hp = unit.hp,
      ratio = hp / unit.maxHp;
    Object.assign(unit, card.unit, {
      name: card.name,
      useIcon: card.useIcon,
      lifeSteal: 0,
      damageReduction: 0,
      splash: undefined,
      splashRadius: 1,
      critChance: card.unit.critChance ?? 0,
    });
    const growth = this.config.initial.levelGrowth;
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
      this.applyUnitEffect(unit, e);
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
    const mappedDay = config.days.findIndex((d) => d.id === oldDay?.id);
    if (mappedDay < 0) {
      this.reset();
      this.emit("config");
      this.emit("toast", { text: "当前关卡已删除，已返回路线起点" });
      return;
    }
    this.day = mappedDay >= 0 ? mappedDay : Math.min(this.day, config.days.length - 1);
    const nextDay = config.days[this.day];
    this.syncMines(true);
    this.syncTerrain(true);
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
    this.emit("config");
  }
  chooseReward(indices) {
    if (
      this.phase !== "reward" ||
      !Array.isArray(indices) || indices.length !== 2 || new Set(indices).size !== 2 ||
      indices.some(i => !Number.isInteger(i) || !this.config.cards[this.rewardOptions[i]])
    )
      return false;
    const chosen = indices.map(i => this.rewardOptions[i]);
    for (const key of chosen) this.cards[key] = (this.cards[key] || 0) + 1;
    this.rewardOptions = [];
    this.emit("rewardChosen", { cards: chosen });
    const currentId = this.config.days[this.day].id;
    if (!this.completedDays.includes(currentId)) this.completedDays.push(currentId);
    if (!this.nextDays().length) {
      this.phase = "won";
      this.emit("end", { won: true });
    } else {
      this.phase = "route";
      this.emit("route");
    }
    return true;
  }
  nextDays() {
    return nextDayIds(this.config, this.config.days[this.day].id)
      .filter((id) => this.config.days.some((d) => d.id === id) && !this.completedDays.includes(id));
  }
  chooseDay(id) {
    if (this.phase !== "route" || !this.nextDays().includes(id)) return false;
    const recalledIds = this.heroes.map((h) => h.id);
    for (const hero of this.heroes) {
      hero.dayEffects = [];
      hero.path = [];
      this.rebuildHero(hero, false);
      if (this.config.cards[hero.cardId]?.category !== "hero") continue;
      this.heroReserve.push(hero);
      this.cards[hero.cardId] = (this.cards[hero.cardId] || 0) + 1;
    }
    this.heroReserve.sort((a, b) => b.level - a.level || a.id - b.id);
    this.heroes = [];
    this.selected = -1;
    this.attacks = [];
    this.day = this.config.days.findIndex((d) => d.id === id);
    this.routeHistory.push(id);
    this.wave = 0;
    this.dayPlan = this.activeWave = null;
    this.spawned = 0;
    this.spawnQueues = [];
    this.phase = "between";
    this.settlement = null;
    this.syncMines();
    this.syncTerrain(true);
    this.emit("daySelected", { id, recalledIds });
    return true;
  }
  dayNumber() {
    return (campaignLayout(this.config).nodes.find((node) => node.day.id === this.config.days[this.day].id)?.depth ?? this.day) + 1;
  }
  currentDay() { return this.dayPlan || this.config.days[this.day]; }
  currentWave() { return this.activeWave || this.currentDay().waves[this.wave]; }
  remainingEnemies() {
    if (this.phase === "battle") return this.enemies.filter((e) => e.hp > 0).length + this.spawnQueues.reduce((n, q) => n + q.types.length - q.spawned, 0);
    return ["victory", "reward", "route", "won", "lost"].includes(this.phase) ? 0 : waveCount(this.currentWave());
  }
  startDay() {
    if (!["ready", "between"].includes(this.phase)) return;
    if (!this.heroes.some((h) => h.hp > 0)) {
      this.emit("toast", { text: "先放置一位英雄" });
      return false;
    }
    this.dayPlan = structuredClone(this.config.days[this.day]);
    this.dayEnemySpecs = structuredClone(this.config.enemies);
    this.wave = 0;
    // Lock the start action before resolving effects; clicking again cannot replay it.
    this.phase = "waiting";
    this.heroTriggers.start();
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
  spawn(queue) {
    if (!queue || queue.spawned >= queue.types.length || this.blocked(queue.x, queue.y, null, true)) return false;
    const data = this.activeWave, enemyId = queue.types[queue.spawned];
    const spec = this.config.enemies[enemyId],
      scale = data.hpScale;
    // A live edit may remove a type from future config; retain active-wave specs.
    const definition = spec || this.activeEnemySpecs[enemyId];
    const level = queue.levels?.[queue.spawned] ?? 1;
    const stats = levelStats(definition, level);
    const e = {
      ...definition,
      x: queue.x, y: queue.y,
      maxHp: Math.max(1, Math.round(stats.maxHp * scale)),
      atk: Math.round(stats.atk * data.atkScale),
      level,
      id: ++this.id,
      enemyId,
      side: "enemy",
      cooldown: 0.5,
      moveCooldown: 0,
    };
    e.hp = e.maxHp;
    this.enemies.push(e);
    this.spawned++;
    queue.spawned++;
    queue.nextAt = this.waveElapsed + queue.interval;
    this.emit("spawn", { unit: e });
    return true;
  }
  hit(target, damage, source, critical = false) {
    if (damage <= 0) return;
    if (target === BASE) {
      this.baseHp = Math.max(0, this.baseHp - damage);
      this.emit("hit", { unit: BASE, damage, source, critical });
      return;
    }
    if (target.hp <= 0) return;
    damage = Math.max(
      1,
      Math.ceil(damage * (1 - (target.damageReduction || 0))),
    );
    const actual = Math.min(target.hp, damage);
    target.hp = Math.max(0, target.hp - damage);
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
    }
  }
  attack(source, target) {
    const duration = attackDuration(source, target);
    const chance = criticalChance(source);
    const critical = chance >= 100 || (chance > 0 && Math.random() * 100 < chance);
    const attack = {
      id: ++this.attackId,
      source,
      target,
      damage: source.atk * (critical ? 2 : 1),
      critical,
      splash: source.splash ?? getWeaponSpec(source)?.splash ?? 0,
      splashRadius: source.splashRadius ?? 1,
      kind: attackKind(source),
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
      this.hit(target, damage, source, attack.critical);
      if (splash)
        for (const other of source.side === "enemy"
          ? [...this.heroes, ...this.towers]
          : this.enemies) {
          if (
            other !== target &&
            other.hp > 0 &&
            dist(other, target) <= attack.splashRadius
          )
            this.hit(other, Math.round(damage * splash), source, attack.critical);
        }
    }
    this.attacks = waiting;
  }
  tick(dt) {
    if (this.phase === "victory") {
      const s = this.settlement;
      s.elapsed += dt;
      while (s.paid < s.coins.length && s.coins[s.paid].at <= s.elapsed) {
        const coin = s.coins[s.paid++];
        this.gold++;
        this.emit("gold", { ...coin, total: this.gold });
      }
      if (s.elapsed >= s.duration) {
        this.phase = "reward";
        this.rewardOptions = drawRewards(this.config, this.dayPlan);
        this.emit("clear", { day: this.dayNumber() });
      }
      return;
    }
    if (["won", "lost", "reward", "route"].includes(this.phase)) return;
    this.time += dt;
    for (const h of this.heroes) {
      h.moveCooldown -= dt;
      if (h.hp > 0 && h.path.length && h.moveCooldown <= 0) {
        const next = h.path[0];
        if (!this.blocked(next.x, next.y, h, true)) {
          Object.assign(h, h.path.shift());
          h.moveCooldown = 1 / h.speed;
          this.emit("step", { unit: h });
        } else h.path = [];
      }
    }
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
      if (queue.spawned < queue.types.length && this.waveElapsed + 1e-9 >= queue.nextAt) this.spawn(queue);
    for (const h of [...this.heroes, ...this.towers]) {
      if (h.hp <= 0) continue;
      h.cooldown -= dt;
      const targets = this.enemies
        .filter((e) => e.hp > 0 && dist(h, e) <= h.range)
        .sort((a, b) => dist(h, a) - dist(h, b));
      if (h.cooldown <= 0 && targets.length) {
        const target = targets[0];
        h.cooldown = 1 / h.rate;
        this.attack(h, target);
      }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.cooldown -= dt;
      e.moveCooldown -=
        dt * (e.slowUntil > this.time ? 1 - (e.slowAmount ?? 0.55) : 1);
      const nearby = [...this.heroes, ...this.towers, ...this.mines]
        .filter((h) => h.hp > 0 && dist(e, h) <= e.range)
        .sort((a, b) => dist(e, a) - dist(e, b));
      const target = nearby[0] || (dist(e, BASE) <= e.range ? BASE : null);
      if (target) {
        if (e.cooldown <= 0) {
          e.cooldown = 1 / e.rate;
          this.attack(e, target);
        }
      } else if (e.moveCooldown <= 0) {
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
    this.towers = this.towers.filter((t) => t.hp > 0);
    if (this.baseHp <= 0) {
      this.phase = "lost";
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
      for (const h of this.heroes) {
        const dead = h.hp <= 0;
        h.hp = Math.min(
          h.maxHp,
          h.hp +
            h.maxHp *
              (dead
                ? this.config.initial.reviveHp
                : this.config.initial.waveHeal),
        );
        if (dead) {
          const spawn = h.home || BASE,
            options = [];
          for (let y = 1; y < H - 1; y++)
            for (let x = 1; x < W - 1; x++)
              if (!this.blocked(x, y, h, true)) options.push({ x, y });
          options.sort((a, b) => dist(a, spawn) - dist(b, spawn));
          if (options.length) Object.assign(h, options[0]);
          h.path = [];
          this.emit("revive", { unit: h });
        }
      }
      this.emit("waveClear", { day: this.dayNumber(), wave: this.wave + 1 });
      if (this.wave + 1 < this.dayPlan.waves.length) {
        this.wave++;
        this.waitForWave(this.dayPlan.waves[this.wave].startDelay);
      } else {
        for (const hero of this.heroes) {
          hero.dayEffects = [];
          this.rebuildHero(hero, false);
        }
        this.phase = "victory";
        this.settlement = victoryPayout(this.mines);
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
      heroReserve: this.heroReserve.map((h) => ({ id: h.id, cardId: h.cardId, level: h.level, equipment: [...h.equipment] })),
      rewardOptions: [...this.rewardOptions],
      kills: this.kills,
      spawned: this.spawned,
      pendingAttacks: this.attacks.length,
      selected: this.selected,
      heroes: this.heroes.map((h) => ({
        ...h,
        equipment: [...h.equipment],
        path: h.path.map((p) => ({ ...p })),
      })),
      enemies: this.enemies.map((e) => ({ ...e })),
      towers: this.towers.map((t) => ({ ...t })),
    };
  }
}
