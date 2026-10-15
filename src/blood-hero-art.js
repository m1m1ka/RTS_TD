// Forest-green ink, parchment faces and muted oxblood accents; 128px native tokens.
// Handheld ranged weapons are rendered separately by WeaponRig.
export function drawBloodHero(g, type, { shape, rounded, ellipse, line, ink }) {
  const blood = "#98665e", dark = "#73545a", bone = "#e4d5b1", steel = "#a2afa0";
  const poly = (points, fill, width = 5) => shape(g, points, fill, ink, width);
  const mark = (points, color = ink, width = 4) => line(g, points, color, width);
  const box = (x, y, w, h, color, r = 5, width = 4) => rounded(g, x, y, w, h, r, color, ink, width);
  const oval = (x, y, rx, ry, color, width = 4) => {
    ellipse(g, x, y, rx, ry, color); g.strokeStyle = ink; g.lineWidth = width; g.stroke();
  };
  const robe = (color, wide = false) => poly([[42,70],[wide?25:33,102],[wide?102:92,102],[84,70]],color);
  const face = () => { box(43,47,42,34,bone,7); mark([[54,59],[54,66]]); mark([[74,59],[74,66]]); };
  const drop = (x,y,color=blood) => poly([[x,y-8],[x+6,y+1],[x+4,y+7],[x-4,y+7],[x-6,y+1]],color,3);
  const belt = () => { box(39,88,50,9,"#82735c",2,3); box(58,86,13,13,"#c9b585",2,3); };
  if (type === "ragebear") {
    // Broad low body, rounded ears and a short muzzle distinguish a bear from a wolf.
    poly([[32,65],[21,82],[24,103],[45,108],[83,108],[105,102],[108,82],[96,64]],"#82755d");
    oval(34,33,12,13,"#958269"); oval(94,33,12,13,"#958269");
    ellipse(g,34,34,6,7,"#be9e80"); ellipse(g,94,34,6,7,"#be9e80");
    poly([[34,42],[44,32],[84,32],[98,45],[103,67],[96,76],[102,84],[83,84],[77,93],[63,87],[48,93],[44,83],[27,83],[32,73],[26,62]],"#9d8669");
    poly([[43,38],[54,32],[69,33],[62,43],[49,48]],"#b29a78",3);
    mark([[39,54],[54,59]],ink,5); mark([[74,59],[89,53]],ink,5);
    mark([[44,62],[51,63]],"#dfbe88",3); mark([[78,63],[85,61]],"#dfbe88",3);
    oval(64,75,22,15,"#c7ad86");
    poly([[56,67],[72,67],[68,75],[61,75]],ink,3);
    poly([[48,79],[62,82],[79,78],[75,89],[55,91]],"#4e5143",3);
    poly([[52,81],[58,82],[56,88]],bone,2); poly([[70,82],[76,81],[72,88]],bone,2);
    mark([[81,43],[77,51]],blood,3); mark([[88,44],[84,51]],blood,3);
    box(20,87,24,19,"#8a795f",7); box(84,87,24,19,"#8a795f",7);
    for (const x of [24,32,40,88,96,104]) mark([[x,100],[x-1,105]],bone,3);
    poly([[45,92],[62,96],[82,91],[80,101],[62,106],[47,101]],blood,3);
  } else if (type === "bloodknight") {
    poly([[34,62],[23,103],[54,99],[66,108],[103,101],[91,61]],dark);
    robe("#8b9990",true);
    poly([[34,47],[43,30],[63,24],[85,32],[94,48],[89,77],[65,86],[38,77]],steel);
    poly([[51,29],[49,17],[62,12],[82,18],[74,32]],blood,4);
    poly([[40,52],[87,52],[82,68],[65,75],[45,68]],"#43584b",4);
    mark([[49,57],[56,59]],bone,4); mark([[73,59],[80,56]],bone,4);
    poly([[61,33],[68,33],[70,78],[63,84],[58,76]],"#bbc2ac",3);
    poly([[84,74],[98,70],[106,83],[85,88]],blood,4);
    belt();
    poly([[22,75],[40,70],[58,76],[54,99],[40,110],[25,100]],"#9d7770",4);
    poly([[29,81],[40,77],[51,82],[48,97],[40,103],[31,96]],"#c1aa8b",3);
    drop(40,89);
  } else if (type === "frenzyaxe") {
    robe("#9b7960",true);
    // Two compact axes frame the head without obscuring the face.
    for (const side of [-1,1]) {
      const x=64+side*37;
      mark([[x,51],[x-side*4,104]],ink,7); mark([[x,51],[x-side*4,103]],"#a88c62",3);
      poly([[x,48],[x+side*16,40],[x+side*18,57],[x+side*10,69],[x,61]],steel,4);
      mark([[x+side*12,49],[x+side*13,56]],blood,3);
    }
    face();
    poly([[33,51],[34,34],[44,37],[45,21],[57,29],[66,13],[74,30],[90,22],[88,42],[97,52],[79,52],[69,41],[55,48],[46,58]],"#ab7859");
    mark([[42,54],[85,54]],blood,6);
    mark([[49,59],[57,62]],ink,3); mark([[71,62],[80,59]],ink,3);
    poly([[45,75],[55,82],[62,79],[68,83],[81,75],[76,91],[64,100],[50,91]],"#926b50",4);
    mark([[47,77],[40,90]],bone,5); mark([[81,77],[88,90]],bone,5);
    belt();
  } else if (type === "bloodseer") {
    robe("#886b77",true);
    poly([[31,68],[39,35],[63,18],[89,36],[99,69],[86,90],[38,90]],dark);
    poly([[40,61],[45,43],[64,31],[83,44],[89,64],[80,80],[45,81]],"#b28c8c",4);
    face();
    poly([[44,65],[63,70],[85,65],[79,84],[63,92],[48,83]],"#c0a59a",4);
    mark([[50,74],[76,74]],"#94757b",3);
    drop(64,40,"#bc8c70");
    poly([[40,83],[48,81],[55,103],[40,105]],"#d2bc9b",3);
    poly([[81,82],[89,86],[89,104],[74,103]],"#d2bc9b",3);
    // Ritual cup is a costume emblem; the actual attacking staff is independent.
    poly([[52,85],[76,85],[73,96],[64,100],[55,95]],"#c5ae78",3);
    mark([[64,100],[64,107]],ink,4); mark([[57,108],[71,108]],"#bba579",4);
    mark([[56,88],[72,88]],blood,4);
  } else if (type === "thornmartyr") {
    robe("#b9b194",true);
    poly([[34,60],[40,35],[64,25],[88,38],[94,65],[85,88],[39,86]],"#d5cbb0");
    face();
    box(40,45,48,14,"#e0d6b9",3,3); mark([[46,49],[80,55]],"#aaa58b",2.5);
    // A crooked thorn wreath, with large points legible at sidebar scale.
    mark([[33,42],[45,35],[60,38],[75,33],[94,42]],ink,8);
    mark([[33,42],[45,35],[60,38],[75,33],[94,42]],"#8b9572",4);
    for (const [x,y] of [[38,39],[54,36],[74,34],[88,39]]) poly([[x-3,y],[x-5,y-10],[x+4,y-1]],"#9ca47c",2.5);
    mark([[78,61],[76,69]],blood,3);
    poly([[40,79],[48,77],[83,101],[75,105]],"#e0d3b2",3);
    poly([[82,78],[88,85],[49,105],[42,100]],"#c2b294",3);
    mark([[55,86],[59,82]],"#96917b",2); mark([[72,99],[76,95]],"#96917b",2);
    drop(64,90,"#9b7062");
  } else if (type === "redhunter") {
    // Back quiver is clothing; bow remains an independently aimed weapon.
    poly([[86,48],[98,43],[107,92],[92,100]],"#82705b",4);
    for (const x of [87,95]) { mark([[x,49],[x-3,24]],ink,4); poly([[x-3,28],[x-9,18],[x-1,20],[x+1,28]],bone,2.5); }
    poly([[36,64],[26,102],[46,98],[61,107],[90,100],[85,65]],dark);
    robe("#8d8178");
    poly([[30,59],[39,34],[63,23],[87,36],[96,59],[87,81],[39,82]],"#786c71");
    face();
    poly([[32,52],[44,35],[64,25],[85,39],[93,55],[70,44],[52,55]],"#9b7774",4);
    poly([[40,67],[63,72],[86,66],[80,83],[61,88],[43,79]],blood,4);
    poly([[82,77],[108,82],[99,89],[111,95],[86,92]],"#b58c7c",4);
    poly([[41,83],[49,80],[84,100],[77,106]],"#c2aa85",3);
    box(47,90,13,14,"#b4ad8e",3,3);
  } else if (type === "candlekeeper") {
    robe("#aba78b",true);
    poly([[32,69],[40,40],[63,29],[87,40],[96,72],[84,90],[40,90]],"#7d8270");
    face();
    poly([[35,48],[48,36],[79,36],[93,49],[88,58],[40,58]],"#c7c4a5",4);
    // A three-candle wax crown; symbolic offering rather than an oversized spell effect.
    for (const [x,y,h] of [[46,27,17],[64,17,25],[82,29,16]]) {
      box(x-5,y,10,h,"#e5d8b6",3,3);
      poly([[x,y-14],[x+5,y-6],[x+3,y-1],[x-3,y-1],[x-5,y-6]],"#c99b66",2.5);
    }
    mark([[62,25],[62,35]],"#bbb697",2);
    poly([[43,80],[53,79],[62,104],[44,104]],blood,3);
    poly([[74,79],[85,82],[82,104],[67,104]],blood,3);
    box(50,83,29,23,"#c9c4a4",3,3);
    mark([[64,87],[64,101]],"#8b926f",3);
    drop(64,93,"#b68a64");
  } else if (type === "chainbreaker") {
    robe("#827d69",true);
    poly([[30,75],[43,70],[47,92],[27,101],[20,92]],"#c5ae88",4);
    poly([[85,70],[100,76],[109,93],[99,103],[81,92]],"#c5ae88",4);
    face();
    poly([[35,52],[37,33],[49,38],[55,23],[65,32],[80,25],[89,40],[94,51],[78,50],[65,44],[50,54]],"#727b66");
    box(38,53,51,12,"#b5baaa",3,3);
    mark([[48,59],[56,59]],ink,3); mark([[73,59],[81,59]],ink,3);
    mark([[78,68],[75,74]],blood,3);
    // Broken shackles and a split chain give the silhouette its identity.
    box(20,85,25,15,steel,4); box(84,85,25,15,steel,4);
    oval(24,102,5,6,"#aeb6a4",3); oval(104,102,5,6,"#aeb6a4",3);
    mark([[45,88],[53,91],[57,87]],ink,5); mark([[72,87],[77,92],[84,88]],ink,5);
    poly([[41,78],[48,75],[88,99],[80,105]],blood,3);
    box(58,94,14,11,"#b4a079",2,3);
  } else return false;
  return true;
}
