import * as THREE from "three";
import { boatPosition, BOAT_SLOTS } from "./sea-arrivals.js";

function boatArt() {
  // Local bow points up; rotate the 1 × 4 hull to match its approach direction.
  const w = 1, h = BOAT_SLOTS;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256 * h;
  const g = canvas.getContext("2d"); g.scale(256, 256);
  g.lineCap = "round"; g.lineJoin = "round";
  const points = [[.04,.65],[.5,.025],[.96,.65],[.94,h-.28],[.78,h-.025],[.22,h-.025],[.06,h-.28]];
  const hull = () => { g.beginPath(); points.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y));g.closePath(); };
  hull(); g.strokeStyle="#b4e2d4";g.lineWidth=.075;g.stroke();
  hull();g.fillStyle="#ae8756";g.fill();g.strokeStyle="#203c30";g.lineWidth=.05;g.stroke();
  g.save();hull();g.clip();
  g.fillStyle="#d4b783";g.fillRect(.12,.16,.76,h-.32);
  for (let y=.25;y<h;y+=.25) {g.strokeStyle="#997b50";g.lineWidth=.015;g.beginPath();g.moveTo(.1,y);g.lineTo(.9,y);g.stroke();}
  for (let slot=0;slot<BOAT_SLOTS;slot++) {
    const y=.5+slot;
    g.fillStyle="#705e42";g.fillRect(.1,y,.8,.1);
    g.fillStyle="#e6cd96";g.fillRect(.1,y,.8,.025);
    for (const x of [.12,.85]) {g.fillStyle="#203c30";g.fillRect(x,y-.13,.03,.12);}
  }
  g.restore();hull();g.strokeStyle="#e8d2a0";g.lineWidth=.014;g.stroke();
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return { texture, w, h };
}

export class BoatVisuals {
  constructor(scene, pos) { this.scene=scene;this.pos=pos;this.items=new Map(); }
  update(game, dt) {
    const live = new Set(game.boats.map(b=>b.id));
    for (const [id, v] of this.items) if (!live.has(id)) {
      this.scene.remove(v.mesh);v.mesh.geometry.dispose();v.mesh.material.dispose();v.texture.dispose();this.items.delete(id);
    }
    for (const boat of game.boats) {
      let v=this.items.get(boat.id);
      if (!v) {
        const art=boatArt(boat);
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(art.w,art.h),new THREE.MeshBasicMaterial({map:art.texture,transparent:true,depthWrite:false}));
        this.scene.add(mesh);v={mesh,texture:art.texture};this.items.set(boat.id,v);
      }
      const anchor=boatPosition(boat);
      const x=anchor.x-boat.dx*(BOAT_SLOTS-1)/2, y=anchor.y-boat.dy*(BOAT_SLOTS-1)/2;
      v.mesh.rotation.z = Math.atan2(-boat.dy, boat.dx) - Math.PI/2;
      v.mesh.position.copy(this.pos(x,y,.35));
    }
  }
  reset() { this.update({boats:[]},0); }
}
