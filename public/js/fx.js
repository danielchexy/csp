import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDarkness: { value: 0.45 },
    uOffset: { value: 1.15 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uDarkness;
    uniform float uOffset;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * vec2(uOffset);
      float v = smoothstep(0.8, 0.2, dot(uv, uv));
      c.rgb = mix(c.rgb * (1.0 - uDarkness), c.rgb, v);
      gl_FragColor = c;
    }
  `,
};

export function createComposer(renderer, scene, camera, quality) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  let composer;
  try {
    const samples = quality.label === "Low" ? 0 : quality.label === "High" ? 4 : 2;
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      samples,
      type: THREE.UnsignedByteType,
    });
    composer = new EffectComposer(renderer, rt);
  } catch {
    composer = new EffectComposer(renderer);
  }
  composer.addPass(new RenderPass(scene, camera));

  let bloom = null;
  if (quality.label === "High") {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.035, 0.6, 0.97);
    composer.addPass(bloom);
  }

  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.uDarkness.value = quality.label === "Low" ? 0.06 : 0.08;
  composer.addPass(vignette);

  let smaa = null;
  if (quality.label !== "Low") {
    try {
      const pr = renderer.getPixelRatio();
      smaa = new SMAAPass(size.x * pr, size.y * pr);
      composer.addPass(smaa);
    } catch {
      smaa = null;
    }
  }

  return {
    composer,
    bloom,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom?.setSize(w, h);
      if (smaa) smaa.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    },
    render() {
      composer.render();
    },
  };
}
