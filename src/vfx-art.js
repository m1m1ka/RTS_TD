import * as THREE from "three";
import { createMeleeTextures } from "./melee-vfx-art.js";

// Particle marks use a square pixel grid; melee retains its illustrated arc.
function texture(draw, width = 32, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext("2d");
  const square = (x, y, size, color) => { g.fillStyle = color; g.fillRect(x, y, size, size); };
  draw(square);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  return map;
}
function frame(s, start, end, color, step = 2) {
  for (let p = start; p <= end; p += step) {
    s(p, start, 2, color); s(p, end, 2, color);
    s(start, p, 2, color); s(end, p, 2, color);
  }
}
const cross = (s, color) => {
  for (let p = 6; p <= 22; p += 4) { s(14, p, 4, color); s(p, 14, 4, color); }
};
function chips(s, colors, count = 18, spread = 25) {
  for (let i = 0; i < count; i++) {
    const x = 3 + ((i * 13 + i * i * 3) % spread), y = 3 + ((i * 7 + i * i) % spread);
    s(x, y, 2 + i % 3, colors[i % colors.length]);
  }
}

export function createCombatTextures() {
  return {
    ...createMeleeTextures(),
    square: texture(s => s(0, 0, 32, "#ffffff")),
    dust: texture(s => chips(s, ["#ffffffcc", "#ffffff99", "#ffffff77"], 12)),
    healingTarget: texture(s => { frame(s, 4, 26, "#71e99c", 4); frame(s, 8, 22, "#bcffd555", 4); }),
    healingCross: texture(s => cross(s, "#91ffb7")),
    healing: texture(s => { s(5,5,22,"#285442"); s(7,7,18,"#71ad7c"); cross(s,"#e4ffbf"); }),
    bullet: texture(s => { for(let x=3;x<22;x+=3)s(x,14,3,"#e5c979");s(20,10,12,"#34483f");s(22,12,8,"#dce1b1");s(22,12,3,"#fff9df"); }),
    arrow: texture(s => {
      for(let x=4;x<57;x+=2)s(x,7,2,"#edcf8e");
      for(let i=0;i<4;i++){s(54-i*2,7-i*2,2,"#fff5ce");s(54-i*2,7+i*2,2,"#fff5ce");s(5+i*2,1+i*2,2,"#9fcd8c");s(5+i*2,13-i*2,2,"#9fcd8c");}
    },64,16),
    orb: texture(s => {s(3,3,26,"#bc8bde22");s(7,7,18,"#bc8bde77");s(10,10,12,"#cba5eb");s(13,13,6,"#fff3df");}),
    shield: texture(s => {frame(s,3,27,"#97dbdf");frame(s,6,24,"#b7f1df55",4);s(12,12,8,"#defadf88");}),
    ring: texture(s => {frame(s,4,26,"#ffffff",4);frame(s,7,23,"#ffffff66",4);}),
    spark: texture(s => {s(7,7,18,"#eec87866");s(11,11,10,"#ffe2a1");s(14,14,4,"#fffbea");}),
    coffee: texture(s => {s(7,7,18,"#503e33");s(9,9,14,"#d1a46b");s(12,12,8,"#ffdfa0");}),
    bloodDrop: texture(s => {s(7,7,18,"#e51e2b");s(9,9,6,"#ff4242");}),
    bloodSplash: texture(s => chips(s,["#c91822", "#f02933", "#ff4c45"],16)),
    bloodJet: texture(s => chips(s,["#d51a26", "#f83236"],15)),
    upgrade: texture(s => {frame(s,3,27,"#f6c553");frame(s,6,24,"#fff2b5",4);}),
    upgradeStar: texture(s => {s(7,7,18,"#ffc64d55");s(11,11,10,"#ffda6b");s(14,14,4,"#fffbea");}),
    upgradeGlow: texture(s => {s(1,1,30,"#ffad3022");s(5,5,22,"#ffd15a33");s(10,10,12,"#ffe99d55");}),
    upgradeBeam: texture(s => {
      for(let y=0;y<64;y+=4)for(let x=0;x<16;x+=4){
        const alpha=Math.round((.18+.75*y/64)*(x===4||x===8?1:.35)*255).toString(16).padStart(2,"0");
        s(x,y,4,(x===4||x===8?"#fff8d8":"#ffc84d")+alpha);
      }
    },16,64),
    upgradeArrow: texture(s => {
      for(let row=0;row<3;row++)for(let i=0;i<6;i++){
        const y=4+row*16+i*3;
        s(14-i*2,y,4,"#f6b83f");s(14+i*2,y,4,"#f6b83f");
        s(15-i*2,y,2,"#fff9dc");s(15+i*2,y,2,"#fff9dc");
      }
    },32,64),
  };
}
