import { drawMermaid } from "./marine-art.js";
import { drawPirate } from "./pirate-art.js";
import { pirateAliases, pirateLooks } from "./marine-content.js";
import { presetById } from "./hero-presets.js";
import { drawHeroPreset } from "./hero-preset-art.js";
const ink = "#203c30";
export function mineArt(ruined = false) {
  const c = canvas(), g = c.getContext("2d");
  ellipse(g, 64, 106, 53, 14, "#203c3055");
  shape(g, [[12, 98], [24, 55], [45, 34], [73, 29], [101, 52], [116, 98], [87, 111], [34, 111]], ruined ? "#626d58" : "#788476");
  shape(g, [[24, 90], [39, 60], [61, 53], [53, 102]], "#566556");
  if (!ruined) {
    shape(g, [[34, 51], [39, 27], [55, 23], [62, 46], [50, 63]], "#e6b84f");
    shape(g, [[66, 43], [77, 18], [92, 24], [96, 44], [83, 58]], "#f2cf70");
    shape(g, [[83, 87], [92, 65], [105, 73], [108, 95], [93, 100]], "#d7a448");
    rounded(g, 45, 65, 34, 39, 14, "#293d31", ink, 4);
    shape(g, [[40, 67], [47, 58], [77, 58], [86, 69]], "#b18c59");
    g.strokeStyle = "#fff0a4"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(43, 31); g.lineTo(49, 29); g.moveTo(79, 26); g.lineTo(85, 30); g.stroke();
  } else {
    shape(g, [[35, 89], [51, 72], [70, 88], [85, 79], [101, 101], [36, 108]], "#424f42");
  }
  return c;
}
function canvas(w = 128, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function rounded(ctx, x, y, w, h, r, color, stroke = ink, line = 5) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line;
    ctx.stroke();
  }
}
function shape(ctx, points, fill, stroke = ink, width = 5) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}
function ellipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
function line(ctx, points, color, width = 4) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}
export function unitArt(type, { portrait = false } = {}) {
  const c = canvas(type === "base" ? 384 : 128), g = c.getContext("2d");
  g.lineJoin = "round";
  g.lineCap = "round";
  if (type === "base") {
    g.scale(3, 3);
    drawMermaid(g);
    return c;
  }
  const pirate = pirateAliases[type] || type;
  if (pirateLooks[pirate]) {
    drawPirate(g, pirate, portrait, { shape, rounded, ellipse, line, ink });
    return c;
  }
  const enemy = false;
  ellipse(g, 65, 115, 45, 9, "#102f2555");
  const color = enemy
    ? "#e87b65"
    : type === "blue"
      ? "#559fd0"
      : type === "green"
        ? "#7ea96a"
        : type === "purple"
          ? "#ad83bd"
          : type === "catgirl" ? "#83b3a0" : presetById[type]?.color || "#bb9958";
  if (!portrait) {
    rounded(g, 10, 12, 108, 104, 18, enemy ? "#933f37" : "#284f47", ink, 5);
    rounded(g, 12, 8, 103, 103, 14, color, enemy ? "#ffe6c6" : "#d1ecd6", 5);
    line(
      g,
      [
        [23, 19],
        [42, 16],
        [51, 18],
        [72, 16],
        [95, 18],
      ],
      enemy ? "#ffd7ab" : "#caeade",
      2,
    );
    rounded(
      g,
      19,
      19,
      89,
      85,
      9,
      enemy
        ? "#d96251"
        : type === "blue"
          ? "#3b79ad"
          : type === "green"
            ? "#5e864e"
            : type === "purple"
              ? "#775996"
              : type === "catgirl" ? "#4f7b69" : presetById[type]?.shade || "#8e743e",
      null,
    );
  }
  ellipse(g, 65, 99, 31, 7, "#19312855");
  if (presetById[type]) {
    drawHeroPreset(g, type, { shape, rounded, ellipse, line, ink });
    return c;
  }
  if (type === "catgirl") {
    // The same small, flat, outlined shapes as the other board-game heroes.
    const tail = [[83, 94], [99, 94], [105, 85], [101, 77], [95, 79]];
    line(g, tail, ink, 10);
    line(g, tail, "#78988a", 5);
    shape(g, [[40, 72], [34, 100], [87, 100], [84, 71]], "#719778");
    shape(g, [[30, 58], [36, 43], [34, 24], [52, 35], [69, 32], [88, 23], [91, 43], [99, 58], [92, 81], [34, 79]], "#78988a");
    shape(g, [[40, 33], [43, 46], [52, 40]], "#c5a18d", null);
    shape(g, [[81, 40], [86, 32], [86, 46]], "#c5a18d", null);
    rounded(g, 42, 48, 44, 35, 8, "#ead8af", ink, 4);
    shape(g, [[34, 53], [44, 40], [66, 35], [88, 44], [92, 59], [77, 51], [68, 61], [58, 51], [42, 60]], "#5d7e70");
    line(g, [[44, 45], [52, 41], [60, 41]], "#a3b99a", 3);
    line(g, [[53, 64], [53, 69]], ink, 4);
    line(g, [[74, 64], [74, 69]], ink, 4);
    line(g, [[61, 76], [65, 78], [69, 75]], ink, 2.5);
    shape(g, [[43, 83], [62, 92], [80, 83], [76, 97], [48, 97]], "#91ac82", null);
    shape(g, [[64, 85], [68, 89], [64, 94], [60, 89]], "#ddc581", ink, 2.5);
    ellipse(g, 84, 88, 6, 6, "#ead8af");
    return c;
  }
  if (type === "blue") {
    shape(
      g,
      [
        [38, 75],
        [34, 101],
        [87, 100],
        [86, 70],
      ],
      "#477ab0",
    );
    shape(
      g,
      [
        [30, 57],
        [38, 39],
        [39, 25],
        [53, 35],
        [67, 23],
        [77, 36],
        [89, 27],
        [92, 45],
        [101, 57],
        [92, 77],
        [36, 77],
      ],
      "#5caee0",
    );
    line(
      g,
      [
        [41, 43],
        [51, 39],
        [58, 33],
      ],
      "#a2d8ec",
      4,
    );
    shape(
      g,
      [
        [37, 57],
        [52, 53],
        [63, 61],
        [77, 54],
        [94, 57],
        [89, 77],
        [76, 79],
        [72, 90],
        [55, 89],
        [53, 79],
        [41, 75],
      ],
      "#f6ecc6",
    );
    ellipse(g, 51, 66, 6, 7, "#273f38");
    ellipse(g, 79, 66, 6, 7, "#273f38");
    line(
      g,
      [
        [63, 78],
        [63, 83],
      ],
      "#3a503f",
      3,
    );
    shape(
      g,
      [
        [26, 72],
        [36, 75],
        [31, 97],
        [19, 91],
      ],
      "#aad5dc",
    );
    line(
      g,
      [
        [29, 77],
        [25, 88],
      ],
      "#e5efcf",
      2,
    );
  } else if (type === "green") {
    shape(
      g,
      [
        [38, 77],
        [31, 100],
        [85, 102],
        [87, 70],
      ],
      "#7e9656",
    );
    shape(
      g,
      [
        [30, 58],
        [44, 29],
        [70, 24],
        [94, 52],
        [92, 75],
        [36, 76],
      ],
      "#98b76c",
    );
    rounded(g, 43, 48, 40, 32, 9, "#ead8af", ink, 4);
    line(
      g,
      [
        [51, 59],
        [51, 66],
      ],
      ink,
      4,
    );
    line(
      g,
      [
        [70, 59],
        [70, 66],
      ],
      ink,
      4,
    );
    shape(
      g,
      [
        [28, 56],
        [42, 34],
        [73, 24],
        [91, 48],
        [60, 43],
        [41, 59],
      ],
      "#799853",
    );
    ellipse(g, 84, 84, 7, 6, "#ead8af");
  } else if (type === "purple") {
    shape(
      g,
      [
        [44, 70],
        [32, 100],
        [87, 100],
        [80, 60],
      ],
      "#9874ae",
    );
    rounded(g, 43, 48, 40, 32, 9, "#e8d5b3", ink, 4);
    line(
      g,
      [
        [53, 60],
        [53, 65],
      ],
      ink,
      3,
    );
    line(
      g,
      [
        [72, 60],
        [72, 65],
      ],
      ink,
      3,
    );
    shape(
      g,
      [
        [25, 50],
        [44, 42],
        [60, 17],
        [76, 41],
        [98, 50],
        [80, 58],
        [43, 57],
      ],
      "#b498d1",
    );
    ellipse(g, 61, 35, 5, 5, "#e8d393");
    ellipse(g, 83, 85, 7, 6, "#e8d5b3");
  } else if (type === "tower") {
    rounded(g, 35, 52, 55, 49, 7, "#ccbb87", ink, 5);
    rounded(g, 39, 39, 48, 36, 10, "#72816b", ink, 5);
    ellipse(g, 63, 50, 14, 8, "#d6c58e");
    shape(
      g,
      [
        [53, 80],
        [70, 80],
        [64, 89],
        [70, 89],
        [54, 99],
        [59, 88],
        [51, 88],
      ],
      "#f2da86",
      null,
    );
  } else if (type === "runner") {
    ellipse(g, 64, 63, 24, 31, "#493954");
    shape(
      g,
      [
        [42, 50],
        [44, 25],
        [58, 39],
        [70, 37],
        [86, 24],
        [87, 60],
      ],
      "#493954",
    );
    ellipse(g, 56, 60, 5, 8, "#ae80c4");
    ellipse(g, 70, 60, 5, 8, "#ae80c4");
    line(
      g,
      [
        [45, 78],
        [31, 86],
        [28, 101],
      ],
      "#392f46",
      6,
    );
    line(
      g,
      [
        [80, 78],
        [95, 86],
        [99, 101],
      ],
      "#392f46",
      6,
    );
    line(
      g,
      [
        [55, 88],
        [50, 103],
      ],
      "#392f46",
      5,
    );
    line(
      g,
      [
        [74, 88],
        [80, 103],
      ],
      "#392f46",
      5,
    );
  } else {
    const tank = type === "tank" || type === "boss";
    rounded(
      g,
      tank ? 31 : 39,
      40,
      tank ? 60 : 44,
      60,
      7,
      tank ? "#6e6855" : "#8b7960",
      ink,
      5,
    );
    rounded(g, tank ? 33 : 41, 35, tank ? 56 : 40, 37, 6, "#ead4a7", ink, 5);
    shape(
      g,
      [
        [35, 36],
        [43, 28],
        [80, 28],
        [89, 40],
        [70, 37],
        [50, 39],
      ],
      type === "boss" ? "#bba660" : "#81715a",
    );
    line(
      g,
      [
        [53, 45],
        [53, 57],
      ],
      "#394536",
      4,
    );
    line(
      g,
      [
        [70, 45],
        [70, 57],
      ],
      "#394536",
      4,
    );
    shape(
      g,
      [
        [58, 73],
        [68, 73],
        [71, 87],
        [63, 94],
        [55, 86],
      ],
      type === "boss" ? "#eac85b" : "#b84d48",
      null,
    );
    if (tank) {
      rounded(g, 19, 65, 25, 30, 5, "#a4a28a", ink, 4);
      line(
        g,
        [
          [25, 75],
          [37, 75],
        ],
        "#d4ceb0",
        3,
      );
    } else {
      shape(
        g,
        [
          [80, 70],
          [103, 77],
          [96, 97],
          [76, 89],
        ],
        "#eee0b8",
        ink,
        3,
      );
      line(
        g,
        [
          [86, 80],
          [96, 83],
        ],
        "#ab9c78",
        2,
      );
    }
    if (type === "boss")
      shape(
        g,
        [
          [40, 31],
          [36, 15],
          [51, 24],
          [63, 10],
          [75, 24],
          [90, 15],
          [85, 32],
        ],
        "#efd179",
        ink,
        4,
      );
  }
  return c;
}

