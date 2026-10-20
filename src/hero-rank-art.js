import * as THREE from "three";

export function createHeroRankOutline(geometry) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: {value:null}, rank: {value:0}, time: {value:0} },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform sampler2D map; uniform float rank; uniform float time; varying vec2 vUv;
      vec3 rainbow(float h) {
        return clamp(abs(fract(vec3(h)+vec3(0.,.666667,.333333))*6.-3.)-1.,0.,1.);
      }
      void main(){
        float center=texture2D(map,vUv).a;
        float edge=0.;
        for(int i=0;i<12;i++){
          float a=float(i)*6.2831853/12.;
          vec2 sampleUv=vUv+vec2(cos(a),sin(a))*.035;
          if(sampleUv.x>=0.&&sampleUv.x<=1.&&sampleUv.y>=0.&&sampleUv.y<=1.)
            edge=max(edge,texture2D(map,sampleUv).a);
        }
        float alpha=edge*(1.-center);
        if(alpha<.02)discard;
        vec3 color=rank<1.5?vec3(.12,.48,1.):vec3(1.,.68,.08);
        if(rank>2.5)color=mix(rainbow(atan(vUv.y-.5,vUv.x-.5)/6.2831853+time*.15),vec3(1.),.16);
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry,material);
  mesh.visible=false;
  return mesh;
}
export function updateHeroRankOutline(visual, unit, time) {
  const outline=visual.rankOutline;
  if(!outline)return;
  outline.visible=unit.hp>0 && !unit.destroyed && unit.rank>0;
  if(!outline.visible)return;
  outline.material.uniforms.map.value=visual.sprite.material.map;
  outline.material.uniforms.rank.value=unit.rank;
  outline.material.uniforms.time.value=time;
  outline.position.copy(visual.sprite.position);outline.position.z-=.006;
  outline.rotation.copy(visual.sprite.rotation);outline.scale.copy(visual.sprite.scale);
}
