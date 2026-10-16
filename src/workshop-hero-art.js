// Native paper-token art: forest ink, cream faces, sage steel and weathered brass.
// Tools identify the profession; actual ranged weapons remain in WeaponRig.
export function drawWorkshopHero(g, type, { shape, rounded, ellipse, line, ink }) {
  const cream = "#e8d9b4", steel = "#a9b8a5", brass = "#c7ae78", leather = "#998064";
  const poly = (points, fill, width=5) => shape(g, points, fill, ink, width);
  const mark = (points, color=ink, width=4) => line(g, points, color, width);
  const box = (x,y,w,h,color,r=5,width=4) => rounded(g,x,y,w,h,r,color,ink,width);
  const oval = (x,y,rx,ry,color,width=4) => { ellipse(g,x,y,rx,ry,color);g.strokeStyle=ink;g.lineWidth=width;g.stroke(); };
  const face = () => { box(42,47,44,34,cream,7);mark([[54,60],[54,67]]);mark([[74,60],[74,67]]); };
  const coat = (color) => poly([[42,70],[29,102],[98,102],[84,70]],color);
  const rivet = (x,y) => ellipse(g,x,y,2,2,ink);
  if (type === "gearengineer") {
    // A rolled blueprint and tool backpack make the silhouette read from a distance.
    box(83,57,18,42,leather,4);
    box(88,43,12,40,"#dbd5b3",4,3); oval(94,44,6,4,"#a7b397",3);
    mark([[91,54],[96,54]],"#7b9588",2);
    coat("#82978a");face();
    poly([[31,48],[37,29],[50,22],[78,22],[91,33],[96,49]],brass);
    box(30,46,67,12,"#b29f71",4);
    poly([[59,24],[69,24],[72,45],[57,45]],"#e0ce99",3);
    mark([[39,43],[89,43]],"#7b7557",4);
    box(37,39,22,18,"#a8c4b1",6);box(68,39,22,18,"#a8c4b1",6);
    mark([[60,47],[67,47]],ink,4);
    mark([[43,46],[49,43]],"#e7e7c4",3);mark([[74,46],[80,43]],"#e7e7c4",3);
    poly([[43,78],[51,78],[54,103],[44,103]],leather,3);
    poly([[77,78],[85,78],[84,103],[74,103]],leather,3);
    box(48,86,30,17,"#b5b494",3,3);rivet(53,90);rivet(73,90);
    box(29,86,17,18,leather,3,3);mark([[36,89],[36,99]],steel,4);
  } else if (type === "rivetbot") {
    // Heavy square shoulders, short piston legs and a broad bolted faceplate.
    box(40,91,18,18,"#71897a",3);box(71,91,18,18,"#71897a",3);
    box(33,103,26,8,"#a4b29c",3,3);box(70,103,26,8,"#a4b29c",3,3);
    box(33,65,62,35,"#82998b",7);
    box(19,65,21,18,steel,5);box(89,65,21,18,steel,5);
    box(20,83,18,22,"#8b9c8c",5);box(91,83,18,22,"#8b9c8c",5);
    mark([[25,94],[33,94]],ink,3);mark([[96,94],[104,94]],ink,3);
    mark([[64,29],[64,17]],ink,5);oval(64,15,5,5,brass,3);
    box(30,30,68,43,steel,9);
    box(38,41,52,22,"#3c5849",5,3);
    box(46,47,11,10,"#e1d6a0",2,2);box(72,47,11,10,"#e1d6a0",2,2);
    for (const [x,y] of [[35,36],[93,36],[35,67],[93,67]])rivet(x,y);
    box(53,67,22,6,"#758879",2,2);
    oval(64,85,12,11,brass,3);oval(64,85,5,5,"#708c79",2);
    mark([[46,78],[46,94]],"#b9c4a6",3);mark([[83,78],[83,94]],"#b9c4a6",3);
  } else if (type === "wrenchsmith") {
    coat("#78907a");face();
    poly([[32,50],[38,32],[53,27],[78,29],[88,41],[89,51]],"#8da58a");
    poly([[31,49],[77,45],[96,49],[88,57],[38,58]],"#a9b698",4);
    box(52,32,19,10,"#c5c5a0",3,3);
    poly([[52,73],[58,70],[64,74],[70,70],[78,73],[73,79],[65,78],[57,80]],"#796e51",3);
    poly([[45,81],[53,79],[55,94],[74,94],[77,79],[85,81],[84,105],[44,105]],"#b1b69b",4);
    box(54,88,22,13,"#8da18b",2,3);rivet(49,84);rivet(80,84);
    // Oversized open-ended spanner is fixed costume art for this melee preset.
    poly([[25,48],[20,36],[24,25],[29,37],[36,37],[39,25],[44,36],[39,49],[37,97],[26,97]],steel,4);
    oval(32,96,4,4,"#748873",2);
    oval(34,77,7,6,cream,3);
    box(84,91,23,17,leather,3,3);mark([[89,91],[90,86],[101,86],[102,91]],ink,3);
  } else if (type === "sparkwelder") {
    // Raised shoulder tank, heavy gloves and a dark rectangular welding visor.
    box(83,44,22,50,"#92a18e",8);box(88,38,12,10,brass,3,3);
    mark([[103,65],[112,77],[109,91],[98,96]],ink,6);
    mark([[103,65],[112,77],[109,91],[98,96]],"#a39878",2.5);
    coat("#8c8b75");
    poly([[41,76],[50,75],[78,75],[88,79],[86,106],[42,106]],leather,4);
    box(48,86,31,17,"#c0a47d",3,3);rivet(52,90);rivet(75,90);
    poly([[34,38],[45,27],[79,27],[94,40],[91,71],[79,84],[46,82],[33,68]],"#9caa96");
    box(39,42,49,23,"#3e5c4e",4);
    poly([[44,47],[63,47],[53,59],[44,59]],"#9bbca8",2);
    mark([[67,48],[80,48]],"#c4d3ae",3);
    mark([[50,72],[73,72]],"#617f6c",4);
    rivet(39,35);rivet(86,35);
    box(26,82,20,20,"#c5af84",5);box(84,84,21,19,"#c5af84",5);
    mark([[28,91],[20,78],[24,69]],ink,7);mark([[28,91],[20,78],[24,69]],brass,3);
    poly([[24,66],[18,61],[22,55],[29,61]],"#d7b777",3);
  } else if (type === "windupbot") {
    // Tiny round clockwork companion, with an unmistakable winding key.
    mark([[87,63],[105,45]],ink,7);mark([[88,62],[105,45]],brass,3);
    oval(102,36,8,8,brass,3);oval(113,46,8,8,brass,3);
    ellipse(g,102,36,3,3,"#eef0d6");ellipse(g,113,46,3,3,"#eef0d6");
    poly([[47,88],[46,100],[39,104],[51,109],[58,99],[59,90]],"#a4ae91",4);
    poly([[71,90],[72,100],[80,109],[92,105],[83,100],[82,88]],"#a4ae91",4);
    box(36,70,57,27,"#abb49b",7);
    oval(29,80,8,10,brass,3);oval(99,80,8,10,brass,3);
    oval(64,49,30,29,"#c6b47f",5);
    oval(64,50,23,21,"#e1d5af",4);
    mark([[53,47],[53,54]],ink,4);mark([[75,47],[75,54]],ink,4);
    mark([[59,61],[64,63],[69,60]],"#71836b",3);
    box(55,19,19,8,"#81967c",3,3);mark([[64,19],[64,13]],ink,4);
    oval(64,82,11,11,"#e0c994",3);
    mark([[64,75],[64,82],[70,85]],"#64836d",3);
    for(const [x,y] of [[40,45],[88,45],[49,76],[79,76]])rivet(x,y);
  } else return false;
  return true;
}
