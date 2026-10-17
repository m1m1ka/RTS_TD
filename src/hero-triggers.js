import { effectAmount } from "./effect-values.js";
import { addVictoryBonus, deathCountsAsSacrifice } from "./hero-mechanics.js";
import { randomStatLabels } from "./config/trigger-rules.js";
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const inRange = (a, b, radius) => radius < 0 || distance(a, b) <= radius;

export class HeroTriggers {
  constructor(game) { this.game = game; this.activations = 0; this.activeSources = new Set(); this.timers = new Map(); }
  cardListeners() {
    return this.game.heroes.filter(h => h.hp > 0 && !h.destroyed && !h.isFollower)
      .map(hero => ({ hero, rules: this.rules(hero, "cardPlayed") }));
  }
  cardPlayed(key, listeners) {
    const category = this.game.config.cards[key]?.category;
    const playedCard = { key, category, refunded: false };
    for (const { hero, rules } of listeners) {
      if (hero.hp <= 0 || hero.destroyed || this.game.isDormant(hero)) continue;
      hero.cardPlayCounts ??= {};
      const active = new Set(rules.map((rule, i) => `${i}:${JSON.stringify(rule)}`));
      for (const counter of Object.keys(hero.cardPlayCounts)) if (!active.has(counter)) delete hero.cardPlayCounts[counter];
      for (const [i, rule] of rules.entries()) {
        const filter = rule.trigger.category || "all";
        if (filter !== "all" && !(filter === "resourceBattle" ? ["resource", "battle"].includes(category) : filter === category)) continue;
        const counter = `${i}:${JSON.stringify(rule)}`;
        const count = (hero.cardPlayCounts[counter] || 0) + 1;
        const every = rule.trigger.every ?? 1;
        hero.cardPlayCounts[counter] = count % every;
        if (count >= every) this.resolve(hero, "cardPlayed", { rules: [rule], playedCard });
      }
    }
  }
  tick(dt) {
    const game = this.game;
    if (!["waiting", "battle"].includes(game.phase) || !(dt > 0)) return;
    const active = new Set();
    for (const hero of [...game.heroes]) {
      if (hero.hp <= 0 || hero.destroyed || hero.isFollower) continue;
      for (const [i, rule] of this.rules(hero, "interval").entries()) {
        const key = `${hero.id}:${i}:${JSON.stringify(rule)}`;
        active.add(key);
        let elapsed = (this.timers.get(key) || 0) + dt;
        const interval = rule.trigger.interval;
        if (!(interval >= .1)) continue;
        while (elapsed + 1e-9 >= interval && hero.hp > 0 && !hero.destroyed) {
          elapsed = Math.max(0, elapsed - interval);
          this.resolve(hero, "interval", { rules: [rule] });
        }
        this.timers.set(key, elapsed);
      }
    }
    for (const key of this.timers.keys()) if (!active.has(key)) this.timers.delete(key);
  }
  towerBuilt(tower) {
    for (const hero of [...this.game.heroes]) {
      if (hero.hp <= 0 || hero.destroyed || hero.isFollower) continue;
      const rules = this.rules(hero, "towerBuilt").filter(rule => inRange(hero, tower, rule.trigger.radius));
      if (rules.length) this.resolve(hero, "towerBuilt", { rules, eventHero: tower });
    }
  }
  effectActive(effect) {
    return !effect.whileSourceAlive || this.game.heroes.some(h => h.id === effect.sourceHeroId && h.hp > 0 && !h.destroyed);
  }
  syncSourceEffects() {
    const game = this.game;
    const active = new Set(game.heroes.filter(h => h.hp > 0 && !h.destroyed).map(h => h.id));
    if (active.size === this.activeSources.size && [...active].every(id => this.activeSources.has(id))) return;
    this.activeSources = active;
    // Rebuild from base stats and equipment, rather than subtracting capped or multiplied bonuses.
    for (const hero of [...game.heroes, ...game.heroReserve, ...game.towers])
      if ([...(hero.dayEffects || []), ...(hero.triggerPermanentEffects || [])].some(e => e.whileSourceAlive))
        game.rebuildHero(hero, false);
  }
  prepare(heroes = this.game.heroes) {
    const game = this.game;
    if (!["ready", "between"].includes(game.phase) || game.currentDay().kind === "shop") return;
    const dayId = game.currentDay().id;
    for (const hero of [...heroes]) {
      if (hero.hp <= 0 || hero.destroyed || hero.isFollower || hero.preparedDayId === dayId) continue;
      hero.preparedDayId = dayId;
      this.resolve(hero, "preparation");
    }
  }
  rules(hero, event) {
    if (this.game.isDormant(hero)) return [];
    return (this.game.config.cards[hero.cardId]?.triggerRules || [])
      .filter((rule) => rule.enabled && rule.trigger.event === event);
  }
  targets(owner, eventHero, target, deathEvent = false, fallenOnly = false) {
    if (target.kind === "eventTower") return !fallenOnly && this.game.towers.includes(eventHero) && eventHero.hp > 0 && inRange(owner, eventHero, target.radius) ? [eventHero] : [];
    const allies = this.game.heroes.filter((h) => (fallenOnly ? h.hp <= 0 : h.hp > 0) && !h.destroyed && inRange(owner, h, target.radius));
    const nearby = allies.filter((h) => h !== owner)
      .sort((a, b) => distance(owner, a) - distance(owner, b) || a.id - b.id);
    if (target.kind === "self") return [owner];
    if (target.kind === "eventHero") return allies.includes(eventHero) || (deathEvent && eventHero === owner) ? [eventHero] : [];
    if (target.kind === "allAllies") return allies;
    if (target.kind === "alliesWithFollowers") return allies.filter(h =>
      this.game.followers.some(f => f.ownerId === h.id && f.hp > 0 && !f.destroyed));
    if (target.kind === "randomAllies") {
      // Sample without replacement; one rule's payloads share this selection.
      const count = Math.min(target.count, allies.length);
      for (let i = 0; i < count; i++) {
        const j = i + Math.floor(Math.random() * (allies.length - i));
        [allies[i], allies[j]] = [allies[j], allies[i]];
      }
      return allies.slice(0, count);
    }
    const nearest = nearby.slice(0, target.count);
    return target.kind === "selfAndNearest" ? [owner, ...nearest] : nearest;
  }
  start(heroes = this.game.heroes) {
    const game = this.game;
    const before = new Map(game.heroes.map((h) => [h.id, { rate: h.rate, speed: h.speed }]));
    this.activations = 0;
    for (const hero of [...heroes]) this.resolve(hero, "battleStart");
    for (const hero of game.heroes) {
      const old = before.get(hero.id);
      if (old && (hero.rate !== old.rate || hero.speed !== old.speed))
        game.emit("battleBuff", { unit: hero, rate: hero.rate - old.rate, speed: hero.speed - old.speed });
    }
  }
  victory() {
    // Snapshot before end-of-wave revival: only actual survivors can respond.
    const survivors = this.game.heroes.filter(h => h.hp > 0 && !h.destroyed);
    for (const hero of survivors) this.resolve(hero, "victory");
  }
  resolve(hero, event, options = {}) {
    const game = this.game;
    const convertedDeath = event === "sacrifice" && deathCountsAsSacrifice(game,hero);
    if (event === "sacrifice") for (const key of this.timers.keys())
      if (key.startsWith(`${hero.id}:`)) this.timers.delete(key);
    this.syncSourceEffects();
    // Each root owns a shared, typed queue: cross-event echoes cannot recurse.
    // Natural preparation is separate from the one extra preparation allowance.
    const cascade = {
      playedCard: options.playedCard,
      queued: new Set(event === "battleStart" ? [`${event}:${hero.id}`] : []),
      queue: [{ hero, event, extra: false, rules: options.rules, eventHero: options.eventHero }],
    };
    for (let i = 0; i < cascade.queue.length; i++) {
      const { hero: current, event: currentEvent, extra, rules: specifiedRules, eventHero = current } = cascade.queue[i];
      const deathEvent = currentEvent === "sacrifice";
      if (!game.heroes.includes(current) || (deathEvent ? current.hp > 0 : current.hp <= 0 || current.destroyed)) continue;
      const rules = specifiedRules || this.rules(current, currentEvent);
      if (!rules.length && !(deathEvent && convertedDeath)) continue;
      const eventPosition = { x: current.x, y: current.y };
      if (currentEvent === "battleStart") this.activations++;
      for (const rule of rules) this.run(current, eventHero, rule, cascade, deathEvent);
      const eventType = { interval: "heroInterval", towerBuilt: "heroTowerBuilt", preparation: "heroPreparation", battleStart: "heroBattleStart", sacrifice: "heroSacrifice", victory: "heroVictory" }[currentEvent];
      game.emit(eventType || "heroCardPlayed", { unit: current, extra });
      const listenerEvent = currentEvent === "battleStart" ? "heroBattleStart" : deathEvent ? "heroSacrifice" : null;
      if (!listenerEvent) continue;
      // Listener effects share the queue and never implicitly emit an activation.
      for (const listener of game.heroes.filter(h => h.hp > 0 && !h.destroyed))
        for (const rule of this.rules(listener, listenerEvent)) {
          const filter = rule.trigger;
          if (filter.scope === "self" && listener !== current) continue;
          if (filter.scope === "others" && listener === current) continue;
          if (!inRange(listener, deathEvent ? eventPosition : current, filter.radius)) continue;
          this.run(listener, current, rule, cascade);
        }
    }
  }
  run(owner, eventHero, rule, cascade, deathEvent = false) {
    const game = this.game, targets = this.targets(owner, eventHero, rule.target, deathEvent);
    for (const effect of rule.effects) {
      if (effect.type === "refundCard") {
        const played = cascade.playedCard;
        if (played && !played.refunded && ["resource", "battle"].includes(played.category)
          && effect.chance > 0 && (effect.chance >= 100 || Math.random() * 100 < effect.chance)) {
          played.refunded = true;
          game.cards[played.key] = (game.cards[played.key] || 0) + 1;
          game.emit("cardRefunded", { card: played.key, unit: owner });
        }
        continue;
      }
      if (effect.type === "victoryGold") {
        if (game.phase === "victory" && game.settlement) addVictoryBonus(game.settlement,owner,effect.value);
        continue;
      }
      if (effect.type === "revive") {
        for (const target of this.targets(owner, eventHero, rule.target, deathEvent, true))
          if (game.reviveHero(target, effect, owner))
            game.emit("triggerEffect", { unit: target, source: owner, rule: rule.name, effect });
        continue;
      }
      if (effect.type === "generateCard") {
        game.generateCards(effect);
        game.emit("triggerEffect", { unit: owner, source: owner, rule: rule.name, effect });
        continue;
      }
      const levelAmount = effect.type === "ownerLevel" ? Math.floor(owner.level * effect.percent / 100) : effect.value;
      for (const target of targets) {
        if (effect.type === "triggerBattleStart" || effect.type === "triggerPreparation") {
          const event = effect.type === "triggerPreparation" ? "preparation" : "battleStart";
          const key = `${event}:${target.id}`;
          if (!cascade.queued.has(key)) {
            cascade.queued.add(key);
            cascade.queue.push({ hero: target, event, extra: true });
          }
          continue;
        }
        if (effect.type === "summonFollower") {
          game.summonFollowers(target, effect);
        } else if (effect.type === "level" || effect.type === "ownerLevel") {
          const amount = levelAmount;
          if (amount <= 0) continue;
          target.level = Math.max(1, target.level) + amount;
          game.rebuildHero(target, false);
          if (target.hp > 0) target.hp = Math.min(target.maxHp, target.hp + game.config.initial.levelGrowth.heal * amount);
          game.emit("upgrade", { unit: target });
        } else if (effect.type === "heal") {
          if (target.hp <= 0 || target.destroyed) continue;
          const amount = Math.min(target.maxHp - target.hp, effectAmount(effect, target));
          target.hp += amount;
          if (amount > 0) game.emit("heal", { unit: target, amount });
        } else if (effect.type === "randomStat") {
          const stats = Object.keys(randomStatLabels);
          const stat = stats[Math.floor(Math.random() * stats.length)];
          const value = effect[stat];
          const amount = stat === "lifeSteal" ? value / 100 : value;
          const stored = target.triggerPermanentEffects.at(-1);
          if (stored?.randomGrowth && stored.stat === stat) stored.value += amount;
          else target.triggerPermanentEffects.push({ type: "stat", stat, mode: "add", value: amount, duration: "permanent", randomGrowth: true });
          game.rebuildHero(target, false);
          game.emit("randomStatGained", { unit: target, stat, value });
        } else if (effect.type === "stat") {
          const bucket = effect.duration === "day" ? target.dayEffects : target.triggerPermanentEffects;
          bucket.push({ ...structuredClone(effect), ...(effect.whileSourceAlive ? { sourceHeroId: owner.id } : {}) });
          game.rebuildHero(target, false);
        }
        game.emit("triggerEffect", { unit: target, source: owner, rule: rule.name, effect });
      }
    }
  }
}
