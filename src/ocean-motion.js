// Deform only the sea's texture coordinates; the board and shoreline stay fixed.
// The texture is uploaded once. Animation updates a single GPU uniform each frame.
export class OceanMotion {
  constructor(material) {
    this.time = { value: 0 };
    material.onBeforeCompile = shader => {
      shader.uniforms.oceanTime = this.time;
      shader.fragmentShader = "uniform float oceanTime;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
        #ifdef USE_MAP
          vec2 waterUv = vMapUv;
          waterUv.x += oceanTime * .013
            + sin(vMapUv.y * 31.0 + oceanTime * .9) * .008
            + sin(vMapUv.y * 13.0 - oceanTime * .6) * .004;
          waterUv.y += oceanTime * .002
            + sin(vMapUv.x * 19.0 - oceanTime * 1.1) * .003;
          vec4 water = texture2D(map, waterUv);
          float light = sin(vMapUv.x * 9.0 + vMapUv.y * 5.0 - oceanTime * .8);
          water.rgb *= 1.0 + light * .055;
          diffuseColor *= water;
        #endif
      `);
    };
    material.customProgramCacheKey = () => "ocean-flow-v1";
    material.needsUpdate = true;
  }
  update(dt) {
    if (dt > 0) this.time.value += dt;
  }
}
