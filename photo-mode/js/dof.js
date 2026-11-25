/* DIBS Photo Mode: lens and look pass.
   The scene is drawn into a float target (color + depth). One full-screen shader then blurs it with a
   thin-lens circle of confusion (bokeh disc gather), and applies exposure, filter, vignette and grain. */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE;
  var DP = window.DP = window.DP || {};

  var VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float; precision highp int;',
    'uniform sampler2D tColor; uniform sampler2D tDepth;',
    'uniform vec2 uRes; uniform float uNear; uniform float uFar;',
    'uniform float uFocus;      // focus distance, world units along the view axis',
    'uniform float uCocA;       // f^2 / (N * sensorHeight)  (fraction of image height per 1/mm)',
    'uniform float uSU;         // focus distance in mm minus focal length',
    'uniform float uUnitMM;     // millimetres per world unit',
    'uniform float uMaxBlur;    // max blur radius, fraction of image height',
    'uniform int uTaps;',
    'uniform float uExposure;',
    'uniform int uFilter; uniform float uStrength; uniform float uBright; uniform float uContrast; uniform float uSat;',
    'uniform float uVig; uniform int uVigStyle; uniform float uGrain; uniform float uSeed;',
    'varying vec2 vUv;',
    'float linDepth(vec2 uv){ float z = texture2D(tDepth, uv).x; float vz = (uNear * uFar) / ((uFar - uNear) * z - uFar); return -vz; }',
    '// circle of confusion radius in pixels',
    'float cocPx(float d){ float du = max(d, 0.05); float c = uCocA * abs(du - uFocus) * uUnitMM / (du * uUnitMM * uSU); return min(0.5 * c * uRes.y, uMaxBlur * uRes.y); }',
    'float hash(vec2 p){ uvec2 q = uvec2(ivec2(p) + ivec2(4096)); q = q * 1664525u + 1013904223u; q.x += q.y * 1664525u; q.y += q.x * 1664525u; q ^= q >> 16u; q.x += q.y * 1664525u; q.y += q.x * 1664525u; q ^= q >> 16u; return float(q.x) * (1.0 / 4294967296.0); }',
    'vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }',
    'vec3 shoulder(vec3 x){ vec3 t = max(x - 0.78, 0.0); return min(x, vec3(0.78)) + 0.22 * (1.0 - exp(-t / 0.22)); }',
    'float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',
    'vec3 sat(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }',
    'vec3 contrast(vec3 c, float k){ return (c - 0.5) * k + 0.5; }',
    'vec3 applyFilter(int f, vec3 c){',
    '  if (f == 1) { return clamp(c * vec3(1.07, 1.0, 0.86) + vec3(0.02, 0.0, -0.01), 0.0, 1.0); }',
    '  if (f == 2) { return clamp(c * vec3(0.9, 0.99, 1.1) + vec3(-0.01, 0.0, 0.02), 0.0, 1.0); }',
    '  if (f == 3) { vec3 g = sat(c, 0.55); g = contrast(g, 1.14); return clamp(g * vec3(1.0, 0.95, 0.84) + vec3(0.03, 0.02, 0.0), 0.0, 1.0); }',
    '  if (f == 4) { float l = luma(c); l = (l - 0.5) * 1.12 + 0.5; return vec3(clamp(l, 0.0, 1.0)); }',
    '  if (f == 5) { vec3 g = sat(c, 0.78); g = contrast(g, 0.82); g = g * 0.9 + 0.07; float l = luma(g); g += mix(vec3(-0.01, 0.02, 0.03), vec3(0.04, 0.02, -0.03), l); return clamp(g, 0.0, 1.0); }',
    '  if (f == 6) { float l = luma(c); l = clamp((l - 0.5) * 1.18 + 0.5, 0.0, 1.0); vec3 sh = vec3(0.04, 0.26, 0.32); vec3 hi = vec3(1.0, 0.72, 0.36); return mix(sh, hi, smoothstep(0.0, 1.0, l)) * (0.75 + 0.35 * l); }',
    '  if (f == 7) { vec3 g = sat(c, 1.45); g = contrast(g, 1.1); return clamp(g, 0.0, 1.0); }',
    '  return c;',
    '}',
    'void main(){',
    '  vec2 uv = vUv; vec2 px = 1.0 / uRes;',
    '  vec3 col = texture2D(tColor, uv).rgb;',
    '  float d0 = linDepth(uv); float c0 = cocPx(d0);',
    '  float Rcap = uMaxBlur * uRes.y;',
    '  float Rmax = min(Rcap, max(cocPx(uFar * 0.6), cocPx(max(uFocus * 0.45, 0.2))) + 1.0);',
    '  float rot = hash(gl_FragCoord.xy + uSeed) * 6.2831853;',
    '  float R = min(c0, Rcap);',
    '  // probe for nearer, blurrier things whose blur reaches this pixel',
    '  if (Rmax > 1.5 && uTaps > 0) {',
    '    for (int j = 0; j < 16; j++) {',
    '      float fj = float(j);',
    '      float rj = Rmax * sqrt((fj + 0.5) / 16.0);',
    '      float aj = fj * 2.39996323 + rot * 0.5;',
    '      float dj = linDepth(uv + vec2(cos(aj), sin(aj)) * rj * px);',
    '      if (dj < d0 - 0.02) { float cj = cocPx(dj); if (cj > rj) R = max(R, min(cj, Rcap)); }',
    '    }',
    '  }',
    '  if (R > 0.75 && uTaps > 0) {',
    '    float nT = min(float(uTaps), max(14.0, R * R * 3.0));',
    '    float spacing = R * sqrt(3.14159 / nT);',
    '    float lod = clamp(log2(max(spacing, 1.0)) - 0.2, 0.0, 3.0);',
    '    vec3 acc = col; float wsum = 1.0;',
    '    for (int i = 0; i < 96; i++) {',
    '      if (float(i) >= nT) break;',
    '      float fi = float(i);',
    '      float r = sqrt((fi + 0.5) / nT) * R;',
    '      float a = fi * 2.39996323 + rot;',
    '      vec2 suv = uv + vec2(cos(a), sin(a)) * r * px;',
    '      float ds = linDepth(suv);',
    '      float cs = cocPx(ds);',
    '      if (ds > d0 + 0.02) cs = min(cs, c0);',
    '      float w = clamp(cs - r + 1.0, 0.0, 1.0);',
    '      if (w > 0.0) { acc += textureLod(tColor, suv, lod).rgb * w; wsum += w; }',
    '    }',
    '    col = acc / wsum;',
    '  }',
    '  col *= exp2(uExposure);',
    '  col = toSRGB(shoulder(col));',
    '  // filter',
    '  if (uFilter > 0) { col = mix(col, applyFilter(uFilter, col), uStrength); }',
    '  col = col + uBright * 0.25;',
    '  col = contrast(col, uContrast);',
    '  col = sat(col, uSat);',
    '  // vignette',
    '  vec2 q = (uv - 0.5) * 2.0;',
    '  if (uVig > 0.0) {',
    '    if (uVigStyle == 0) { float v = smoothstep(0.35, 1.45, length(q * vec2(uRes.x / uRes.y * 0.62, 1.0)) + 0.0); col *= 1.0 - uVig * 0.75 * v; }',
    '    else { vec2 a = abs(q); float e = pow(pow(a.x, 4.0) + pow(a.y, 4.0), 0.25); float edge = 1.0 - uVig * 0.2; float m = smoothstep(edge - 0.004, edge + 0.004, e); col = mix(col, col * 0.3 + vec3(0.07, 0.05, 0.16) * 0.5, m); }',
    '  }',
    '  // grain (random per cell, not a pattern)',
    '  if (uGrain > 0.0) {',
    '    float cell = max(1.0, uRes.y / 540.0);',
    '    vec2 gp = floor(gl_FragCoord.xy / cell);',
    '    float n = hash(gp) + hash(gp + 17.0) - 1.0;',
    '    float lum = luma(col);',
    '    col += n * uGrain * 0.12 * (0.45 + 0.55 * (1.0 - abs(lum * 2.0 - 1.0)));',
    '  }',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function Post(renderer) {
    this.r = renderer;
    this.sceneRT = null; this.outRT = null;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.1 }, uFar: { value: 120 }, uFocus: { value: 5 }, uCocA: { value: 0 }, uSU: { value: 1000 }, uUnitMM: { value: 250 },
        uMaxBlur: { value: 0.04 }, uTaps: { value: 32 }, uExposure: { value: 0 },
        uFilter: { value: 0 }, uStrength: { value: 1 }, uBright: { value: 0 }, uContrast: { value: 1 }, uSat: { value: 1 },
        uVig: { value: 0 }, uVigStyle: { value: 0 }, uGrain: { value: 0 }, uSeed: { value: 0 }
      }
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.samples = 4;
  }

  Post.prototype.ensure = function (w, h, samples) {
    var rt = this.sceneRT;
    if (rt && rt.width === w && rt.height === h && rt.samples === samples) return;
    if (rt) { rt.depthTexture.dispose(); rt.dispose(); }
    var dt = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    dt.format = THREE.DepthFormat;
    dt.minFilter = dt.magFilter = THREE.NearestFilter;
    var ext = this.r.extensions;
    var half = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    rt = new THREE.WebGLRenderTarget(w, h, {
      type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, samples: samples, depthBuffer: true, depthTexture: dt,
      generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter
    });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.sceneRT = rt;
  };

  /* p: lens + look parameters. Returns nothing; draws to screen or fills this.pixels (Uint8Array, bottom-up). */
  Post.prototype.render = function (scene, camera, p) {
    var r = this.r, w = p.width, h = p.height;
    this.ensure(w, h, p.samples);
    var u = this.mat.uniforms;
    u.tColor.value = this.sceneRT.texture; u.tDepth.value = this.sceneRT.depthTexture;
    u.uRes.value.set(w, h);
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    // thin lens
    var f = p.focalMM, N = p.fnum, su = p.focus * p.unitMM;
    u.uFocus.value = p.focus; u.uUnitMM.value = p.unitMM;
    u.uSU.value = Math.max(1, su - f);
    u.uCocA.value = (f * f / N) / p.sensorH;
    u.uMaxBlur.value = p.maxBlur || 0.04;
    u.uTaps.value = p.taps;
    u.uExposure.value = p.exposure;
    var L = p.look;
    u.uFilter.value = L.filter; u.uStrength.value = L.strength; u.uBright.value = L.brightness; u.uContrast.value = L.contrast; u.uSat.value = L.saturation;
    u.uVig.value = L.vignette; u.uVigStyle.value = L.vigStyle; u.uGrain.value = L.grain; u.uSeed.value = p.seed || 0;

    var prevAuto = r.shadowMap.autoUpdate;
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(p.clear || 0x000000, 1);
    r.clear(true, true, true);
    r.render(scene, camera);
    if (p.toScreen) {
      r.setRenderTarget(null);
      r.setClearColor(0x000000, 1);
      r.render(this.qscene, this.qcam);
      return null;
    }
    if (!this.outRT || this.outRT.width !== w || this.outRT.height !== h) {
      if (this.outRT) this.outRT.dispose();
      this.outRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: false });
      this.outRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
    }
    r.setRenderTarget(this.outRT);
    r.render(this.qscene, this.qcam);
    var buf = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(this.outRT, 0, 0, w, h, buf);
    r.setRenderTarget(null);
    return buf;
  };

  Post.prototype.free = function () {
    if (this.sceneRT) { this.sceneRT.depthTexture.dispose(); this.sceneRT.dispose(); this.sceneRT = null; }
    if (this.outRT) { this.outRT.dispose(); this.outRT = null; }
  };

  DP.Post = Post;

  /* 35mm-style lens helpers. The frame's long side is a 36 mm sensor edge. */
  DP.sensorFor = function (aspect) { return aspect >= 1 ? { w: 36, h: 36 / aspect } : { w: 36 * aspect, h: 36 }; };
  DP.fovFor = function (mm, aspect) { var s = DP.sensorFor(aspect); return 2 * Math.atan(s.h / (2 * mm)) * 180 / Math.PI; };
})();
