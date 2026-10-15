import * as THREE from "three";
import { getWeaponSpec } from "./weapons.js";

// Canvas drawings stay in the same outlined, illustrated style as the units.
function texture(draw, w = 192, h = w) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.lineCap = "round";
  g.lineJoin = "round";
  draw(g, w, h);
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  return result;
}
function path(g, points, fill, stroke = "#304434", width = 5) {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = width;
    g.stroke();
  }
}
function circle(g, x, y, r, fill, stroke, width = 4) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = width;
    g.stroke();
  }
}
function line(g, points, color, width) {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}
function createTextures() {
  return {
    bullet: texture(g => {
      line(g, [[35,96],[113,96]], "#d6c58d", 13);
      circle(g,126,96,24,"#b0b6a8","#334b3b",7);
      circle(g,120,88,7,"#e8dfb8");
    }),
    arrow: texture(
      (g) => {
        line(
          g,
          [
            [25, 32],
            [205, 32],
          ],
          "#293b2e",
          12,
        );
        line(
          g,
          [
            [27, 31],
            [203, 31],
          ],
          "#eac787",
          6,
        );
        path(
          g,
          [
            [197, 17],
            [233, 32],
            [197, 47],
            [204, 32],
          ],
          "#ecf4cf",
          "#354a39",
          4,
        );
        path(
          g,
          [
            [28, 31],
            [13, 13],
            [51, 19],
            [66, 31],
          ],
          "#b7d69a",
          "#354a39",
          3,
        );
        path(
          g,
          [
            [28, 34],
            [13, 51],
            [51, 45],
            [66, 34],
          ],
          "#e2ecc4",
          "#354a39",
          3,
        );
        line(
          g,
          [
            [70, 27],
            [70, 37],
          ],
          "#918354",
          3,
        );
      },
      256,
      64,
    ),
    sword: texture((g) => {
      path(
        g,
        [
          [31, 83],
          [57, 84],
          [153, 67],
          [177, 93],
          [153, 116],
          [56, 108],
          [31, 109],
        ],
        "#e7f3dd",
        "#2d4b43",
        6,
      );
      path(
        g,
        [
          [61, 86],
          [153, 73],
          [167, 91],
          [64, 95],
        ],
        "#b4e9de",
        null,
      );
      line(
        g,
        [
          [60, 92],
          [153, 91],
        ],
        "#fffbe0",
        4,
      );
      line(
        g,
        [
          [55, 65],
          [55, 123],
        ],
        "#32493a",
        13,
      );
      line(
        g,
        [
          [55, 68],
          [55, 120],
        ],
        "#d6bf78",
        7,
      );
      line(
        g,
        [
          [20, 95],
          [49, 95],
        ],
        "#4c5f46",
        14,
      );
      line(
        g,
        [
          [22, 94],
          [47, 94],
        ],
        "#b2a777",
        7,
      );
    }),
    slash: texture((g) => {
      g.beginPath();
      g.moveTo(30, 164);
      g.bezierCurveTo(186, 142, 191, 54, 93, 18);
      g.bezierCurveTo(231, 30, 216, 155, 30, 164);
      g.fillStyle = "#25483f";
      g.fill();
      g.strokeStyle = "#234a43";
      g.lineWidth = 7;
      g.stroke();
      g.beginPath();
      g.moveTo(30, 164);
      g.bezierCurveTo(165, 127, 182, 63, 97, 23);
      g.bezierCurveTo(215, 40, 204, 141, 30, 164);
      g.fillStyle = "#c5f5e1";
      g.fill();
      g.beginPath();
      g.moveTo(63, 154);
      g.bezierCurveTo(197, 130, 211, 70, 125, 35);
      g.strokeStyle = "#fffbe1";
      g.lineWidth = 6;
      g.stroke();
      line(
        g,
        [
          [59, 144],
          [85, 126],
        ],
        "#8ed9c7",
        5,
      );
      line(
        g,
        [
          [116, 23],
          [147, 30],
        ],
        "#faffcf",
        4,
      );
    }),
    orb: texture((g) => {
      const glow = g.createRadialGradient(96, 96, 10, 96, 96, 89);
      glow.addColorStop(0, "#f8eaff");
      glow.addColorStop(0.4, "#dbaaff99");
      glow.addColorStop(1, "#a37bec00");
      g.fillStyle = glow;
      g.fillRect(0, 0, 192, 192);
      circle(g, 96, 96, 44, "#a17bd9", "#4a4368", 7);
      circle(g, 91, 90, 29, "#dec7ff", null);
      circle(g, 86, 86, 15, "#fff6df", null);
      path(
        g,
        [
          [96, 35],
          [105, 63],
          [96, 72],
          [87, 63],
        ],
        "#fcdfae",
        null,
      );
      path(
        g,
        [
          [96, 120],
          [105, 130],
          [96, 158],
          [87, 130],
        ],
        "#e0b7ff",
        null,
      );
      g.beginPath();
      g.ellipse(96, 96, 70, 24, -0.7, 0, Math.PI * 2);
      g.strokeStyle = "#e7d9ad";
      g.lineWidth = 5;
      g.stroke();
    }),
    upgrade: texture((g) => {
      const glow = g.createRadialGradient(96, 96, 12, 96, 96, 86);
      glow.addColorStop(0, "#ffe6a63d");
      glow.addColorStop(0.8, "#eec15b70");
      glow.addColorStop(1, "#eec15b00");
      circle(g, 96, 96, 88, glow, null);
      circle(g, 96, 96, 74, null, "#6d522e", 10);
      circle(g, 96, 96, 74, null, "#e5b94f", 6);
      circle(g, 96, 96, 62, null, "#fff0b1", 2.5);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        circle(g, 96 + Math.cos(a) * 74, 96 + Math.sin(a) * 74, 4, "#fff0b1", null);
      }
    }),
    upgradeStar: texture((g) => {
      path(g, [[96, 14], [117, 72], [161, 96], [117, 117], [96, 178], [75, 117], [31, 96], [75, 72]], "#ecc45f", "#6d522e", 8);
      path(g, [[96, 34], [102, 87], [137, 96], [102, 101], [96, 151], [90, 101], [55, 96], [90, 87]], "#fff0b1", null);
    }),
    upgradeBeam: texture((g) => {
      const fill = g.createLinearGradient(0, 20, 0, 179);
      fill.addColorStop(0, "#fff0b1d9");
      fill.addColorStop(0.45, "#eec45f80");
      fill.addColorStop(1, "#eec45f00");
      path(g, [[94, 14], [119, 44], [106, 180], [77, 180], [74, 48]], fill, null);
      line(g, [[94, 27], [91, 78]], "#fff0b1", 6);
    }),
    upgradeGlow: texture((g) => {
      const fill = g.createRadialGradient(96, 96, 15, 96, 96, 91);
      fill.addColorStop(0, "#ffe6a6a6");
      fill.addColorStop(0.48, "#efc66359");
      fill.addColorStop(1, "#efc66300");
      circle(g, 96, 96, 91, fill, null);
    }),
    shield: texture((g) => {
      circle(g, 96, 96, 83, "#84dce71b", "#263e56", 7);
      circle(g, 96, 96, 79, null, "#9ee6ea", 4);
      path(
        g,
        [
          [96, 35],
          [143, 55],
          [138, 108],
          [121, 138],
          [96, 156],
          [71, 138],
          [54, 108],
          [49, 55],
        ],
        "#abdff02b",
        "#d2f4ef",
        5,
      );
      path(
        g,
        [
          [96, 57],
          [108, 86],
          [129, 96],
          [108, 106],
          [96, 135],
          [84, 106],
          [63, 96],
          [84, 86],
        ],
        "#d6f5dc99",
        "#d5f7e8",
        3,
      );
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        circle(
          g,
          96 + Math.cos(a) * 73,
          96 + Math.sin(a) * 73,
          3,
          "#e3f8ce",
          null,
        );
      }
      line(
        g,
        [
          [43, 53],
          [30, 70],
        ],
        "#ffffff",
        4,
      );
    }),
    ring: texture((g) => {
      circle(g, 96, 96, 72, null, "#464a57", 7);
      circle(g, 96, 96, 70, null, "#d5b9ff", 4);
      circle(g, 96, 96, 56, null, "#aa8edbaa", 3);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          x = 96 + Math.cos(a) * 70,
          y = 96 + Math.sin(a) * 70;
        path(
          g,
          [
            [x, y - 7],
            [x + 5, y],
            [x, y + 7],
            [x - 5, y],
          ],
          "#f4dda9",
          "#64556e",
          2,
        );
      }
    }),
    spark: texture((g) => {
      path(
        g,
        [
          [96, 15],
          [110, 70],
          [155, 41],
          [124, 85],
          [178, 97],
          [125, 109],
          [151, 156],
          [110, 123],
          [95, 178],
          [83, 121],
          [35, 151],
          [69, 109],
          [15, 94],
          [70, 81],
          [40, 34],
          [83, 70],
        ],
        "#ffefb0",
        "#7b754b",
        5,
      );
      circle(g, 96, 96, 18, "#fffcec", null);
    }),
    claw: texture((g) => {
      for (let i = 0; i < 3; i++) {
        const x = 37 + i * 43;
        g.beginPath();
        g.moveTo(x, 30 + i * 7);
        g.quadraticCurveTo(x + 63, 100, x + 10, 165 - i * 12);
        g.quadraticCurveTo(x + 35, 101, x, 30 + i * 7);
        g.fillStyle = "#ffc0a0";
        g.strokeStyle = "#633e3a";
        g.lineWidth = 5;
        g.fill();
        g.stroke();
      }
    }),
    coffee: texture((g) => {
      circle(g, 96, 96, 55, "#d6ac67", "#493e2a", 8);
      circle(g, 96, 96, 40, "#684632", "#eee0ac", 6);
      path(
        g,
        [
          [103, 62],
          [80, 97],
          [99, 97],
          [86, 131],
          [116, 88],
          [98, 88],
        ],
        "#ffe1a0",
        null,
      );
    }),
    bloodDrop: texture((g) => {
      g.beginPath();
      g.moveTo(14, 96);
      g.bezierCurveTo(66, 89, 99, 56, 137, 70);
      g.bezierCurveTo(177, 82, 171, 119, 140, 125);
      g.bezierCurveTo(101, 133, 68, 105, 14, 96);
      g.fillStyle = "#82313e";
      g.fill();
      g.strokeStyle = "#542633";
      g.lineWidth = 6;
      g.stroke();
      g.beginPath();
      g.ellipse(131, 86, 17, 7, -0.15, 0, Math.PI * 2);
      g.fillStyle = "#a14b55";
      g.fill();
    }),
    bloodSplash: texture((g) => {
      let seed = 54;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
          r = i % 2 ? 31 + rnd() * 12 : 55 + rnd() * 28;
        const x = 96 + Math.cos(a) * r,
          y = 96 + Math.sin(a) * r * 0.78;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.fillStyle = "#782b3a";
      g.fill();
      g.strokeStyle = "#532533";
      g.lineWidth = 4;
      g.stroke();
      circle(g, 93, 96, 30, "#93404a", null);
      for (let i = 0; i < 17; i++) {
        const a = rnd() * Math.PI * 2,
          r = 65 + rnd() * 23;
        circle(
          g,
          96 + Math.cos(a) * r,
          96 + Math.sin(a) * r,
          3 + rnd() * 7,
          i % 2 ? "#6f2b39" : "#93404c",
          null,
        );
      }
    }),
    bloodJet: texture(
      (g) => {
        g.beginPath();
        g.moveTo(10, 64);
        g.bezierCurveTo(74, 30, 144, 30, 218, 10);
        g.lineTo(181, 44);
        g.lineTo(246, 34);
        g.lineTo(210, 61);
        g.lineTo(244, 89);
        g.lineTo(166, 82);
        g.lineTo(211, 118);
        g.bezierCurveTo(132, 90, 71, 98, 10, 64);
        g.fillStyle = "#742c3b";
        g.fill();
        g.strokeStyle = "#4e2532";
        g.lineWidth = 4;
        g.stroke();
        g.beginPath();
        g.moveTo(12, 64);
        g.quadraticCurveTo(119, 46, 207, 31);
        g.quadraticCurveTo(166, 66, 104, 67);
        g.quadraticCurveTo(153, 79, 199, 90);
        g.quadraticCurveTo(91, 80, 12, 64);
        g.fillStyle = "#91414d";
        g.fill();
        for (let i = 0; i < 8; i++)
          circle(
            g,
            166 + i * 10,
            16 + ((i * 31) % 96),
            3 + (i % 3),
            "#843341",
            null,
          );
      },
      256,
      128,
    ),
    bloodPool: texture((g) => {
      g.beginPath();
      g.moveTo(40, 95);
      g.bezierCurveTo(21, 70, 61, 48, 83, 60);
      g.bezierCurveTo(112, 37, 150, 61, 139, 80);
      g.bezierCurveTo(178, 99, 151, 132, 121, 129);
      g.bezierCurveTo(103, 157, 73, 137, 60, 122);
      g.bezierCurveTo(25, 131, 21, 107, 40, 95);
      g.fillStyle = "#531e2b";
      g.fill();
      g.strokeStyle = "#39212a";
      g.lineWidth = 4;
      g.stroke();
      g.beginPath();
      g.ellipse(96, 96, 40, 25, 0.2, 0, Math.PI * 2);
      g.fillStyle = "#74303c";
      g.fill();
      g.beginPath();
      g.ellipse(85, 80, 23, 7, -0.3, 0, Math.PI * 2);
      g.fillStyle = "#93465355";
      g.fill();
      for (const [x, y, r] of [
        [25, 50, 9],
        [164, 70, 8],
        [148, 155, 7],
        [50, 163, 5],
        [170, 115, 4],
        [80, 26, 5],
        [19, 134, 5],
      ])
        circle(g, x, y, r, "#692938", null);
    }),
    dust: texture((g) => {
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI * 2) / 7;
        circle(
          g,
          96 + Math.cos(a) * 35,
          96 + Math.sin(a) * 25,
          25,
          "#d7d4a933",
          null,
        );
      }
    }),
  };
}

