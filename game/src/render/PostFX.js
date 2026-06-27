// PostFX — cinematic post-processing stack. The single biggest "studio game" lever:
// bloom on emissives (cores/visors/lights), tone-mapped output, a vignette + film
// grain, and SMAA antialiasing. All via three/addons over CDN — no asset files.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// vignette + animated film grain, applied in display space (after tone mapping)
const GrainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.5 },
    grain: { value: 0.05 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float time, vignette, grain;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.85, 0.25, length(d));
      col.rgb *= mix(1.0, vig, vignette);
      float g = (rand(vUv + fract(time)) - 0.5) * grain;
      col.rgb += g;
      gl_FragColor = col;
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, width, height) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.5, 0.82);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());      // tone mapping (renderer.toneMapping) + sRGB

    this.grain = new ShaderPass(GrainVignetteShader);
    this.composer.addPass(this.grain);

    this.smaa = new SMAAPass(width, height);
    this.composer.addPass(this.smaa);
  }

  setSize(w, h) { this.composer.setSize(w, h); }

  render(dt) {
    this.grain.uniforms.time.value += dt;
    this.composer.render();
  }
}
