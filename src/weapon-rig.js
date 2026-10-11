import * as THREE from "three";
import { weaponSpecs } from "./weapons.js";

const geometry = new THREE.PlaneGeometry(1, 1);
const textures = new Map();
function stroke(g, points, color, width) {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}
function disc(g, x, y, r, color, outline = "#35453a") {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  if (outline) {
    g.strokeStyle = outline;
    g.lineWidth = 6;
    g.stroke();
  }
}
function makeTexture(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 192;
  const g = canvas.getContext("2d");
  g.lineCap = "round";
  g.lineJoin = "round";
  if (kind === "bow") {
    for (const [color, width] of [
      ["#2e4234", 15],
      ["#dcba71", 8],
      ["#f0d79a", 3],
    ]) {
      g.beginPath();
      g.moveTo(64, 20);
      g.bezierCurveTo(96, 37, 149, 65, 136, 96);
      g.bezierCurveTo(149, 127, 96, 155, 64, 172);
      g.strokeStyle = color;
      g.lineWidth = width;
      g.stroke();
    }
    stroke(
      g,
      [
        [136, 82],
        [136, 111],
      ],
      "#5a6441",
      12,
    );
    stroke(
      g,
      [
        [133, 84],
        [139, 87],
        [133, 93],
        [139, 97],
        [133, 102],
        [139, 107],
      ],
      "#d3dbad",
      3,
    );
  } else if (kind === "staff") {
    stroke(
      g,
      [
        [20, 96],
        [146, 96],
      ],
      "#334639",
      16,
    );
    stroke(
      g,
      [
        [20, 95],
        [145, 95],
      ],
      "#b99e71",
      9,
    );
    stroke(
      g,
      [
        [29, 91],
        [99, 91],
      ],
      "#eedba6",
      3,
    );
    for (let x = 38; x < 80; x += 9)
      stroke(
        g,
        [
          [x, 91],
          [x + 4, 101],
        ],
        "#6a6c4b",
        3,
      );
    stroke(
      g,
      [
        [124, 94],
        [142, 68],
        [163, 68],
      ],
      "#35453e",
      10,
    );
    stroke(
      g,
      [
        [124, 97],
        [143, 124],
        [164, 124],
      ],
      "#35453e",
      10,
    );
    stroke(
      g,
      [
        [127, 92],
        [145, 72],
        [161, 72],
      ],
      "#d7c58a",
      5,
    );
    stroke(
      g,
      [
        [127, 99],
        [145, 120],
        [161, 120],
      ],
      "#d7c58a",
      5,
    );
    disc(g, 157, 96, 22, "#a6d9cc", "#3c5260");
    disc(g, 153, 91, 12, "#d5eecc", null);
    disc(g, 150, 87, 5, "#fff5ca", null);
  } else if (kind === "coffeeCannon") {
    g.fillStyle = "#aa9360";
    g.strokeStyle = "#344334";
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(32, 62, 122, 68, 13);
    g.fill();
    g.stroke();
    g.fillStyle = "#decd99";
    g.beginPath();
    g.roundRect(39, 68, 105, 20, 7);
    g.fill();
    g.fillStyle = "#718066";
    g.beginPath();
    g.roundRect(43, 100, 87, 19, 5);
    g.fill();
    g.fillStyle = "#e8d49b";
    g.beginPath();
    g.roundRect(137, 56, 31, 80, 8);
    g.fill();
    g.stroke();
    g.fillStyle = "#433c30";
    g.beginPath();
    g.ellipse(164, 96, 10, 29, 0, 0, Math.PI * 2);
    g.fill();
    stroke(
      g,
      [
        [74, 69],
        [66, 90],
        [82, 90],
        [72, 107],
      ],
      "#fff0b1",
      6,
    );
    disc(g, 43, 96, 8, "#7c886b");
  } else if (kind === "arrow") {
    stroke(
      g,
      [
        [20, 96],
        [164, 96],
      ],
      "#394c39",
      9,
    );
    stroke(
      g,
      [
        [23, 95],
        [157, 95],
      ],
      "#f1d593",
      4,
    );
    g.beginPath();
    g.moveTo(151, 85);
    g.lineTo(179, 96);
    g.lineTo(151, 107);
    g.closePath();
    g.fillStyle = "#e7f1c9";
    g.fill();
    stroke(
      g,
      [
        [25, 94],
        [13, 83],
        [40, 89],
      ],
      "#b8d794",
      6,
    );
    stroke(
      g,
      [
        [25, 98],
        [13, 109],
        [40, 103],
      ],
      "#b8d794",
      6,
    );
  } else if (kind === "glow") {
    const gradient = g.createRadialGradient(96, 96, 3, 96, 96, 90);
    gradient.addColorStop(0, "#eeffe4ee");
    gradient.addColorStop(0.25, "#c5acee88");
    gradient.addColorStop(1, "#b88beb00");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 192, 192);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(kind, texture);
  return texture;
}

