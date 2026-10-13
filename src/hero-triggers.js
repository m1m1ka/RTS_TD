import { effectAmount } from "./effect-values.js";
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const inRange = (a, b, radius) => radius < 0 || distance(a, b) <= radius;

export class HeroTriggers {
  constructor(game) { this.game = game; }
  rules(hero, event) {
    return (this.game.config.cards[hero.cardId]?.triggerRules || [])
      .filter((rule) => rule.enabled && rule.trigger.event === event);
  }
  targets(owner, eventHero, target) {
    const allies = this.game.heroes.filter((h) => h.hp > 0 && inRange(owner, h, target.radius));
    const nearby = allies.filter((h) => h !== owner)
      .sort((a, b) => distance(owner, a) - distance(owner, b) || a.id - b.id);
    if (target.kind === "self") return [owner];
    if (target.kind === "eventHero") return allies.includes(eventHero) ? [eventHero] : [];
    if (target.kind === "allAllies") return allies;
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
    // Each normal activation gets its own cascade. Each hero may activate once
    // per cascade, allowing extra activations without circular/branching loops.
    for (const hero of [...heroes].filter((h) => h.hp > 0)) {
      const cascade = { visited: new Set(), queue: [hero] };
      for (let i = 0; i < cascade.queue.length; i++) {
        const current = cascade.queue[i];
        if (current.hp <= 0 || cascade.visited.has(current.id)) continue;
        cascade.visited.add(current.id);
        const rules = this.rules(current, "battleStart");
        if (!rules.length) continue;
        this.activations++;
        for (const rule of rules) this.run(current, current, rule, cascade);
        game.emit("heroBattleStart", { unit: current, extra: i > 0 });
        // Listener effects never implicitly emit another activation event.
        for (const listener of game.heroes.filter((h) => h.hp > 0))
          for (const rule of this.rules(listener, "heroBattleStart")) {
            const filter = rule.trigger;
            if (filter.scope === "self" && listener !== current) continue;
            if (filter.scope === "others" && listener === current) continue;
            if (!inRange(listener, current, filter.radius)) continue;
            this.run(listener, current, rule, cascade);
          }
      }
    }
    for (const hero of game.heroes) {
      const old = before.get(hero.id);
      if (old && (hero.rate !== old.rate || hero.speed !== old.speed))
        game.emit("battleBuff", { unit: hero, rate: hero.rate - old.rate, speed: hero.speed - old.speed });
    }
  }
  run(owner, eventHero, rule, cascade) {
    const game = this.game, targets = this.targets(owner, eventHero, rule.target);
    for (const effect of rule.effects) {
      if (effect.type === "generateCard") {
        game.generateCards(effect);
        game.emit("triggerEffect", { unit: owner, source: owner, rule: rule.name, effect });
        continue;
      }
      for (const target of targets) {
        if (effect.type === "triggerBattleStart") {
          if (!cascade.visited.has(target.id) && !cascade.queue.includes(target))
            cascade.queue.push(target);
          continue;
        }
        if (effect.type === "level") {
          target.level += effect.value;
          game.rebuildHero(target, false);
          target.hp = Math.min(target.maxHp, target.hp + game.config.initial.levelGrowth.heal * effect.value);
          game.emit("upgrade", { unit: target });
        } else if (effect.type === "heal") {
          const amount = Math.min(target.maxHp - target.hp, effectAmount(effect, target));
          target.hp += amount;
          if (amount > 0) game.emit("heal", { unit: target, amount });
        } else if (effect.type === "stat") {
          const bucket = effect.duration === "day" ? target.dayEffects : target.triggerPermanentEffects;
          bucket.push(structuredClone(effect));
          game.rebuildHero(target, false);
        }
        game.emit("triggerEffect", { unit: target, source: owner, rule: rule.name, effect });
      }
    }
  }
}