export const obstacles = new Set();
export function treeArt() {
  const c = canvas(), g = c.getContext("2d");
  g.lineJoin = "round";
  g.lineCap = "round";
  // A transparent sandy footprint lets the same palm sit on both board and editor tiles.
  ellipse(g, 67, 111, 40, 10, "#806d4538");
  ellipse(g, 53, 113, 22, 6, "#d4b574");
  g.beginPath();
  g.moveTo(43, 112); g.bezierCurveTo(61, 91, 60, 68, 49, 44);
  g.lineTo(61, 40); g.bezierCurveTo(77, 66, 78, 90, 62, 113);
  g.closePath(); g.fillStyle = "#b58a50"; g.fill();
  g.strokeStyle = "#594d32"; g.lineWidth = 4; g.stroke();
  g.beginPath(); g.moveTo(49, 108); g.bezierCurveTo(67, 88, 65, 64, 55, 47);
  g.strokeStyle = "#e0ba76"; g.lineWidth = 5; g.stroke();
  for (const [x, y, dx] of [[53, 100, 14], [58, 88, 13], [59, 76, 12], [57, 64, 11]])
    line(g, [[x, y], [x + dx, y + 3]], "#86653e", 2.5);
  const fronds = [
    { fill: "#448052", points: [[57,43],[43,33],[30,18],[14,12],[28,9],[43,13],[40,18],[50,21],[48,26],[59,30],[64,42]], vein: [[57,41],[37,20],[18,13]] },
    { fill: "#559755", points: [[56,42],[50,26],[55,13],[69,5],[66,18],[62,16],[64,26],[60,25],[64,38]], vein: [[57,38],[58,24],[65,10]] },
    { fill: "#62a35c", points: [[59,41],[70,25],[89,16],[111,19],[98,23],[100,27],[87,27],[91,32],[77,33],[78,38],[64,46]], vein: [[62,40],[81,25],[105,20]] },
    { fill: "#397d4d", points: [[62,43],[83,35],[105,41],[119,60],[104,53],[106,59],[94,50],[94,57],[81,48],[80,54],[63,49]], vein: [[65,45],[89,44],[115,57]] },
    { fill: "#4c9251", points: [[55,43],[34,31],[15,37],[5,56],[17,48],[16,54],[28,43],[29,49],[41,42],[45,48]], vein: [[51,43],[29,37],[9,52]] },
    { fill: "#65a45a", points: [[54,43],[39,46],[27,58],[23,78],[33,68],[36,71],[39,59],[43,63],[47,52],[54,51]], vein: [[52,47],[39,54],[27,73]] },
    { fill: "#3f844d", points: [[60,44],[77,47],[88,62],[89,80],[80,69],[76,72],[74,60],[70,63],[66,53],[58,51]], vein: [[62,48],[76,58],[85,75]] },
  ];
  for (const leaf of fronds) {
    shape(g, leaf.points, leaf.fill, "#285438", 3);
    line(g, leaf.vein, "#a6c977", 1.8);
  }
  for (const [x, y, r] of [[49, 51, 7], [64, 51, 7], [56, 58, 7.5]]) {
    ellipse(g, x, y + 1, r + 1.5, r + 1.5, "#514631");
    ellipse(g, x, y, r, r, "#98723f");
    ellipse(g, x - 2, y - 2, r * .55, r * .48, "#c49a5b");
  }
  return c;
}
export function mapArt(blocked = obstacles) {
  const s = 96, c = canvas(15 * s, 11 * s), g = c.getContext("2d");
  let seed = 375;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  g.fillStyle = "#f3d48c";
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 15; x++) {
    const px = x * s, py = y * s;
    // Alternating warm sand, with soft edges rather than dark grid outlines.
    const light = ((x + y) % 2 ? 73 : 79) + rnd() * 2;
    g.fillStyle = `hsl(43 84% ${light}%)`;
    g.fillRect(px, py, s, s);
    const shade = g.createLinearGradient(px, py, px + s * .65, py + s);
    shade.addColorStop(0, "#fff5c625");
    shade.addColorStop(.6, "#fff5c600");
    shade.addColorStop(1, "#ba884b10");
    g.fillStyle = shade;
    g.fillRect(px, py, s, s);
    g.strokeStyle = "#fff0bd24";
    g.lineWidth = 1;
    g.strokeRect(px + .5, py + .5, s - 1, s - 1);
    for (let n = 0; n < 65; n++) {
      g.fillStyle = rnd() > .5 ? "#fff5d21c" : "#b3915511";
      g.fillRect(px + rnd() * s, py + rnd() * s, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    const detail = rnd();
    if (detail > .12 || blocked.has(`${x},${y}`) || Math.abs(x - 7) + Math.abs(y - 5) < 3) continue;
    const fx = px + 26 + rnd() * 44, fy = py + 28 + rnd() * 38;
    g.save(); g.translate(fx, fy); g.rotate(rnd() * 1.4 - .7);
    if (detail < .045) {
      const points = Array.from({ length: 10 }, (_, i) => {
        const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5 : 11;
        return [Math.cos(angle) * r, Math.sin(angle) * r];
      });
      ellipse(g, 1, 5, 10, 4, "#a9794226");
      shape(g, points, "#de884e", "#bf713c", 1.5);
      ellipse(g, -1, -2, 2, 1.5, "#f6b376");
    } else if (detail < .09) {
      ellipse(g, 0, 5, 10, 4, "#a9794226");
      g.beginPath(); g.moveTo(-4, 7); g.quadraticCurveTo(-15, 0, -8, -7);
      g.quadraticCurveTo(0, -15, 8, -7); g.quadraticCurveTo(15, 0, 4, 7); g.closePath();
      g.fillStyle = "#f8edc0"; g.fill(); g.strokeStyle = "#c5ad75"; g.lineWidth = 1.2; g.stroke();
      for (const dx of [-7, -3, 3, 7]) line(g, [[0, 7], [dx, -6]], "#d5c28d", 1);
    } else {
      ellipse(g, 0, 2, 7, 4, "#b9ae87");
      ellipse(g, -2, 0, 4, 2, "#e0d6ae");
      ellipse(g, 10, 6, 3, 2, "#c2ad80");
    }
    g.restore();
  }
  const tree = blocked.size ? treeArt() : null;
  for (const key of blocked) {
    const [x, y] = key.split(",").map(Number);
    g.drawImage(tree, x * s, y * s, s, s);
  }
  return c;
}

// Wrapped brush marks and light pools make a seamless, slowly drifting sea tile.
export function oceanArt() {
  const size = 1024, c = canvas(size), g = c.getContext("2d");
  g.fillStyle = "#208eae";
  g.fillRect(0, 0, size, size);
  let seed = 739;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const wrap = draw => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      g.save(); g.translate(dx, dy); draw(); g.restore();
    }
  };
  for (let i = 0; i < 24; i++) {
    const x = rnd() * size, y = rnd() * size, r = 120 + rnd() * 220;
    wrap(() => {
      const light = g.createRadialGradient(x, y, 0, x, y, r);
      light.addColorStop(0, i % 3 ? "#52e4d53d" : "#104f842b");
      light.addColorStop(1, i % 3 ? "#52e4d500" : "#104f8400");
      g.fillStyle = light; g.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }
  g.lineCap = "round";
  for (let row = 0; row < 28; row++) for (let col = 0; col < 14; col++) {
    const x = col * size / 14 + (row % 2) * 30 + rnd() * 23;
    const y = row * size / 28 + rnd() * 15;
    const length = 17 + rnd() * 30, bend = rnd() * 3 - 1.5;
    const width = 4 + rnd() * 3, alpha = .14 + rnd() * .24;
    wrap(() => {
      g.strokeStyle = `rgba(184,242,217,${alpha})`; g.lineWidth = width;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + length / 2, y - 1.5, x + length, y + bend); g.stroke();
    });
  }
  return c;
}

export function shorelineArt() {
  const c = canvas(1640, 1240), g = c.getContext("2d");
  rounded(g, 4, 10, 1632, 1224, 85, "#157b9e", null);
  rounded(g, 12, 8, 1616, 1216, 78, "#4ccbd1", null);
  rounded(g, 32, 30, 1576, 1176, 58, "#9ae2cd", null);
  rounded(g, 44, 42, 1552, 1152, 45, "#b99d65", null);
  rounded(g, 48, 42, 1544, 1144, 42, "#d9bf80", null);
  rounded(g, 57, 51, 1526, 1126, 33, "#e6d29b", null);
  return c;
}
