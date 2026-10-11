import { obstacles } from "./art.js";
import { getWeaponSpec } from "./weapons.js";
import { getConfig, subscribeConfig } from "./config/store.js";
import { cardRadius } from "./config/schema.js";
import { waveCount } from "./config/migrate.js";
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
  getWeaponSpec(unit)?.kind || (unit.type === "blue" ? "slash" : "claw");
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
    this.time = 0;
    this.cards = { ...this.config.initial.cards };
    this.rewardOptions = [];
    this.kills = 0;
    this.wave = 0;
    this.day = 0;
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
    this.emit("reset");
  }
  blocked(x, y, ignore, units = false) {
    return (
      !inside(x, y) ||
      obstacles.has(`${x},${y}`) ||
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
    if (card.target === "ground") {
      if (x < 1 || x > 13 || y < 1 || y > 9 || this.blocked(x, y, null, true))
        return { valid: false, reason: "需要一块内部空地" };
      if (card.effects.some((e) => e.type === "summon") &&
        [...this.config.days.flatMap((d) => d.waves), ...(this.dayPlan?.waves || [])]
          .some((w) => w.spawns.some((p) => p.x === x && p.y === y)))
        return { valid: false, reason: "敌方出生点不能放置炮台" };
    } else if (card.target === "hero") {
      if (!hero) return { valid: false, reason: "拖到我方英雄身上" };
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
    if (deploying) {
      const unit = {
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
      };
      hero = unit;
      this.rebuildHero(unit, false);
      unit.hp = unit.maxHp;
      if (card.category === "hero") {
        this.heroes.push(unit);
        this.selected = this.heroes.length - 1;
        this.emit("deploy", { unit });
      } else {
        this.towers.push(unit);
        if (
          [...this.config.days.flatMap((d) => d.waves), ...(this.dayPlan?.waves || [])]
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
          if (effect.type === "damage") this.hit(enemy, effect.value, source);
          if (effect.type === "slow") {
            enemy.slowUntil = Math.max(
              enemy.slowUntil || 0,
              this.time + effect.duration,
            );
            enemy.slowAmount = effect.value;
          }
        }
      this.enemies = this.enemies.filter((e) => e.hp > 0);
    } else if (hero) {
      for (const effect of card.effects) {
        if (effect.type === "summon") continue;
        if (effect.type === "level") {
          hero.level += effect.value;
          this.rebuildHero(hero, false);
          hero.hp = Math.min(
            hero.maxHp,
            hero.hp + this.config.initial.levelGrowth.heal * effect.value,
          );
          this.emit("upgrade", { unit: hero, useIcon: card.useIcon });
        } else if (effect.type === "heal") {
          const amount = Math.min(effect.value, hero.maxHp - hero.hp);
          hero.hp += amount;
          this.emit("heal", { unit: hero, amount, useIcon: card.useIcon });
        } else if (!deploying) {
          if (card.category === "resource")
            hero.permanentEffects.push(structuredClone(effect));
          this.applyUnitEffect(hero, effect);
        }
      }
    }
    this.cards[key]--;
    if (this.cards[key] === 0) delete this.cards[key];
    this.emit("cardPlayed", { card: key, x, y });
    return true;
  }
  applyUnitEffect(unit, effect) {
    if (effect.type === "stat")
      unit[effect.stat] =
        effect.mode === "multiply"
          ? unit[effect.stat] * effect.value
          : unit[effect.stat] + effect.value;
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
    });
    const growth = this.config.initial.levelGrowth,
      levels = Math.max(0, unit.level - 1);
    for (const key of ["maxHp", "atk", "rate"])
      unit[key] += growth[key] * levels;
    const passive = (e) => !["level", "heal", "summon"].includes(e.type);
    for (const e of [
      ...card.effects.filter(passive),
      ...(unit.permanentEffects || []),
    ])
      this.applyUnitEffect(unit, e);
    for (const key of unit.equipment)
      for (const e of this.config.cards[key]?.effects || [])
        this.applyUnitEffect(unit, e);
    unit.maxHp = Math.max(1, unit.maxHp);
    unit.rate = Math.min(50, Math.max(0.05, unit.rate));
    unit.speed = Math.min(50, Math.max(0.05, unit.speed));
    unit.range = Math.min(24, Math.max(0, unit.range));
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
    this.day = mappedDay >= 0 ? mappedDay : Math.min(this.day, config.days.length - 1);
    const nextDay = config.days[this.day];
    if (this.dayPlan) {
      const nextIndex = nextDay.waves.findIndex((w) => w.id === this.dayPlan.waves[this.wave]?.id);
      // Preserve this wave's issued orders; edits to later waves apply immediately.
      if (nextIndex >= 0 && nextDay.id === this.dayPlan.id) {
        this.dayPlan.waves = [...this.dayPlan.waves.slice(0, this.wave + 1), ...structuredClone(nextDay.waves.slice(nextIndex + 1))];
        this.dayPlan.rewards = structuredClone(nextDay.rewards);
        if (this.phase === "waiting") {
          this.dayPlan.waves[this.wave] = structuredClone(nextDay.waves[nextIndex]);
          this.waveWait = Math.max(0, (this.wave === 0 ? config.initial.firstWaveDelay : nextDay.waves[nextIndex].startDelay) - (this.time - this.waitStartedAt));
        }
      }
    }
    for (const h of [...this.heroes, ...this.towers]) this.rebuildHero(h);
    for (const e of this.enemies) {
      const spec = config.enemies[e.enemyId];
      if (!spec) continue;
      const ratio = e.hp / e.maxHp,
        w = this.activeWave || this.currentWave();
      Object.assign(e, spec, {
        maxHp: Math.max(1, Math.round(spec.maxHp * w.hpScale)),
        atk: Math.round(spec.atk * w.atkScale),
      });
      e.hp = ratio <= 0 ? 0 : Math.max(1, e.maxHp * ratio);
    }
    if (this.phase === "reward")
      this.rewardOptions = structuredClone(nextDay.rewards);
    this.emit("config");
  }
  chooseReward(index) {
    if (
      this.phase !== "reward" ||
      !Number.isInteger(index) ||
      !this.rewardOptions[index]
    )
      return false;
    const pack = this.rewardOptions[index];
    for (const [key, count] of Object.entries(pack.cards))
      this.cards[key] = (this.cards[key] || 0) + count;
    this.rewardOptions = [];
    this.emit("rewardChosen", { name: pack.name });
    if (this.day === this.config.days.length - 1) {
      this.phase = "won";
      this.emit("end", { won: true });
    } else {
      this.day++;
      this.wave = 0;
      this.dayPlan = this.activeWave = null;
      this.spawned = 0;
      this.spawnQueues = [];
      this.phase = "between";
    }
    return true;
  }
  currentDay() { return this.dayPlan || this.config.days[this.day]; }
  currentWave() { return this.activeWave || this.currentDay().waves[this.wave]; }
  remainingEnemies() {
    if (this.phase === "battle") return this.enemies.filter((e) => e.hp > 0).length + this.spawnQueues.reduce((n, q) => n + q.types.length - q.spawned, 0);
    return ["reward", "won", "lost"].includes(this.phase) ? 0 : waveCount(this.currentWave());
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
    this.emit("day", { day: this.day + 1 });
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
    }));
    this.emit("wave", { day: this.day + 1, wave: this.wave + 1 });
  }
  spawn(queue) {
    if (!queue || queue.spawned >= queue.types.length || this.blocked(queue.x, queue.y, null, true)) return false;
    const data = this.activeWave, enemyId = queue.types[queue.spawned];
    const spec = this.config.enemies[enemyId],
      scale = data.hpScale;
    // A live edit may remove a type from future config; retain active-wave specs.
    const definition = spec || this.activeEnemySpecs[enemyId];
    const e = {
      ...definition,
      x: queue.x, y: queue.y,
      maxHp: Math.max(1, Math.round(definition.maxHp * scale)),
      atk: Math.round(definition.atk * data.atkScale),
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
  hit(target, damage, source) {
    if (damage <= 0) return;
    if (target === BASE) {
      this.baseHp = Math.max(0, this.baseHp - damage);
      this.emit("hit", { unit: BASE, damage, source });
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
    this.emit("hit", { unit: target, damage, source });
    if (target.hp <= 0) {
      if (target.side === "enemy") {
        this.kills++;
      }
      this.emit("death", { unit: target, source });
    }
  }
  attack(source, target) {
    const duration = attackDuration(source, target);
    const attack = {
      id: ++this.attackId,
      source,
      target,
      damage: source.atk,
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
      this.hit(target, damage, source);
      if (splash)
        for (const other of source.side === "enemy"
          ? [...this.heroes, ...this.towers]
          : this.enemies) {
          if (
            other !== target &&
            other.hp > 0 &&
            dist(other, target) <= attack.splashRadius
          )
            this.hit(other, Math.round(damage * splash), source);
        }
    }
    this.attacks = waiting;
  }
  tick(dt) {
    if (["won", "lost", "reward"].includes(this.phase)) return;
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
      const nearby = [...this.heroes, ...this.towers]
        .filter((h) => h.hp > 0 && dist(e, h) <= e.range)
        .sort((a, b) => dist(e, a) - dist(e, b));
      const target = nearby[0] || (dist(e, BASE) <= e.range ? BASE : null);
      if (target) {
        if (e.cooldown <= 0) {
          e.cooldown = 1 / e.rate;
          this.attack(e, target);
        }
      } else if (e.moveCooldown <= 0) {
        const p = this.path(e, BASE, { adjacent: true, units: true });
        if (p?.length) {
          Object.assign(e, p[0]);
          e.moveCooldown = 1 / e.speed;
          this.emit("step", { unit: e });
        } else {
          const p2 = this.path(e, BASE, { adjacent: true });
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
      this.emit("waveClear", { day: this.day + 1, wave: this.wave + 1 });
      if (this.wave + 1 < this.dayPlan.waves.length) {
        this.wave++;
        this.waitForWave(this.dayPlan.waves[this.wave].startDelay);
      } else {
        this.phase = "reward";
        this.rewardOptions = structuredClone(this.dayPlan.rewards);
        this.emit("clear", { day: this.day + 1 });
      }
    }
  }

  snapshot() {
    return {
      phase: this.phase,
      day: this.day + 1,
      wave: this.wave + 1,
      waveWait: this.waveWait,
      waveElapsed: this.waveElapsed,
      wavesInDay: this.currentDay().waves.length,
      remainingEnemies: this.remainingEnemies(),
      baseHp: this.baseHp,
      baseMaxHp: this.baseMaxHp,
      cards: { ...this.cards },
      rewardOptions: this.rewardOptions.map((p) => ({
        ...p,
        cards: { ...p.cards },
      })),
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
