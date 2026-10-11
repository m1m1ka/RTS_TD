const ink = "#203c30";
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
  const c = canvas(),
    g = c.getContext("2d");
  g.lineJoin = "round";
  g.lineCap = "round";
  const enemy = ["grunt", "runner", "tank", "boss"].includes(type);
  ellipse(g, 65, 115, 45, 9, "#102f2555");
  if (type === "base") {
    rounded(g, 13, 22, 101, 96, 14, "#b89550", "#284330", 6);
    rounded(g, 18, 15, 92, 96, 12, "#e9d296", "#f8e9bf", 4);
    rounded(g, 29, 25, 70, 43, 7, "#344b38", "#867e4c", 4);
    g.fillStyle = "#d4ef9c";
    g.font = "bold 22px monospace";
    g.textAlign = "center";
    g.fillText("17:59", 64, 53);
    rounded(g, 34, 77, 37, 21, 3, "#64816a", "#304c37", 3);
    line(
      g,
      [
        [43, 88],
        [61, 88],
      ],
      "#b7d698",
      3,
    );
    ellipse(g, 88, 87, 8, 8, "#91bd6b");
    ellipse(g, 86, 84, 3, 3, "#dff2a5");
    shape(
      g,
      [
        [44, 17],
        [43, 3],
        [86, 3],
        [83, 17],
      ],
      "#f5ecd1",
      "#56633d",
      3,
    );
    line(
      g,
      [
        [51, 9],
        [75, 9],
      ],
      "#9caa7c",
      2,
    );
    return c;
  }
  const color = enemy
    ? "#e87b65"
    : type === "blue"
      ? "#559fd0"
      : type === "green"
        ? "#7ea96a"
        : type === "purple"
          ? "#ad83bd"
          : "#bb9958";
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
              : "#8e743e",
      null,
    );
  }
  ellipse(g, 65, 99, 31, 7, "#19312855");
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
export function mapArt() {
  const s = 96,
    c = canvas(15 * s, 11 * s),
    g = c.getContext("2d");
  let seed = 375;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  g.fillStyle = "#315c3b";
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 15; x++) {
      const px = x * s,
        py = y * s;
      let light = 31 + rnd() * 7;
      g.fillStyle = `hsl(${131 + rnd() * 9} 28% ${light}%)`;
      g.fillRect(px, py, s, s);
      const grad = g.createLinearGradient(px, py, px + s, py + s);
      grad.addColorStop(0, "#8fb4690a");
      grad.addColorStop(1, "#12332927");
      g.fillStyle = grad;
      g.fillRect(px, py, s, s);
      g.strokeStyle = "#193d2c32";
      g.lineWidth = 2;
      g.strokeRect(px + 1, py + 1, s - 2, s - 2);
      if (y === 5 || x === 7) {
        g.fillStyle = "#adc17b0b";
        g.fillRect(px + 3, py + 3, s - 6, s - 6);
      }
      for (let n = 0; n < 180; n++) {
        g.fillStyle = rnd() > 0.5 ? "#c1d39808" : "#0c32200b";
        g.fillRect(
          px + rnd() * s,
          py + rnd() * s,
          1 + rnd() * 3,
          1 + rnd() * 3,
        );
      }
      if (rnd() < 0.22 && Math.abs(x - 7) + Math.abs(y - 5) > 2) {
        const bx = px + 25 + rnd() * 25,
          by = py + 65;
        for (let n = 0; n < 5; n++) {
          let k = n * 8;
          line(
            g,
            [
              [bx + k, by],
              [bx + k - 5, by - 16 - n * 3],
              [bx + k - 2, by - 23 - n * 3],
            ],
            "#346b43",
            8,
          );
          line(
            g,
            [
              [bx + k, by - 2],
              [bx + k - 4, by - 18 - n * 3],
            ],
            "#659653",
            3,
          );
        }
      } else if (rnd() < 0.27) {
        const fx = px + 20 + rnd() * 50,
          fy = py + 20 + rnd() * 50;
        if (rnd() > 0.6) {
          ellipse(g, fx - 4, fy, 4, 2, "#bdc185");
          ellipse(g, fx + 3, fy - 2, 3, 4, "#d3ca90");
          ellipse(g, fx + 3, fy + 3, 3, 3, "#bdc185");
          ellipse(g, fx, fy, 2, 2, "#d6ae61");
        } else {
          ellipse(g, fx, fy, 6, 3, "#799471");
          ellipse(g, fx + 8, fy + 4, 4, 2, "#32573c");
        }
      }
    }
  // Ragged forest canopy, matching the reference's dark peripheral foliage.
  for (let i = 0; i < 45; i++) {
    const edge = i % 4,
      xx = edge < 2 ? rnd() * c.width : edge === 2 ? -22 : c.width + 22,
      yy = edge >= 2 ? rnd() * c.height : edge === 0 ? -24 : c.height + 24;
    ellipse(g, xx, yy, 35 + rnd() * 35, 30 + rnd() * 30, "#203f2e");
    ellipse(g, xx - 6, yy - 9, 30 + rnd() * 27, 20 + rnd() * 20, "#2a4c32");
  }
  return c;
}

export function forestArt() {
  const c = canvas(1536, 1024),
    g = c.getContext("2d");
  g.fillStyle = "#284b34";
  g.fillRect(0, 0, c.width, c.height);
  let seed = 139;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 680; i++) {
    const x = rnd() * c.width,
      y = rnd() * c.height,
      r = 18 + rnd() * 36;
    ellipse(g, x, y + 10, r + 3, r * 0.72, "#193a2b");
    ellipse(
      g,
      x,
      y,
      r,
      r * 0.72,
      ["#2b4d34", "#31563a", "#284b33", "#345a3b"][i % 4],
    );
    ellipse(g, x - 5, y - 9, r * 0.69, r * 0.4, "#46694130");
  }
  return c;
}
