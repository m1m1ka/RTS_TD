import * as THREE from "three";

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
function line(g, points, color, width) {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}
export function createMeleeTextures() {
  return {
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
  };
}
