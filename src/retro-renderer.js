import * as THREE from "three";

/** One extra render pass: subtle phosphor bleed, warm highlights and cool blacks.
 * UVs are not warped, so grid picking stays exact at every zoom and aspect ratio.
 * Scanlines belong to the shared CSS layer, keeping canvas and HUD in register. */
export class RetroRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.material = new THREE.RawShaderMaterial({
      name: "CabinetColorGrade",
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.target.texture },
        resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tScene;
        uniform vec2 resolution;
        varying vec2 vUv;
        #include <colorspace_pars_fragment>
        vec3 sampleScreen(vec2 uv) {
          return sRGBTransferOETF(texture2D(tScene, clamp(uv, 0.0, 1.0))).rgb;
        }
        void main() {
          vec2 edge = vUv * 2.0 - 1.0;
          vec2 px = 1.0 / resolution;
          // Color separation remains below one CSS pixel, strongest at the bezel.
          vec2 fringe = vec2(.38 + dot(edge, edge) * .48, .08) * px;
          vec3 rgb = sampleScreen(vUv);
          rgb.r = sampleScreen(vUv + fringe).r;
          rgb.b = sampleScreen(vUv - fringe).b;
          vec3 bleed = (sampleScreen(vUv + vec2(px.x * 1.5, 0.0))
                      + sampleScreen(vUv - vec2(px.x * 1.5, 0.0))) * .5;
          rgb += max(bleed - .68, 0.0) * .12;
          float luma = dot(rgb, vec3(.299, .587, .114));
          rgb = mix(vec3(luma), rgb, .82);
          rgb = (rgb - .5) * 1.09 + .5;
          rgb = mix(vec3(.045, .044, .075), rgb, .97);
          rgb *= vec3(1.055, 1.015, .92);
          rgb *= 1.0 - smoothstep(.4, 1.65, dot(edge, edge)) * .16;
          gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
        }
      `,
    });
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.screen = new THREE.Scene();
    this.screen.add(new THREE.Mesh(this.geometry, this.material));
    this.camera = new THREE.Camera();
  }
  resize(width, height) {
    // Capped independently from the display DPR to keep the extra pass affordable.
    const ratio = Math.min(this.renderer.getPixelRatio(), 1.5);
    this.target.setSize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
    this.material.uniforms.resolution.value.set(width, height);
  }
  render(scene, camera) {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.screen, this.camera);
  }
  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}

/** Reuse the existing sprites as quiet screen-print silhouettes; no new art assets. */
export function installCabinetPattern(arts) {
  const tile = document.createElement("canvas");
  tile.width = 420;
  tile.height = 320;
  const g = tile.getContext("2d");
  const stamps = [
    ["blue", 65, 60, -.35, 108], ["grunt", 270, 45, .45, 100],
    ["purple", 160, 205, .3, 116], ["green", 365, 235, -.35, 105],
  ];
  for (const [key, x, y, angle, size] of stamps) {
    if (!arts[key]) continue;
    g.save(); g.translate(x, y); g.rotate(angle);
    g.drawImage(arts[key], -size / 2, -size / 2, size, size); g.restore();
  }
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#b4a16b32";
  g.fillRect(0, 0, tile.width, tile.height);
  document.documentElement.style.setProperty("--retro-pattern", `url("${tile.toDataURL()}")`);
}
