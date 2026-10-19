const outline = "#293e3b";
function brushes(g) {
  return {
    path(d, fill, stroke = outline, width = 3) {
      const p = new Path2D(d);
      if (fill) { g.fillStyle = fill; g.fill(p); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(p); }
    },
    ellipse(x, y, rx, ry, fill, stroke = null, width = 2) {
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fillStyle = fill; g.fill();
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(); }
    },
  };
}

export function drawMermaid(g) {
  const { path: p, ellipse: e } = brushes(g);
  // Pearl pool and shell seat frame the silhouette without a rectangular unit tile.
  e(64, 112, 55, 11, "#337e773e");
  e(64, 109, 48, 9, "#6bbcb2", outline, 2.5);
  p("M19 103 Q11 91 19 80 Q14 64 25 59 Q27 48 39 51 Q49 42 58 51 Q73 44 79 55 Q94 51 99 65 Q111 70 104 86 L97 104Z", "#dbccba", "#827e80", 2.5);
  for (const [x,y] of [[23,68],[35,57],[51,54],[69,56],[86,62],[99,76]])
    p(`M58 100 Q${x} 88 ${x} ${y}`, null, "#bda4a4", 1.5);
  p("M24 106 Q18 98 31 92 L69 89 L99 103 L93 111Z", "#8ba5a1", outline, 2.5);
  // Long coral hair: dark underside, rounded locks and broad lit ribbons.
  p("M38 49 Q19 25 38 14 Q55 3 72 13 Q91 16 87 40 Q85 57 96 64 Q108 71 96 84 Q86 92 75 79 L36 85 Q17 82 20 68 Q32 71 29 59Z", "#9e5148");
  p("M37 51 Q21 22 44 13 Q66 5 81 23 Q87 37 77 53 Q72 70 87 77 Q75 88 65 71 L42 75 Q26 83 24 71 Q37 75 33 57Z", "#d77f62", null);
  p("M41 17 Q27 30 37 46 M73 22 Q82 39 71 55 Q65 70 80 76", null, "#efa785", 3);
  // Curled turquoise tail and a broad, split translucent fin.
  p("M48 71 Q65 69 71 80 Q73 89 64 95 Q63 102 79 101 L95 95 L103 103 Q90 119 68 116 Q43 114 43 98 Q35 84 48 71Z", "#388e86");
  p("M48 75 Q61 71 64 82 Q63 91 54 95 Q49 107 70 110 Q86 111 96 101", null, "#70c7b0", 7);
  p("M91 99 Q95 87 116 81 Q119 92 108 101 Q122 102 119 114 Q101 116 91 105Z", "#74cbb5");
  p("M98 101 Q109 92 113 86 M99 104 L115 109", null, "#d0ebc4", 2);
  for (const [x,y] of [[47,85],[53,88],[43,93],[47,101],[55,106],[63,109],[73,110],[82,108]])
    p(`M${x-3} ${y} q3 5 6 0`, null, "#c0e1ac", 1.3);
  // Shoulders, arms and a modest shell bodice.
  p("M46 53 L44 63 Q32 62 29 75 Q24 79 22 73 Q23 61 36 57 L43 52Z", "#f3cda8");
  p("M65 53 Q76 55 81 65 L88 64 Q94 65 90 71 Q78 77 71 65 L69 77 Q55 84 43 74 L46 54Z", "#f3cda8");
  p("M44 64 Q46 56 55 64 Q63 55 70 64 L67 71 Q59 74 55 68 Q49 74 43 69Z", "#ad89ae", outline, 2);
  p("M47 62 L51 68 M51 61 L54 66 M63 61 L59 68 M67 62 L64 68", null, "#e3c5db", 1.2);
  p("M44 75 Q55 81 70 76", null, "#e3c783", 3);
  // Face and expressive eyes remain large enough to read on the board.
  p("M41 30 Q54 19 72 29 L73 42 Q72 55 59 59 Q43 57 40 44Z", "#f5d5b4", outline, 2.5);
  p("M38 35 Q34 17 55 17 Q73 16 78 32 L69 36 L64 26 Q56 37 40 39Z", "#ce7158");
  p("M43 30 Q52 21 60 22", null, "#f5b58a", 2.5);
  e(48, 44, 3.3, 4.3, "#284c4c"); e(65, 43, 3.3, 4.3, "#284c4c");
  e(49, 42.5, 1.1, 1.3, "#fff7df"); e(66, 41.5, 1.1, 1.3, "#fff7df");
  p("M44 40 L47 39 M64 38 L68 39 M46 44 L43 42 M67 43 L70 41", null, "#634b43", 1.3);
  e(45, 50, 3.5, 1.8, "#eaa490"); e(69, 49, 3.5, 1.8, "#eaa490");
  p("M54 52 Q58 55 62 51", null, "#b26d61", 1.5);
  // Golden star tiara, pearl earrings and a glowing pearl held in one hand.
  p("M44 20 L48 11 L54 16 L59 6 L63 15 L71 12 L70 22", "#e5c27a", outline, 2);
  e(59, 16, 3, 3, "#83cfbc", outline, 1);
  for (const [x,y] of [[40,47],[74,46],[48,58],[54,60],[60,60],[66,58]]) e(x,y,1.9,2.2,"#fff0cd");
  e(27, 66, 7, 7, "#8ed4c34d"); e(27,65,4.6,4.6,"#fff0ce","#8b9f8b",1.4); e(25.5,63.5,1.5,1.5,"#ffffff");
  p("M15 93 l2 -4 2 4 -2 4Z M108 54 l2 -5 2 5 -2 5Z", "#e9dba2", null);
}
