import * as THREE from "three";
import { getWeaponSpec } from "./weapons.js";
import { createCombatTextures } from "./vfx-art.js";
import { bloodStainMaterial, freezeBloodStain, BLOOD_SPREAD_DURATION } from "./blood-stain.js";

export class CombatVFX {
  constructor(scene, positionOf, renderer = null) {
    this.scene = scene;
    this.positionOf = positionOf;
    this.renderer = renderer;
    this.textures = createCombatTextures();
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.flights = new Map();
    this.effects = [];
    this.stains = new Map();
    this.lastDeathSpray = null;
    this.counts = {
      arrow: 0,
      slash: 0,
      orb: 0,
      coffee: 0,
      bullet: 0,
      claw: 0,
      shield: 0,
      upgrades: 0,
      impacts: 0,
      heals: 0,
      healTargets: 0,
      bloodHits: 0,
      bloodDeaths: 0,
      deployments: 0,
      footsteps: 0,
    };
  }
  mesh(kind, width, height = width) {
    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        map: this.textures[kind] || this.textures.square,
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.scale.set(width, height, 1);
    mesh.position.z = 3;
    this.scene.add(mesh);
    return mesh;
  }
  dispose(mesh) {
    this.scene.remove(mesh);
    mesh.material.dispose();
  }
  effect(kind, point, size, duration, animate) {
    if (this.effects.length >= 260) {
      const old = this.effects.shift();
      old.cleanup?.();
      this.dispose(old.mesh);
    }
    const mesh = this.mesh(kind, size);
    mesh.position.copy(point);
    mesh.position.z = 3.1;
    const effect = { kind, mesh, age: 0, duration, size, animate };
    this.effects.push(effect);
    return effect;
  }
  burst(unit, color, count = 7) {
    const point = this.positionOf(unit).clone();
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2, size = .045 + Math.random() * .06;
      const f = this.effect("square", point, size, .45, (f, t) => {
        f.mesh.position.set(point.x + Math.cos(angle) * t * .65, point.y + Math.sin(angle) * t * .65, 3);
        f.mesh.scale.setScalar(size * (1 - t * .65));
        f.mesh.material.opacity = 1 - t;
      });
      f.mesh.material.color.set(color);
    }
  }
  dust(unit, stepping = false) {
    this.counts[stepping ? "footsteps" : "deployments"]++;
    const point = this.positionOf(unit).clone();
    const count = stepping ? 3 : 10, duration = stepping ? .42 : .7;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1, size = (stepping ? .045 : .075) + Math.random() * .055;
      const reach = (stepping ? .13 : .35) + Math.random() * (stepping ? .12 : .4);
      const offset = (Math.random() - .5) * (stepping ? .22 : .5);
      const lift = stepping ? .04 + Math.random() * .06 : .1 + Math.random() * .3;
      const ground = -.54 + Math.random() * .08;
      const f = this.effect(stepping ? "stepDust" : "deployDust", point, size, duration, (f, t) => {
        f.mesh.position.set(point.x + offset + side * reach * (1 - (1 - t) ** 3), point.y + ground + Math.sin(t * Math.PI) * lift - t * .04, 1.4);
        f.mesh.scale.setScalar(size * (1 + t * .7));
        f.mesh.material.opacity = (stepping ? .5 : .85) * (1 - t) ** 1.3;
      });
      f.mesh.material.color.set("#ffffff");
      f.animate(f, 0);
    }
  }
  heal(source, target) {
    this.counts.heals++;
    const from = this.positionOf(source).clone(), to = this.positionOf(target).clone();
    this.effect("healing", from, .36, .5, (f, t) => {
      f.mesh.position.lerpVectors(from, to, Math.min(1, t * 1.5));
      f.mesh.position.y += Math.sin(Math.min(1, t * 1.5) * Math.PI) * .35;
      f.mesh.position.z = 3.3;
      f.mesh.material.opacity = Math.min(1, (1 - t) * 4);
      f.mesh.scale.setScalar(.32 + .16 * Math.sin(t * Math.PI));
    });
    this.healTarget(target);
  }
  healTarget(target) {
    this.counts.healTargets++;
    const existing = this.effects.find(f => f.kind === "healingTarget" && f.unit === target);
    if (existing) {
      existing.age = 0;
      existing.animate(existing, 0);
      return;
    }
    const crosses = [-1, 0, 1].map(side => ({ mesh: this.mesh("healingCross", .28), side }));
    const effect = this.effect("healingTarget", this.positionOf(target), 1, .8, (f, t) => {
      const point = this.positionOf(target);
      const fade = Math.min(1, (1 - t) * 3);
      f.mesh.position.set(point.x, point.y - .3, 2.8);
      f.mesh.scale.setScalar(.72 + t * .25);
      f.mesh.material.opacity = fade * .85;
      for (const { mesh, side } of crosses) {
        const phase = Math.max(0, Math.min(1, (t - Math.abs(side) * .09) / .82));
        mesh.position.set(point.x + side * (.3 + phase * .12), point.y - .1 + phase * .85, 3.4);
        mesh.scale.setScalar(.25 + Math.sin(phase * Math.PI) * .12);
        mesh.material.opacity = Math.sin(phase * Math.PI) * .95;
      }
    });
    effect.unit = target;
    effect.cleanup = () => crosses.forEach(({ mesh }) => this.dispose(mesh));
    effect.animate(effect, 0);
  }
  upgrade(unit) {
    this.counts.upgrades++;
    // Echoes can level the same hero more than once in a single start event.
    const existing = this.effects.find((f) => f.kind === "upgrade" && f.unit === unit);
    if (existing) {
      existing.age = 0;
      existing.animate(existing, 0);
      return;
    }
    const glow = this.mesh("upgradeGlow", 1.6);
    const arrow = this.mesh("upgradeArrow", .9, 1.8);
    const beams = [-.34, 0, .34].map((x, i) => ({
      mesh: this.mesh("upgradeBeam", .24, .96), x, delay: i * .055,
    }));
    const stars = Array.from({length: 10}, (_, i) => ({
      mesh: this.mesh("upgradeStar", .2), side: i % 2 ? 1 : -1, delay: i * .035,
      size: [.22, .16, .12][i % 3], x: .42 + (i % 3) * .12,
    }));
    const orbit = Array.from({length: 12}, () => this.mesh("square", .055));
    const squarePoint = p => { const edge = Math.floor(p * 4), t = p * 4 - edge; return [[-1 + 2*t,-1],[1,-1 + 2*t],[1 - 2*t,1],[-1,1 - 2*t]][edge]; };
    const effect = this.effect("upgrade", this.positionOf(unit), 1, 0.9, (f, t) => {
      const point = this.positionOf(unit);
      const expand = 1 - Math.pow(1 - Math.min(1, t / 0.35), 3);
      const fade = Math.min(1, (1 - t) / 0.55);
      f.mesh.position.set(point.x, point.y - 0.38, 1.04);
      f.mesh.scale.setScalar(.6 + expand * .5 + t * .2);
      f.mesh.material.opacity = fade * .65;
      glow.position.set(point.x, point.y - .15, 1.02);
      glow.scale.setScalar(1.1 + expand * 0.6);
      glow.material.opacity = Math.sin(Math.PI * Math.min(1, t / 0.8)) * 0.75;
      for (const beam of beams) {
        const p = Math.max(0, Math.min(1, (t - beam.delay) / 0.65));
        const height = .5 + Math.sin(p * Math.PI) * 1.3;
        beam.mesh.position.set(point.x + beam.x, point.y - .4 + height / 2, 1.05);
        beam.mesh.scale.set(height / 4, height, 1);
        beam.mesh.material.opacity = Math.sin(p * Math.PI) * .9;
      }
      const rise = Math.min(1, t / .7);
      arrow.position.set(point.x, point.y + .35 + rise * .85, 3.22);
      arrow.scale.set(.76 + expand * .12, 1.52 + expand * .24, 1);
      arrow.material.opacity = Math.min(1, t * 12, (1 - t) * 4);
      for (const [i, mesh] of orbit.entries()) {
        const [x,y] = squarePoint((i / orbit.length + t * .9) % 1);
        mesh.position.set(point.x + x * .65, point.y + y * .65 + t * .3, y > 0 ? 1.03 : 3.25);
        mesh.material.color.set(i % 3 ? "#ffd066" : "#fff9df");
        mesh.material.opacity = Math.min(1, t * 10) * fade;
      }
      for (const star of stars) {
        const p = Math.max(0, Math.min(1, (t - star.delay) / 0.65));
        star.mesh.position.set(point.x + star.side * (star.x + Math.sin(p * Math.PI) * 0.12), point.y - 0.28 + p * 1.05, 3.25);
        star.mesh.scale.setScalar(star.size * Math.sin(p * Math.PI) ** 0.6);
        star.mesh.rotation.z = 0;
        star.mesh.material.opacity = Math.min(1, p * 10, (1 - p) * 5);
      }
    });
    effect.cleanup = () => {
      for (const mesh of [glow, arrow, ...orbit, ...beams.map((b) => b.mesh), ...stars.map((s) => s.mesh)]) this.dispose(mesh);
    };
    effect.unit = unit;
    effect.animate(effect, 0);
  }
  shield(unit) {
    this.counts.shield++;
    this.effect("shield", this.positionOf(unit), 1.45, 0.5, (f, t) => {
      f.mesh.position.copy(this.positionOf(unit));
      f.mesh.position.z = 2.8;
      f.mesh.scale.setScalar(1.3 + Math.sin(t * Math.PI) * 0.22);
      f.mesh.material.opacity = (1 - t) * 0.72;
      f.mesh.rotation.z = Math.sin(t * 8) * 0.035;
    });
  }
  castCard(card, x, y, radius) {
    const point = this.positionOf({ x, y });
    const color =
      card === "fireball"
        ? "#efac63"
        : card === "frost"
          ? "#9ce9ef"
          : "#f6edac";
    this.counts.cardCasts = (this.counts.cardCasts || 0) + 1;
    const ring = this.effect("ring", point, 1, 0.65, (f, t) => {
      f.mesh.scale.setScalar(0.5 + t * (radius * 2 + 1.2));
      f.mesh.material.opacity = (1 - t) * 0.9;
      f.mesh.rotation.z = t;
    });
    ring.mesh.material.color.set(color);
    if (card === "lightning") {
      for (let i = 0; i < 20; i++) {
        const fx = this.effect("square", point, .15, .35, (f, t) => {
          f.mesh.position.set(point.x + (i < 9 ? 0 : i < 14 ? .15 : -.15), point.y + i * .15, 3.2);
          f.mesh.scale.setScalar(.15 * (1 - t * .4));
          f.mesh.material.opacity = 1 - t;
        });
        fx.mesh.material.color.set(i % 3 ? "#fff3c1" : "#e9b34d");
      }
    }
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const shard = this.effect(
        card === "fireball" ? "orb" : "spark",
        point,
        0.3,
        0.55,
        (f, t) => {
          f.mesh.position.x = point.x + Math.cos(angle) * t * (radius + 0.6);
          f.mesh.position.y = point.y + Math.sin(angle) * t * (radius + 0.6);
          f.mesh.scale.setScalar(0.35 * (1 - t));
          f.mesh.material.opacity = 1 - t;
        },
      );
      shard.mesh.material.color.set(color);
    }
  }
  attack(attack) {
    const { kind, id, source, target, duration } = attack;
    this.counts[kind]++;
    const from = attack.muzzle
        ? attack.muzzle.clone()
        : this.positionOf(source).clone(),
      to = this.positionOf(target).clone();
    from.z = to.z = 3.2;
    const direction = to.clone().sub(from),
      angle = Math.atan2(direction.y, direction.x),
      distance = direction.length();
    direction.normalize();
    if (kind === "slash") {
      const center = from
        .clone()
        .addScaledVector(direction, Math.min(1, distance * 0.52));
      this.effect(
        "slash",
        center,
        Math.max(1.25, distance * 1.03),
        0.3,
        (f, t) => {
          f.mesh.rotation.z = angle - 0.65 + t * 1.35;
          f.mesh.material.opacity = Math.sin(Math.PI * Math.min(1, t * 1.15));
          f.mesh.scale.set(f.size * (0.65 + t * 0.5), f.size * .84, 1);
        },
      );
      this.effect(
        "sword",
        from.clone().addScaledVector(direction, 0.48),
        0.95,
        0.24,
        (f, t) => {
          f.mesh.rotation.z = angle - 1.05 + t * 1.9;
          f.mesh.material.opacity = 1 - t * t;
        },
      );
    } else if (kind === "claw") {
      this.effect("claw", to, 0.95, 0.26, (f, t) => {
        f.mesh.rotation.z = angle - 0.5;
        f.mesh.scale.setScalar(0.6 + t * 0.65);
        f.mesh.material.opacity = Math.sin(Math.PI * t);
      });
    } else {
      const mesh = this.mesh(
        kind,
        kind === "arrow" ? 0.82 : kind === "orb" ? 0.7 : 0.48,
        kind === "arrow" ? 0.205 : kind === "orb" ? 0.7 : 0.48,
      );
      if (!attack.muzzle) from.addScaledVector(direction, 0.28);
      mesh.position.copy(from);
      mesh.rotation.z = angle;
      this.flights.set(id, {
        mesh,
        from,
        target,
        duration,
        age: 0,
        kind,
        trail: 0,
      });
      if (kind === "orb") {
        this.shield(source);
        this.effect("ring", from, 1.2, 0.45, (f, t) => {
          f.mesh.rotation.z = t * 1.6;
          f.mesh.scale.setScalar(0.6 + t * 0.9);
          f.mesh.material.opacity = (1 - t) * 0.8;
        });
      }
      if (kind === "bullet") this.effect("spark", from, .45, .14, (f, t) => {
        f.mesh.rotation.z = angle;
        f.mesh.scale.setScalar(.25 + t * .32);
        f.mesh.material.opacity = 1 - t;
      });
    }
  }
  land(attack) {
    const flight = this.flights.get(attack.id);
    if (flight) {
      this.dispose(flight.mesh);
      this.flights.delete(attack.id);
    }
    if (attack.missed) return;
    if (attack.kind === "orb")
      this.effect("ring", this.positionOf(attack.target), 1.7, 0.42, (f, t) => {
        f.mesh.scale.setScalar(0.6 + t * 2.4);
        f.mesh.rotation.z = t * 0.8;
        f.mesh.material.opacity = (1 - t) * 0.85;
      });
  }
  hit(unit, source) {
    this.counts.impacts++;
    if (unit.side === "enemy") {
      // The death event supplies the killing blow's effect; do not stack two bursts.
      if (!(unit.hp <= 0)) this.bloodSpray(unit, source, false);
      return;
    }
    const point = this.positionOf(unit).clone();
    point.z = 3.4;
    const direction = source
      ? point.clone().sub(this.positionOf(source)).setZ(0).normalize()
      : new THREE.Vector3(0, 1, 0);
    const angle = Math.atan2(direction.y, direction.x);
    this.effect("spark", point, 0.66, 0.21, (f, t) => {
      f.mesh.scale.setScalar(0.32 + Math.sin(t * Math.PI) * 0.48);
      f.mesh.rotation.z = angle + t * 0.4;
      f.mesh.material.opacity = 1 - t;
    });
    for (let i = 0; i < 5; i++) {
      const a = angle + (i - 2) * 0.65,
        speed = 0.6 + Math.random() * 1.3;
      const shard = this.effect(
        "spark",
        point,
        0.09 + Math.random() * 0.06,
        0.3 + Math.random() * 0.15,
        (f, t) => {
          f.mesh.position.x += Math.cos(a) * speed * f.dt;
          f.mesh.position.y += (Math.sin(a) * speed - 0.7 * t) * f.dt;
          f.mesh.material.opacity = 1 - t;
          f.mesh.rotation.z += f.dt * 8;
        },
      );
      shard.mesh.material.color.set(
        getWeaponSpec(source)?.kind === "orb"
          ? "#d8baff"
          : unit.side === "hero"
            ? "#ffd6b7"
            : "#fff3b9",
      );
    }
    if (getWeaponSpec(unit)?.kind === "orb") this.shield(unit);
  }
  bloodSpray(unit, source, death) {
    this.counts[death ? "bloodDeaths" : "bloodHits"]++;
    const point = this.positionOf(unit).clone();
    point.z = 3.3;
    const direction = new THREE.Vector2(
      source ? unit.x - source.x : 0,
      source ? source.y - unit.y : 1,
    );
    if (direction.lengthSq() < 0.001) direction.set(0, 1);
    direction.normalize();
    const angle = Math.atan2(direction.y, direction.x);
    this.effect(
      "bloodSplash",
      point,
      death ? 0.9 : 0.68,
      death ? 0.34 : 0.26,
      (f, t) => {
        f.mesh.rotation.z = angle;
        f.mesh.scale.setScalar(
          f.size * (0.55 + Math.sin(t * Math.PI * 0.75) * 0.4),
        );
        f.mesh.material.opacity = Math.min(0.7, (1 - t) * 1.3);
        f.mesh.position.x = point.x + direction.x * t * 0.12;
        f.mesh.position.y = point.y + direction.y * t * 0.12;
      },
    );
    if (death) {
      this.lastDeathSpray = {
        x: unit.x,
        y: unit.y,
        dx: direction.x,
        dy: direction.y,
      };
      this.effect("bloodJet", point, 0.95, 0.32, (f, t) => {
        const reach = 0.3 + Math.sin((Math.min(1, t * 2) * Math.PI) / 2) * 0.55;
        f.mesh.rotation.z = angle;
        f.mesh.scale.setScalar(.7 * reach);
        f.mesh.position.x = point.x + direction.x * 0.32 * reach;
        f.mesh.position.y = point.y + direction.y * 0.32 * reach;
        f.mesh.material.opacity = Math.min(0.5, (1 - t) * 1.2);
      });
    }
    const count = death ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * (death ? 1.25 : 2),
        speed = death ? 1.5 + Math.random() * 1.4 : 0.9 + Math.random() * 1.1;
      const duration = death
          ? 0.32 + Math.random() * 0.14
          : 0.23 + Math.random() * 0.12,
        size = death ? 0.1 + Math.random() * 0.08 : 0.07 + Math.random() * 0.06;
      this.effect("bloodDrop", point, size, duration, (f, t) => {
        const travel = speed * duration * (t - 0.35 * t * t);
        f.mesh.position.x = point.x + Math.cos(a) * travel;
        f.mesh.position.y = point.y + Math.sin(a) * travel - 0.22 * t * t;
        f.mesh.rotation.z = a;
        f.mesh.scale.setScalar(size * (1.25 - t * .5));
        f.mesh.material.opacity = Math.min(0.78, (1 - t) * 1.8);
      });
    }
  }
  stampBlood(unit, source) {
    if (unit.boatId || unit.x < 0 || unit.x > 14 || unit.y < 0 || unit.y > 10) return;
    const key = unit.x + "," + unit.y;
    const previous = this.stains.get(key);
    const direction = new THREE.Vector2(source ? unit.x - source.x : 0, source ? source.y - unit.y : 1).normalize();
    const deaths = (previous?.deaths || 0) + 1;
    // Distribute fresh pools around the cell, gradually reaching its edges.
    // The old stain never moves, changes its seed or restarts its animation.
    const angle = deaths * 2.399963 + Math.random() * .4;
    const radius = previous ? .07 + .1 * Math.min(1, (deaths - 1) / 6) : 0;
    const offset = new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(radius);
    const mesh = new THREE.Mesh(this.geometry, bloodStainMaterial(direction, offset));
    mesh.scale.setScalar(1.5);
    mesh.position.set(unit.x - 7, 5 - unit.y, 0.045 + (previous ? Math.min(deaths, 10000) * .000001 : 0));
    this.scene.add(mesh);
    if (previous) {
      previous.deaths = deaths;
      previous.pending.push({ mesh, age: 0 });
    } else this.stains.set(key, { mesh, age: 0, x: unit.x, y: unit.y, deaths, pending: [] });
  }
  death(unit, source) {
    if (unit.side === "enemy") {
      this.bloodSpray(unit, source, true);
      this.stampBlood(unit, source);
      return;
    }
    this.effect("dust", this.positionOf(unit), 1.2, 0.5, (f, t) => {
      f.mesh.scale.setScalar(0.7 + t * 1.3);
      f.mesh.material.opacity = 1 - t;
    });
  }
  update(dt) {
    if (dt <= 0) return;
    for (const stain of this.stains.values()) {
      for (const layer of [stain, ...stain.pending]) {
        if (layer.age >= BLOOD_SPREAD_DURATION) continue;
        layer.age = Math.min(BLOOD_SPREAD_DURATION, layer.age + dt);
        layer.mesh.material.uniforms.age.value = layer.age;
      }
      const settled = stain.pending.filter(layer => layer.age === BLOOD_SPREAD_DURATION);
      if (stain.age === BLOOD_SPREAD_DURATION && this.renderer && (!stain.frozen || settled.length)) {
        const oldTarget = stain.target;
        stain.target = freezeBloodStain(stain.mesh, this.renderer, settled.map(layer => layer.mesh));
        oldTarget?.dispose();
        for (const layer of settled) this.dispose(layer.mesh);
        stain.pending = stain.pending.filter(layer => layer.age < BLOOD_SPREAD_DURATION);
        stain.frozen = true;
      }
    }
    for (const [id, f] of this.flights) {
      f.age += dt;
      f.trail += dt;
      const t = Math.min(1, f.age / f.duration),
        to = this.positionOf(f.target).clone();
      to.z = 3.2;
      f.mesh.position.lerpVectors(f.from, to, t);
      if (!["arrow", "bullet"].includes(f.kind)) f.mesh.position.y += Math.sin(t * Math.PI) * 0.16;
      f.mesh.rotation.z =
        ["arrow", "bullet"].includes(f.kind)
          ? Math.atan2(to.y - f.from.y, to.x - f.from.x)
          : f.age * 7;
      if (f.trail > 0.035) {
        f.trail = 0;
        const point = f.mesh.position.clone();
        this.effect(
          ["arrow", "bullet"].includes(f.kind) ? "spark" : f.kind,
          point,
          ["arrow", "bullet"].includes(f.kind) ? 0.08 : 0.25,
          0.2,
          (e, p) => {
            e.mesh.material.opacity = (1 - p) * 0.3;
            e.mesh.scale.setScalar(e.size * (1 - p * 0.7));
          },
        );
      }
      // A missed or interrupted attack still releases its GPU resources.
      if (f.age > f.duration + 0.12) {
        this.dispose(f.mesh);
        this.flights.delete(id);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const f = this.effects[i];
      f.age += dt;
      f.dt = dt;
      const t = Math.min(1, f.age / f.duration);
      f.animate?.(f, t);
      if (t >= 1) {
        f.cleanup?.();
        this.dispose(f.mesh);
        this.effects.splice(i, 1);
      }
    }
  }
  reset() {
    for (const f of this.flights.values()) this.dispose(f.mesh);
    for (const f of this.effects) {
      f.cleanup?.();
      this.dispose(f.mesh);
    }
    for (const stain of this.stains.values()) {
      this.dispose(stain.mesh);
      stain.target?.dispose();
      for (const layer of stain.pending) this.dispose(layer.mesh);
    }
    this.stains.clear();
    this.lastDeathSpray = null;
    this.flights.clear();
    this.effects = [];
    for (const key of Object.keys(this.counts)) this.counts[key] = 0;
  }
  snapshot() {
    return {
      style: "square",
      counts: { ...this.counts },
      projectiles: this.flights.size,
      effects: this.effects.length,
      bloodStains: this.stains.size,
      settledBloodStains: [...this.stains.values()].filter(s => s.frozen && !s.pending.length).length,
      stainCells: [...this.stains.values()].map(({ x, y, deaths }) => ({ x, y, deaths })),
      lastDeathSpray: this.lastDeathSpray,
      healingTargets: this.effects.filter(f => f.kind === "healingTarget").map(f => ({ unitId: f.unit.id, x: f.mesh.position.x, y: f.mesh.position.y })),
      activeKinds: [
        ...new Set(
          [...this.flights.values(), ...this.effects].map((f) => f.kind),
        ),
      ],
      flightAges: [...this.flights.values()].map((f) => f.age),
      effectAges: this.effects.map((f) => f.age),
    };
  }
}
