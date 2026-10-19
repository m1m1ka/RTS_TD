import * as THREE from "three";

export const BLOOD_SPREAD_DURATION = .35;

// Once spread has finished, retain the generated pigment in a texture. Reusing
// that result avoids re-evaluating procedural noise on every combat frame.
export function freezeBloodStain(mesh, renderer, layers = []) {
  const target = new THREE.WebGLRenderTarget(192, 192, { depthBuffer: false, stencilBuffer: false });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  target.texture.generateMipmaps = true;
  target.texture.minFilter = THREE.LinearMipmapLinearFilter;
  const camera = new THREE.OrthographicCamera(-.75, .75, .75, -.75, .1, 10);
  camera.position.set(mesh.position.x, mesh.position.y, 5);
  const scene = new THREE.Scene();
  // Composite old pigment and newly settled splashes in order. Keep a single
  // ground mesh/texture per cell instead of accumulating permanent draw calls.
  for (const [order, source] of [mesh, ...layers].entries()) {
    const copy = source.clone();
    copy.renderOrder = order;
    scene.add(copy);
  }
  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(new THREE.Color()), previousAlpha = renderer.getClearAlpha();
  const previousViewport = renderer.getViewport(new THREE.Vector4()), previousScissor = renderer.getScissor(new THREE.Vector4());
  const previousScissorTest = renderer.getScissorTest();
  try {
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
  } catch (error) {
    target.dispose();
    throw error;
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);
    renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
    renderer.setClearColor(previousColor, previousAlpha);
  }
  const material = new THREE.MeshBasicMaterial({ map: target.texture, transparent: true, depthWrite: false, premultipliedAlpha: true, toneMapped: false });
  // The transparent target already contains premultiplied color; undo it when
  // sampling before Three.js applies its normal premultiplied-alpha output.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      #include <map_fragment>
      if (diffuseColor.a > .001) diffuseColor.rgb /= diffuseColor.a;
    `);
  };
  material.customProgramCacheKey = () => "settled-blood-v1";
  mesh.material.dispose();
  mesh.material = material;
  return target;
}

// Ground-space pigment, with a different fluid boundary for every impact.
// No image or reusable silhouette: noise and seeded droplets define coverage.
export function bloodStainMaterial(direction, offset = new THREE.Vector2()) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      seed: { value: Math.random() * 1000 },
      age: { value: 0 },
      intensity: { value: 1 },
      direction: { value: direction },
      offset: { value: offset },
      red: { value: new THREE.Color("#ed1828") },
      deepRed: { value: new THREE.Color("#bc0b19") },
    },
    vertexShader: `
      varying vec2 stainUV;
      varying vec2 ground;
      void main() {
        stainUV = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        ground = world.xy;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float seed;
      uniform float age;
      uniform float intensity;
      uniform vec2 direction;
      uniform vec2 offset;
      uniform vec3 red;
      uniform vec3 deepRed;
      varying vec2 stainUV;
      varying vec2 ground;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1)), f.x), f.y);
      }
      void main() {
        // Shoreline deaths stain the sand, never draw a square over the sea.
        if (abs(ground.x) > 7.5 || abs(ground.y) > 5.5) discard;
        vec2 p = stainUV - .5 - offset;
        float spread = mix(.64, 1.0, smoothstep(0.0, .35, age));
        p /= spread;
        vec2 warp = vec2(noise(p * 9.0), noise(p * 9.0 + 53.0)) - .5;
        vec2 q = p + warp * .13;
        float field = 1.0;
        // Offset, overlapping pools coalesce into an asymmetric stain.
        for (int i = 0; i < 4; i++) {
          float k = float(i);
          vec2 center = vec2(hash(vec2(k,3)), hash(vec2(k,7))) - .5;
          center *= .28;
          center += direction * .035 * k;
          float radius = .12 + hash(vec2(k,11)) * .09;
          field = min(field, length(q - center) - radius);
        }
        // Detached droplets follow the hit direction, with per-stain variation.
        for (int i = 0; i < 9; i++) {
          float k = float(i);
          vec2 center = (vec2(hash(vec2(k,19)), hash(vec2(k,23))) - .5) * .75;
          center += direction * .06;
          float radius = .012 + hash(vec2(k,29)) * .025;
          field = min(field, length(q - center) - radius);
        }
        float grain = noise(p * 85.0);
        float edge = field + (noise(p * 28.0) - .5) * .027;
        float coverage = 1.0 - smoothstep(-.007, .018, edge);
        // Transparent pigment lets the sand and its grid texture show through.
        float alpha = coverage * (.66 + grain * .16) * min(1.15, intensity);
        alpha *= 1.0 - smoothstep(.44, .5, max(abs(stainUV.x - .5), abs(stainUV.y - .5)));
        if (alpha < .01) discard;
        vec3 color = mix(red, deepRed, clamp(-field * 2.0 + noise(p * 15.0) * .25, 0.0, .65));
        gl_FragColor = vec4(color, min(.94, alpha));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