export class CombatVFX {
  constructor(scene, positionOf) {
    this.scene = scene;
    this.positionOf = positionOf;
    this.textures = createTextures();
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
      bloodHits: 0,
      bloodDeaths: 0,
    };
  }
  mesh(kind, width, height = width) {
    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        map: this.textures[kind],
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
    const beams = [-0.51, 0.52, -0.31, 0.33].map((x, i) => ({
      mesh: this.mesh("upgradeBeam", 0.22, 0.7), x, delay: i * 0.045,
    }));
    const stars = [-1, 1, -1, 1, -1, 1].map((side, i) => ({
      mesh: this.mesh("upgradeStar", 0.2), side, delay: i * 0.065,
      size: [0.24, 0.19, 0.15][i % 3], x: 0.49 + (i % 3) * 0.065,
    }));
    const effect = this.effect("upgrade", this.positionOf(unit), 1, 0.9, (f, t) => {
      const point = this.positionOf(unit);
      const expand = 1 - Math.pow(1 - Math.min(1, t / 0.35), 3);
      const fade = Math.min(1, (1 - t) / 0.55);
      f.mesh.position.set(point.x, point.y - 0.38, 1.04);
      f.mesh.scale.set(0.75 + expand * 0.7 + t * 0.2, 0.24 + expand * 0.22 + t * 0.06, 1);
      f.mesh.material.opacity = fade * (0.5 + expand * 0.5);
      glow.position.set(point.x, point.y - 0.08 + t * 0.18, 1.02);
      glow.scale.setScalar(1.1 + expand * 0.6);
      glow.material.opacity = Math.sin(Math.PI * Math.min(1, t / 0.8)) * 0.75;
      for (const beam of beams) {
        const p = Math.max(0, Math.min(1, (t - beam.delay) / 0.65));
        beam.mesh.position.set(point.x + beam.x, point.y - 0.15 + p * 0.7, 1.05);
        beam.mesh.scale.set(0.18, 0.35 + Math.sin(p * Math.PI) * 0.5, 1);
        beam.mesh.material.opacity = Math.sin(p * Math.PI) * 0.8;
      }
      for (const star of stars) {
        const p = Math.max(0, Math.min(1, (t - star.delay) / 0.65));
        star.mesh.position.set(point.x + star.side * (star.x + Math.sin(p * Math.PI) * 0.12), point.y - 0.28 + p * 1.05, 3.25);
        star.mesh.scale.setScalar(star.size * Math.sin(p * Math.PI) ** 0.6);
        star.mesh.rotation.z = star.side * (p - 0.5) * 0.4;
        star.mesh.material.opacity = Math.min(1, p * 10, (1 - p) * 5);
      }
    });
    effect.cleanup = () => {
      for (const mesh of [glow, ...beams.map((b) => b.mesh), ...stars.map((s) => s.mesh)]) this.dispose(mesh);
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
      const points = [
        [x - 7 + 0.1, 5 - y + 3, 3.2],
        [x - 7 - 0.25, 5 - y + 1.5, 3.2],
        [x - 7 + 0.25, 5 - y + 1.65, 3.2],
        [x - 7, 5 - y, 3.2],
      ].map((p) => new THREE.Vector3(...p));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const bolt = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: "#fff3b6", transparent: true }),
      );
      this.scene.add(bolt);
      const fx = this.effect("spark", point, 1.5, 0.35, (f, t) => {
        f.mesh.scale.setScalar(1 + t);
        f.mesh.material.opacity = 1 - t;
        bolt.material.opacity = 1 - t;
      });
      fx.cleanup = () => {
        bolt.removeFromParent();
        bolt.material.dispose();
        geometry.dispose();
      };
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
          f.mesh.scale.set(f.size * (0.65 + t * 0.5), f.size * 0.84, 1);
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
        f.mesh.scale.set(0.95 * reach, 0.4 * (1 - t * 0.35), 1);
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
        f.mesh.scale.set(size * (1.6 - t * 0.5), size * (0.7 - t * 0.2), 1);
        f.mesh.material.opacity = Math.min(0.78, (1 - t) * 1.8);
      });
    }
  }
  stampBlood(unit, source) {
    const key = unit.x + "," + unit.y;
    const previous = this.stains.get(key);
    if (previous) {
      previous.age = 0;
      return;
    }
    const mesh = this.mesh("bloodPool", 0.98);
    mesh.position.set(unit.x - 7, 5 - unit.y, 0.045);
    mesh.rotation.z = Math.atan2(
      source ? source.y - unit.y : 1,
      source ? unit.x - source.x : 0,
    );
    mesh.material.opacity = 0.78;
    this.stains.set(key, { mesh, age: 0, x: unit.x, y: unit.y });
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
      stain.age += dt;
      stain.mesh.scale.setScalar(0.72 + Math.min(1, stain.age / 0.3) * 0.26);
      stain.mesh.material.opacity = 0.78 - Math.min(1, stain.age / 12) * 0.12;
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
    for (const stain of this.stains.values()) this.dispose(stain.mesh);
    this.stains.clear();
    this.lastDeathSpray = null;
    this.flights.clear();
    this.effects = [];
    for (const key of Object.keys(this.counts)) this.counts[key] = 0;
  }
  snapshot() {
    return {
      counts: { ...this.counts },
      projectiles: this.flights.size,
      effects: this.effects.length,
      bloodStains: this.stains.size,
      stainCells: [...this.stains.values()].map(({ x, y }) => ({ x, y })),
      lastDeathSpray: this.lastDeathSpray,
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
