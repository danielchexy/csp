import * as THREE from "three";

/** Shared noise helpers for GLSL */
const NOISE = `
float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<5;i++){
    v += a * noise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}
`;

export function createAsphaltMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRain: { value: 1 },
      uLightDir: { value: new THREE.Vector3(0.4, 0.85, 0.25).normalize() },
      uFogColor: { value: new THREE.Color(0xb8c8d8) },
      uFogNear: { value: 50 },
      uFogFar: { value: 160 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 world = modelMatrix * vec4(position,1.0);
        vWorldPos = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uRain;
      uniform vec3 uLightDir;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 p = vWorldPos.xz * 0.35;
        float n = fbm(p);
        float cracks = smoothstep(0.55, 0.85, fbm(p * 3.2));
        float oil = smoothstep(0.62, 0.9, noise(p * 0.7 + 12.0));
        float gravel = fbm(p * 8.0);
        // Photoreal-ish asphalt / concrete
        vec3 base = mix(vec3(0.28,0.29,0.31), vec3(0.38,0.39,0.40), n);
        base = mix(base, vec3(0.18,0.18,0.19), cracks * 0.55);
        base = mix(base, vec3(0.12,0.12,0.13), oil * 0.4);
        float peb = fbm(p * 22.0);
        base = mix(base, vec3(0.45,0.44,0.42), peb * 0.15);
        base *= 0.9 + 0.14 * gravel;

        float lane = abs(mod(vWorldPos.x + 4.0, 8.0) - 4.0);
        float paint = smoothstep(0.2, 0.06, lane) * step(abs(vWorldPos.z), 55.0);
        paint *= 0.55 + 0.45 * step(0.5, fract(vWorldPos.z * 0.08));
        base = mix(base, vec3(0.92,0.78,0.22), paint * 0.95);

        // Micro normal from noise
        float hx = fbm(p * 14.0 + 1.0) - fbm(p * 14.0 - 1.0);
        float hz = fbm(p * 14.0 + 2.0) - fbm(p * 14.0 - 2.0);
        vec3 N = normalize(vNormal + vec3(hx, 0.0, hz) * 0.35);
        float ndl = max(dot(N, normalize(uLightDir)), 0.0);
        base *= 0.55 + 0.65 * ndl;
        // Specular glint
        vec3 H = normalize(normalize(uLightDir) + normalize(cameraPosition - vWorldPos));
        base += vec3(0.55,0.58,0.6) * pow(max(dot(N,H),0.0), 48.0) * 0.2;

        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - max(dot(N,V), 0.0), 3.0);
        vec3 sky = mix(vec3(0.55,0.65,0.75), vec3(0.75,0.85,0.95), fres);
        float wet = 0.15 * uRain;
        base = mix(base, sky, fres * wet);

        float dist = length(cameraPosition - vWorldPos);
        float fog = smoothstep(uFogNear, uFogFar, dist);
        base = mix(base, uFogColor, fog);
        gl_FragColor = vec4(base, 1.0);
      }
    `,
  });
}

export function createContainerMaterial(color) {
  const c = new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: c },
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0.4, 0.85, 0.25).normalize() },
      uFogColor: { value: new THREE.Color(0xb8c8d8) },
      uFogNear: { value: 50 },
      uFogFar: { value: 160 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 world = modelMatrix * vec4(position,1.0);
        vWorldPos = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uColor;
      uniform float uTime;
      uniform vec3 uLightDir;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      ${NOISE}
      void main(){
        vec3 N = normalize(vNormal);
        // Strong corrugated paneling
        float ribWave = sin(vUv.x * 62.0);
        float ribs = abs(ribWave);
        float ribShade = mix(0.55, 1.15, ribs);
        // Fake normal from ribs
        N = normalize(N + vec3(ribWave * 0.45, 0.0, 0.0));

        float rust = fbm(vWorldPos.xy * 0.65 + vWorldPos.z * 0.4);
        rust = smoothstep(0.42, 0.88, rust);
        float streak = pow(fbm(vec2(vUv.x * 3.0, vUv.y * 18.0 + 2.0)), 1.5);
        float peel = smoothstep(0.7, 1.0, fbm(vUv * 9.0));

        vec3 col = uColor * ribShade;
        col = mix(col, vec3(0.42,0.2,0.08), rust * streak * 0.75);
        col = mix(col, col * 0.45, peel * 0.35);
        // rivet dots
        vec2 grid = fract(vUv * vec2(10.0, 6.0)) - 0.5;
        float rivet = smoothstep(0.08, 0.03, length(grid));
        col = mix(col, col * 0.55, rivet * 0.8);

        float ndl = max(dot(N, normalize(uLightDir)), 0.0);
        col *= 0.28 + 0.85 * ndl;

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(normalize(uLightDir) + V);
        float spec = pow(max(dot(N,H),0.0), 48.0) * 0.45;
        float rim = pow(1.0 - max(dot(N,V),0.0), 2.2) * 0.28;
        col += vec3(0.65,0.75,0.85) * (spec + rim);

        col *= 0.65 + 0.4 * smoothstep(0.0, 3.0, vWorldPos.y);
        float dist = length(cameraPosition - vWorldPos);
        float fog = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createSkyMaterial() {
  // Solid gradient dome — no sin-cloud hollows / inverted-face artifacts
  return new THREE.ShaderMaterial({
    side: THREE.FrontSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Keep sky behind world; avoid far-plane clipping holes
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.15, 1.0);
        vec3 zenith = vec3(0.32, 0.58, 0.96);
        vec3 mid = vec3(0.58, 0.78, 0.96);
        vec3 horizon = vec3(0.86, 0.91, 0.96);
        vec3 groundGlow = vec3(0.72, 0.78, 0.82);
        vec3 col = mix(groundGlow, horizon, smoothstep(-0.15, 0.02, h));
        col = mix(col, mid, smoothstep(0.02, 0.42, h));
        col = mix(col, zenith, smoothstep(0.42, 1.0, h));
        vec3 sunDir = normalize(vec3(0.38, 0.72, 0.22));
        float sunDot = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.96, 0.85) * pow(sunDot, 220.0) * 1.2;
        col += vec3(1.0, 0.88, 0.62) * pow(sunDot, 10.0) * 0.28;
        // Soft unbroken cloud bands (no hollow sin products)
        float band = d.y * 2.4 + sin(d.x * 2.2 + uTime * 0.015) * 0.08;
        float clouds = smoothstep(0.22, 0.55, band) * smoothstep(0.85, 0.4, band);
        clouds *= smoothstep(0.05, 0.35, d.y) * smoothstep(0.85, 0.45, d.y);
        col = mix(col, vec3(0.97, 0.98, 1.0), clouds * 0.18);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createMetalMaterial(color = 0x6a7380, metalness = 0.85, roughness = 0.35) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    envMapIntensity: 1,
  });
}

export function syncFogUniforms(mat, fogColor, near, far) {
  if (!mat?.uniforms) return;
  if (mat.uniforms.uFogColor) mat.uniforms.uFogColor.value.copy(fogColor);
  if (mat.uniforms.uFogNear) mat.uniforms.uFogNear.value = near;
  if (mat.uniforms.uFogFar) mat.uniforms.uFogFar.value = far;
}