export class WeaponRig {
  constructor(weaponId, parent) {
    this.id = weaponId;
    this.spec = weaponSpecs[weaponId];
    if (!this.spec) throw new Error("Unknown weapon: " + weaponId);
    this.root = new THREE.Group();
    this.root.position.set(0, -0.08, 0.12);
    parent.add(this.root);
    this.angle = 0;
    this.targetAngle = 0;
    this.recoil = 0;
    this.charge = 0;
    this.opacity = 1;
    this.mesh = this.plane(weaponId, this.spec.width);
    this.mesh.position.x = this.spec.mount;
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.x = this.spec.muzzle;
    this.root.add(this.muzzle);
    if (weaponId === "bow") {
      this.stringGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      this.string = new THREE.Line(
        this.stringGeometry,
        new THREE.LineBasicMaterial({ color: "#eee6ba", transparent: true }),
      );
      this.string.position.z = 0.012;
      this.root.add(this.string);
      this.arrow = this.plane("arrow", 0.65);
      this.arrow.position.set(0.45, 0, 0.02);
    }
    if (weaponId === "staff") {
      this.glow = this.plane("glow", 0.5);
      this.glow.position.set(this.spec.muzzle, 0, 0.025);
    }
    this.pose();
  }
  plane(kind, size) {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: makeTexture(kind),
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.scale.set(size, size, 1);
    this.root.add(mesh);
    return mesh;
  }
  aimAt(worldPoint, snap = false) {
    this.root.updateWorldMatrix(true, false);
    const origin = this.root.getWorldPosition(new THREE.Vector3());
    if (worldPoint.distanceToSquared(origin) < 0.00001) return;
    this.targetAngle = Math.atan2(
      worldPoint.y - origin.y,
      worldPoint.x - origin.x,
    );
    if (snap) {
      this.angle = this.targetAngle;
      this.pose();
    }
  }
  fire() {
    this.recoil = 0.24;
    this.charge = 0;
    this.pose();
  }
  pose() {
    this.root.rotation.z = this.angle;
    // Behind the body when aiming up; in front when aiming down. HP is a separate layer.
    this.root.position.z = Math.sin(this.angle) > 0.3 ? 0.016 : 0.12;
    const kick =
      this.spec.kick *
      Math.sin((Math.min(1, this.recoil / 0.24) * Math.PI) / 2);
    this.mesh.position.x = this.spec.mount - kick;
    this.muzzle.position.x = this.spec.muzzle - kick;
    if (this.string) {
      const positions = this.stringGeometry.attributes.position;
      const tip = this.spec.mount - this.spec.width / 6;
      positions.setXYZ(0, tip - kick, this.spec.width * 0.395, 0);
      positions.setXYZ(1, tip - 0.03 - this.charge * 0.12 - kick, 0, 0);
      positions.setXYZ(2, tip - kick, -this.spec.width * 0.395, 0);
      positions.needsUpdate = true;
      this.arrow.position.x = 0.43 - this.charge * 0.12 - kick;
      this.arrow.visible = this.recoil <= 0.05;
    }
    if (this.glow) {
      this.glow.position.x = this.muzzle.position.x;
      this.glow.material.opacity =
        (0.2 + this.charge * 0.42 + this.recoil) * this.opacity;
    }
    this.root.updateWorldMatrix(true, true);
  }
  update(dt, worldTarget, charge, motion) {
    if (dt <= 0) return;
    this.root.position.x = motion?.x || 0;
    this.root.position.y = (motion?.y || 0) - 0.08;
    if (worldTarget) this.aimAt(worldTarget);
    const delta = Math.atan2(
      Math.sin(this.targetAngle - this.angle),
      Math.cos(this.targetAngle - this.angle),
    );
    this.angle += delta * (1 - Math.exp(-18 * dt));
    this.recoil = Math.max(0, this.recoil - dt);
    this.charge = worldTarget ? Math.max(0, Math.min(1, charge)) : 0;
    this.pose();
  }
  muzzleWorld() {
    this.root.updateWorldMatrix(true, true);
    return this.muzzle.getWorldPosition(new THREE.Vector3());
  }
  setOpacity(opacity) {
    if (this.opacity === opacity) return;
    this.opacity = opacity;
    for (const child of this.root.children)
      if (child.material) child.material.opacity = opacity;
  }
  dispose() {
    this.root.removeFromParent();
    for (const child of this.root.children) child.material?.dispose();
    this.stringGeometry?.dispose();
  }
  snapshot() {
    const p = this.muzzleWorld();
    return {
      weapon: this.id,
      angle: this.angle,
      targetAngle: this.targetAngle,
      recoil: this.recoil,
      charge: this.charge,
      muzzle: { x: p.x, y: p.y },
    };
  }
}
