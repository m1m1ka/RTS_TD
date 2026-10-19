// Match emberblade and blue: the same primitives, ink, 5 px outlines,
// large angular heads, short coat bodies and a restrained parchment palette.
export function drawPirate(g, type, portrait, { shape, rounded, ellipse, line, ink }) {
  const poly = (pts, color, width = 5) => shape(g, pts, color, ink, width);
  const mark = (pts, color = ink, width = 4) => line(g, pts, color, width);
  const box = (x, y, w, h, color, r = 5, width = 4) => rounded(g, x, y, w, h, r, color, ink, width);
  const heavy = type === "pirate_heavy", captain = type === "pirate_captain";
  const cannon = type === "pirate_cannon", medic = type === "pirate_medic", shield = type === "pirate_shield";
  const coat = captain ? "#825d61" : heavy ? "#718780" : medic ? "#a5b397" : shield ? "#698b82" : "#a77559";
  const tile = captain ? "#b49a87" : heavy ? "#a5b1a1" : medic ? "#b8c2a1" : shield ? "#9aafa0" : "#c39d7b";
  ellipse(g, 65, 115, 45, 9, "#102f2555");
  if (!portrait) {
    rounded(g, 10, 12, 108, 104, 18, "#674e42", ink, 5);
    rounded(g, 12, 8, 103, 103, 14, tile, "#ead9af", 5);
    mark([[23,19],[42,16],[51,18],[72,16]], "#f3e5bf", 3);
    rounded(g, 21, 86, 88, 18, 7, coat, null);
  }
  ellipse(g, 65, 100, 34, 7, "#19312855");
  // Compact trapezoid torso, short sleeves; no long legs or round head.
  poly([[42,72],[heavy ? 24 : 32,101],[heavy ? 102 : 92,101],[84,71]], coat);
  poly([[43,79],[56,83],[63,98],[48,96]], "#d9cb9f", 3);
  poly([[83,79],[70,83],[63,98],[78,96]], "#c5b98d", 3);
  mark([[42,95],[85,95]], "#655a40", 5);
  box(58, 90, 12, 10, "#d2b477", 2, 3);
  poly([[29,77],[42,73],[45,90],[24,95]], heavy ? "#9cafa0" : coat);
  if (!cannon) poly([[83,74],[98,78],[104,95],[81,90]], heavy ? "#9cafa0" : coat);

  if (heavy) {
    // A broad helmet and skull-like visor echo the original blue hero.
    poly([[28,57],[34,35],[48,25],[80,25],[96,39],[101,61],[91,82],[37,82]], "#819a8f");
    poly([[36,51],[43,35],[63,28],[63,49]], "#b5c3ad", 3);
    poly([[37,57],[52,53],[64,60],[78,54],[92,57],[87,76],[76,80],[72,88],[54,87],[51,78],[40,74]], "#d5d4b0", 4);
    poly([[44,62],[56,64],[55,71],[44,70]], "#354e43", 2);
    poly([[72,64],[84,61],[84,70],[74,71]], "#354e43", 2);
    mark([[64,76],[64,82]], ink, 3);
    poly([[23,72],[39,70],[45,91],[24,97],[18,87]], "#95aa9b");
    poly([[88,71],[103,74],[111,89],[88,94]], "#95aa9b");
    mark([[96,83],[102,108]], ink, 9); mark([[96,83],[102,108]], "#ae9369", 4);
    poly([[85,76],[110,70],[115,87],[91,93]], "#667f76", 4);
    mark([[94,77],[106,75]], "#c0c7a9", 3);
    // A red tied cloth identifies the helmeted brute as part of the pirate crew.
    poly([[85,38],[97,40],[105,56],[93,52]], "#a66f59", 3);
    return;
  }

  // Hair silhouette follows the reference hero's chunky angular outline.
  poly([[33,55],[37,36],[48,30],[72,28],[90,38],[96,57],[91,78],[35,79]], cannon ? "#658c8d" : "#806c4e");
  if (cannon) {
    poly([[37,55],[52,51],[64,58],[78,52],[92,55],[87,74],[76,78],[72,85],[55,85],[52,77],[41,73]], "#ede0b4", 4);
    ellipse(g, 51, 63, 5, 6, ink); ellipse(g, 78, 63, 5, 6, ink);
    mark([[64,74],[64,79]], ink, 3);
  } else {
    box(42, 48, 44, 35, "#eadbb6", 8);
    mark([[53,61],[53,67]]); mark([[74,61],[74,67]]);
  }
  if (captain) {
    // Oversized tricorn, angular brim and pale skull badge.
    poly([[25,49],[30,26],[46,32],[64,18],[82,31],[100,25],[105,49],[86,56],[43,55]], "#526b66");
    mark([[32,43],[35,33],[48,39],[64,26],[81,38],[95,33],[98,43]], "#c5ae78", 3);
    poly([[57,35],[64,32],[72,36],[70,44],[66,45],[65,49],[61,48],[59,44],[56,42]], "#e4d8ad", 2.5);
    ellipse(g, 61, 39, 1.8, 2, ink); ellipse(g, 67, 39, 1.8, 2, ink);
    poly([[89,31],[98,14],[110,12],[106,27],[99,32]], "#b7785d", 3);
    mark([[45,55],[81,65]], ink, 3);
    box(46, 58, 14, 12, "#354b3d", 3, 3);
    poly([[43,73],[54,77],[64,72],[75,76],[86,72],[80,87],[65,95],[49,86]], "#766146", 4);
    mark([[56,81],[65,84],[73,80]], "#b49b70", 3);
    poly([[29,78],[42,75],[44,83],[27,85]], "#d4b67a", 3);
    poly([[84,75],[99,79],[102,85],[84,83]], "#d4b67a", 3);
  } else {
    poly([[33,49],[39,30],[55,25],[78,29],[92,46],[80,52],[60,45],[43,55]], medic ? "#c7cbaa" : cannon ? "#9d7b5b" : "#ac785b");
    mark([[42,45],[80,44]], medic ? "#e7dfb7" : "#d6b582", 4);
    poly([[87,44],[99,48],[94,57],[103,63],[88,62]], medic ? "#a7b895" : "#996a52", 3);
    if (medic) {
      // Pale headwrap and square mouth cloth, with a sea-green medical badge.
      mark([[62,30],[62,41]], "#608776", 4); mark([[57,35],[67,35]], "#608776", 4);
      box(45, 70, 38, 12, "#c6d0af", 3, 3);
      mark([[53,76],[75,76]], "#90a48b", 2);
    } else if (!cannon) {
      mark([[44,52],[83,64]], ink, 3);
      box(46, 57, 14, 12, "#354b3d", 3, 3);
      ellipse(g, 88, 69, 4, 5, "#d8bd7f");
    }
  }
  if (cannon) {
    // Chunky wheeled cannon occupies the compact lower half of the tile.
    poly([[31,88],[86,84],[101,100],[28,101]], "#a88b5d", 4);
    poly([[54,72],[66,63],[99,80],[87,99],[49,81]], "#6c8881", 4);
    mark([[61,71],[87,84]], "#b2c3a5", 4);
    ellipse(g, 94, 89, 13, 11, ink); ellipse(g, 94, 88, 9, 7, "#9db4a3"); ellipse(g, 95, 89, 6, 5, "#344e43");
    for (const x of [37,68]) { ellipse(g,x,100,10,10,ink);ellipse(g,x,100,6,6,"#ba9d69");ellipse(g,x,100,2,2,ink); }
    mark([[50,77],[41,69],[43,61]], "#c8a468", 3);
  } else if (shield) {
    poly([[21,66],[40,60],[58,67],[54,91],[39,105],[22,94]], "#b79b65");
    poly([[27,70],[40,66],[51,71],[48,88],[39,97],[28,89]], "#6d8c7f", 3);
    mark([[39,69],[39,93]], "#c5bc8d", 3);
    poly([[34,79],[44,79],[46,87],[39,91],[33,87]], "#d4c18a", 3);
  } else if (medic) {
    box(22, 83, 29, 22, "#d9d1a8", 4, 4);
    mark([[31,81],[31,77],[43,77],[43,81]], ink, 3);
    mark([[36,88],[36,100]], "#668d78", 4); mark([[30,94],[42,94]], "#668d78", 4);
    box(91, 78, 14, 23, "#93b7a0", 4, 3); box(93,74,10,7,"#cbb581",2,3);
    mark([[96,86],[96,94]], "#dce0b5", 2);
  } else {
    poly([[91,88],[103,68],[108,61],[108,80],[99,97]], "#bbccc0", 4);
    mark([[86,91],[103,98]], "#c8ab72", 5);
    mark([[93,96],[89,104]], ink, 6);
  }
}
