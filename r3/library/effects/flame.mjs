// A flame as a camera-facing sheet whose shape is drawn by a small shader: a teardrop eaten by rising noise, white-hot
// at the core, orange, then red at the edge. `power` 0..1.4 is its height; `time` makes it lick upward.
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime; uniform float uPower; uniform float uGain; uniform float uSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  float y = vUv.y;
  float x = (vUv.x - 0.5) * 2.0;
  float t = uTime + uSeed * 7.0;
  x += (fbm(vec2(y * 2.2 - t * 1.7, t * 0.6 + uSeed)) - 0.5) * 0.7 * y;
  // several tongues: the height differs across the sheet and changes with time
  float h = min(0.94, max(uPower, 0.02) * (0.5 + 0.7 * fbm(vec2(x * 2.2 + uSeed * 5.0, t * 1.3))));
  float yy = y / h;
  float width = max(0.0, 1.0 - yy * yy) * (0.92 - 0.35 * yy);
  float body = 1.0 - abs(x) / max(width, 0.001);
  float n = fbm(vec2(x * 2.6 + uSeed * 3.0, y * 3.2 - t * 2.8));
  body -= (n - 0.3) * (0.9 + 1.9 * yy);
  body *= smoothstep(0.0, 0.07, y) * (1.0 - smoothstep(0.86, 0.99, y)); // never cut by the sheet's own edge
  float a = smoothstep(0.0, 0.45, body);
  vec3 col = mix(vec3(0.9, 0.09, 0.01), vec3(1.0, 0.42, 0.05), smoothstep(0.05, 0.6, body));
  col = mix(col, vec3(1.0, 0.78, 0.36), smoothstep(0.65, 1.15, body));
  gl_FragColor = vec4(col * uGain * a, a);
}`;

/** One sheet, `w` wide and `h` tall, standing on its lower edge. Call `.userData.set(time, power, gain)` each frame. */
export function makeFlame({ w = 0.5, h = 1.2, seed = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uGain: { value: 2.4 }, uSeed: { value: seed } },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  mesh.userData.set = (time, power, gain = 2.4) => {
    mat.uniforms.uTime.value = time;
    mat.uniforms.uPower.value = power;
    mat.uniforms.uGain.value = gain;
    mesh.visible = power > 0.03;
  };
  /** Turn the sheet about the vertical so it faces the camera. */
  mesh.userData.face = (camera) => {
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    mesh.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
  };
  return mesh;
}
