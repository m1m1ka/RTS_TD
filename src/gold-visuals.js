import * as THREE from "three";
import { mineArt } from "./art.js";
import { HealthBar } from "./health-bar.js";

export class GoldVisuals {
  constructor(scene, camera, pos) {
    Object.assign(this, { scene, camera, pos });
    this.mines = new Map();
    this.textures = [false, true].map((ruined) => {
      const t = new THREE.CanvasTexture(mineArt(ruined));
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.canvas = document.createElement("canvas");
    this.canvas.className = "victory-effects";
    this.canvas.setAttribute("aria-hidden", "true");
    document.getElementById("arena").append(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.confetti = Array.from({ length: 100 }, (_, i) => ({
      side: i % 2, y: .45 + Math.random() * .35, vx: 140 + Math.random() * 430,
      vy: -220 - Math.random() * 300, spin: Math.random() * 12,
      color: ["#e8c36e", "#ce8877", "#9fc99a", "#b9a4cc", "#e9dfb0"][i % 5],
    }));
  }
  hit(unit) { const v = this.mines.get(unit.id); if (v) { v.hit = .3; v.bar.hit(); } }
  reset() {
    for (const v of this.mines.values()) { v.bar.dispose(); v.mesh.material.dispose(); this.scene.remove(v.group); }
    this.mines.clear();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  update(game, dt) {
    const ids = new Set(game.mines.map(m => m.id));
    for (const [id, v] of this.mines) if (!ids.has(id)) {
      v.bar.dispose(); v.mesh.material.dispose(); this.scene.remove(v.group); this.mines.delete(id);
    }
    for (const mine of game.mines) {
      let v = this.mines.get(mine.id);
      if (!v) {
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ map: this.textures[0], transparent: true, depthWrite: false }));
        mesh.scale.setScalar(1.06); group.add(mesh); group.position.copy(this.pos(mine.x, mine.y, 1.05));
        this.scene.add(group);
        v = { group, mesh, bar: new HealthBar(group, mine, .9), hit: 0 };
        this.mines.set(mine.id, v);
      }
      v.hit = Math.max(0, v.hit - dt);
      v.group.position.copy(this.pos(mine.x, mine.y, 1.05));
      v.mesh.position.x = Math.sin(v.hit * 70) * v.hit * .14;
      v.mesh.material.color.set(v.hit > .17 ? "#ffcd9a" : "#ffffff");
      v.mesh.material.map = this.textures[mine.hp > 0 ? 0 : 1];
      v.bar.mesh.visible = mine.hp > 0;
      if (mine.hp > 0) v.bar.update(mine.hp, mine.maxHp, dt);
    }
    this.drawVictory(game);
  }
  drawVictory(game) {
    const c = this.canvas, g = this.ctx, w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (game.phase !== "victory") return;
    const t = game.settlement.elapsed;
    if (t < 2.3) {
      g.globalAlpha = Math.min(1, (2.3 - t) * 2);
      for (const p of this.confetti) {
        const x = p.side ? w - p.vx * t : p.vx * t, y = h * p.y + p.vy * t + 230 * t * t;
        g.save(); g.translate(x, y); g.rotate(p.spin + t * p.spin); g.fillStyle = p.color;
        g.strokeStyle = "#283e32"; g.lineWidth = 1.5;
        g.fillRect(-4, -7, 8, 14); g.strokeRect(-4, -7, 8, 14); g.restore();
      }
      g.globalAlpha = 1;
    }
    if (t > .6 && t < 2.3) {
      const age = t - .6, scale = 1 + Math.sin(Math.min(1, age * 4) * Math.PI) * .15;
      g.save(); g.translate(w / 2, h * .42); g.scale(scale, scale);
      g.globalAlpha = Math.min(1, age * 6, (2.3 - t) * 4);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `900 ${Math.min(88, w * .17)}px "Noto Sans SC", sans-serif`;
      g.lineJoin = "round"; g.lineWidth = 12; g.strokeStyle = "#20392b"; g.strokeText("胜利", 0, 0);
      g.shadowColor = "#edc36877"; g.shadowBlur = 25; g.fillStyle = "#f4dc98"; g.fillText("胜利", 0, 0);
      g.restore();
    }
    for (const coin of game.settlement.coins) {
      const age = t - coin.at;
      if (age < 0) continue;
      const p = this.pos(coin.x, coin.y, 3).project(this.camera);
      const x = (p.x + 1) * w / 2, y = (1 - p.y) * h / 2 - 36 - coin.index * 26;
      const pop = Math.min(1, age * 6), fade = Math.min(1, (game.settlement.duration - t) * 3);
      g.save(); g.globalAlpha = Math.max(0, fade); g.translate(x, y + (1 - pop) * 18);
      g.scale(.55 + pop * .45, .55 + pop * .45);
      g.fillStyle = "#d39b39"; g.strokeStyle = "#4c4229"; g.lineWidth = 3;
      g.beginPath(); g.ellipse(0, 0, 10, 11, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = "#ffe3a0"; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -1, 6.5, 7, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#ffe3a0"; g.fillRect(-1.5, -5, 3, 8);
      if (coin.amount > 1) { g.font='bold 13px Arial'; g.textAlign='left'; g.fillText('×'+coin.amount,14,5); }
      g.restore();
    }
  }
}
