// Steam over a hot glass: a camera-facing sheet with soft rising wisps drawn by a small shader (white, faint, curling
// with time). `.userData.set(time, amount)` each frame, `.userData.face(camera)`.
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime; uniform float uAmount; uniform float uSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.02; a *= 0.5; } return s; }
void main() {
  float y = vUv.y, x = (vUv.x - 0.5) * 2.0;
  float t = uTime * 0.6 + uSeed * 9.0;
  // two wisps that lean and curl as they rise
  float bend = (fbm(vec2(y * 1.6 - t * 0.5, uSeed)) - 0.5) * 1.4 * y;
  float w1 = exp(-pow((x - bend - 0.15 * sin(y * 5.0 + t)) / (0.12 + 0.35 * y), 2.0));
  float w2 = exp(-pow((x - bend * 0.7 + 0.25 + 0.12 * sin(y * 4.0 - t * 1.3)) / (0.1 + 0.3 * y), 2.0));
  float n = fbm(vec2(x * 2.5, y * 3.0 - t * 1.4));
  float a = (w1 + 0.7 * w2) * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.55, 1.0, y)) * (0.4 + 0.9 * n) * uAmount;
  gl_FragColor = vec4(vec3(0.95, 0.93, 0.9), clamp(a * 0.32, 0.0, 0.5));
}`;

export function makeSteam({ w = 0.06, h = 0.16, seed = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uAmount: { value: 1 }, uSeed: { value: seed } } });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 6;
  mesh.userData.set = (time, amount = 1) => { mat.uniforms.uTime.value = time; mat.uniforms.uAmount.value = amount; mesh.visible = amount > 0.02; };
  mesh.userData.face = (camera) => {
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    mesh.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
  };
  return mesh;
}
