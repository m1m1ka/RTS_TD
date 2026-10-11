import * as THREE from "three";
import { cards } from "./cards.js";
import { iconURL } from "./config/icons.js";
import { getConfigRevision } from "./config/store.js";

const geometry = new THREE.PlaneGeometry(1, 1);
const HOLD_TIME = 2.4;
// Equipment art is shared with cards; cache the small fixed set of textures across heroes.
const equipmentTextures = new Map();
function equipmentTexture(key) {
  const url = iconURL(cards[key]?.useIcon || key);
  if (!equipmentTextures.has(url)) {
    const texture = new THREE.TextureLoader().load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    equipmentTextures.set(url, texture);
  }
  return equipmentTextures.get(url);
}

export class HealthBar {
  constructor(parent, unit, size) {
    this.size = size;
    this.enemy = unit.side === "enemy";
    this.level = unit.level || 0;
    this.hp = unit.hp;
    this.maxHp = unit.maxHp;
    this.fill = this.trail = unit.hp / unit.maxHp;
    this.remaining = 0;
    this.delay = 0;
    this.lastDrawing = "";
    this.canvas = document.createElement("canvas");
    this.canvas.width = 256;
    this.canvas.height = this.level ? 128 : 68;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.mesh.scale.set(size * 0.97, (0.235 * this.canvas.height) / 68, 1);
    this.mesh.position.set(
      0,
      size * 0.49 - (0.235 * (this.canvas.height - 68)) / 136,
      0.15,
    );
    this.mesh.renderOrder = 12;
    this.mesh.visible = !this.enemy;
    parent.add(this.mesh);
    this.equipmentGroup = new THREE.Group();
    this.equipmentGroup.position.set(0, size * 0.49 + 0.28, 0.16);
    parent.add(this.equipmentGroup);
    this.equipment = [];
    this.setEquipment(unit.equipment || []);
    this.draw();
  }
  hit() {
    this.remaining = HOLD_TIME;
    this.delay = 0.24;
    this.mesh.visible = true;
    this.mesh.material.opacity = 1;
  }
  update(hp, maxHp, dt, level = this.level, equipment = this.equipment) {
    this.setEquipment(equipment);
    this.equipmentGroup.visible = hp > 0 && !this.enemy;
    this.level = level;
    const height = level ? 128 : 68;
    if (this.canvas.height !== height) {
      this.canvas.height = height;
      this.lastDrawing = "";
      this.mesh.scale.y = (0.235 * height) / 68;
      this.mesh.position.y = this.size * 0.49 - (0.235 * (height - 68)) / 136;
    }
    this.hp = Math.max(0, hp);
    this.maxHp = maxHp;
    const target = this.hp / maxHp;
    this.remaining = Math.max(0, this.remaining - dt);
    this.delay = Math.max(0, this.delay - dt);
    if (target >= this.fill) this.fill = this.trail = target;
    else
      this.fill = THREE.MathUtils.lerp(
        this.fill,
        target,
        1 - Math.exp(-22 * dt),
      );
    if (this.delay <= 0)
      this.trail = THREE.MathUtils.lerp(
        this.trail,
        target,
        1 - Math.exp(-5 * dt),
      );
    this.trail = Math.max(this.fill, this.trail);
    this.mesh.visible = !this.enemy || this.remaining > 0;
    this.mesh.material.opacity = this.enemy
      ? Math.min(1, this.remaining / 0.35)
      : 1;
    if (this.mesh.visible) this.draw();
  }
  setEquipment(equipment) {
    const keys = equipment.filter((key) => cards[key]);
    const signature = getConfigRevision() + ":" + keys.join("|");
    if (signature === this.equipmentSignature) return;
    this.equipmentSignature = signature;
    for (const icon of [...this.equipmentGroup.children]) {
      icon.material.dispose();
      icon.removeFromParent();
    }
    this.equipment = [...keys];
    keys.forEach((key, i) => {
      const icon = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          map: equipmentTexture(key),
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      icon.scale.set(0.29, 0.29, 1);
      icon.position.x = (i - (keys.length - 1) / 2) * 0.28;
      icon.renderOrder = 13;
      this.equipmentGroup.add(icon);
    });
  }
  draw() {
    const fill = Math.round(this.fill * 236),
      trail = Math.round(this.trail * 236),
      hp = Math.ceil(this.hp);
    const key = `${fill},${trail},${hp},${this.level}`;
    if (key === this.lastDrawing) return;
    this.lastDrawing = key;
    const g = this.ctx;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.save();
    g.fillStyle = "#140e12";
    g.beginPath();
    g.roundRect(2, 12, 252, 48, 9);
    g.fill();
    g.save();
    g.beginPath();
    g.roundRect(10, 20, 236, 32, 3);
    g.clip();
    g.fillStyle = "#44151c";
    g.fillRect(10, 20, 236, 32);
    g.fillStyle = "#ffa16c";
    g.fillRect(10, 20, trail, 32);
    const red = g.createLinearGradient(0, 20, 0, 52);
    red.addColorStop(0, "#ff5142");
    red.addColorStop(0.32, "#f53232");
    red.addColorStop(1, "#c91425");
    g.fillStyle = red;
    g.fillRect(10, 20, fill, 32);
    g.fillStyle = "#ff8774";
    g.fillRect(10, 20, fill, 4);
    g.restore();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "900 47px Arial, sans-serif";
    g.lineJoin = "round";
    g.strokeStyle = "#171116";
    g.lineWidth = 10;
    g.strokeText(String(hp), 128, 30);
    g.fillStyle = "#fff9e4";
    g.fillText(String(hp), 128, 30);
    g.restore();
    if (this.level) {
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.font = "900 47px Arial, sans-serif";
      g.lineJoin = "round";
      g.strokeStyle = "#171116";
      g.lineWidth = 10;
      g.strokeText("lv" + this.level, 10, 92, 112);
      g.fillStyle = "#fff9e4";
      g.fillText("lv" + this.level, 10, 92, 112);
    }
    this.texture.needsUpdate = true;
  }
  dispose() {
    for (const icon of this.equipmentGroup.children) icon.material.dispose();
    this.equipmentGroup.removeFromParent();
    this.mesh.removeFromParent();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
  snapshot() {
    return {
      enemy: this.enemy,
      level: this.level,
      equipment: [...this.equipment],
      hp: this.hp,
      visible: this.mesh.visible,
      opacity: this.mesh.material.opacity,
      fill: this.fill,
      trail: this.trail,
      remaining: this.remaining,
    };
  }
}
