// Sky — a graded skydome (dusty wasteland dusk). Replaces the flat background so
// the horizon reads like a real environment. Fog is disabled on it so distant
// geometry fogs into the horizon color while the sky stays crisp behind.
import * as THREE from 'three';

export function makeSky({ top = '#2b3a47', horizon = '#7d7159' } = {}) {
  const geo = new THREE.SphereGeometry(380, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
    },
    vertexShader: /* glsl */`
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vPos;
      uniform vec3 top, horizon;
      void main() {
        float h = normalize(vPos).y;
        float t = smoothstep(-0.05, 0.55, h);
        gl_FragColor = vec4(mix(horizon, top, t), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  return mesh;
}
