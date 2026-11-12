// Shared "inked comic" renderer: toon shading + screen-space hatching on shadow sides,
// then black outlines from depth/normal edges. Used by the hero and the workshop.
import * as THREE from "three";

export class Ink {
  constructor(renderer, { thickness = 2.0, fadeNear = 1e4, fadeFar = 2e4, hatch = 5 } = {}) {
    this.renderer = renderer;
    this.enabled = true;
    this.uniforms = {
      uLightDirView: { value: new THREE.Vector3(0, 1, 0) },
      uInk: { value: 1 },
      uHatch: { value: 1 / (hatch * renderer.getPixelRatio()) },
    };

    this.ramp = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
    this.ramp.minFilter = this.ramp.magFilter = THREE.NearestFilter;
    this.ramp.needsUpdate = true;

    this.normalTarget = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
    this.outlineMat = new THREE.ShaderMaterial({
      uniforms: {
        tNormal: { value: this.normalTarget.texture },
        tDepth: { value: this.normalTarget.depthTexture },
        texel: { value: new THREE.Vector2() },
        near: { value: 0.1 }, far: { value: 100 },
        thickness: { value: thickness },
        fadeNear: { value: fadeNear }, fadeFar: { value: fadeFar },
        uInk: this.uniforms.uInk,
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        #include <packing>
        uniform sampler2D tNormal; uniform sampler2D tDepth; uniform vec2 texel;
        uniform float near; uniform float far; uniform float thickness; uniform float uInk;
        uniform float fadeNear; uniform float fadeFar; varying vec2 vUv;
        float viewZ(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
        vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
        void main() {
          vec2 ox = vec2(texel.x * thickness, 0.0), oy = vec2(0.0, texel.y * thickness);
          float dc = viewZ(vUv);
          float dmin = min(min(viewZ(vUv + ox), viewZ(vUv - ox)), min(viewZ(vUv + oy), viewZ(vUv - oy)));
          float dd = abs(viewZ(vUv + ox) - dc) + abs(viewZ(vUv - ox) - dc) + abs(viewZ(vUv + oy) - dc) + abs(viewZ(vUv - oy) - dc);
          float eDepth = smoothstep(0.03, 0.08, dd / max(dc, 1e-3));
          vec3 nc = nrm(vUv);
          float nd = (1.0 - dot(nc, nrm(vUv + ox))) + (1.0 - dot(nc, nrm(vUv - ox))) + (1.0 - dot(nc, nrm(vUv + oy))) + (1.0 - dot(nc, nrm(vUv - oy)));
          float eNorm = smoothstep(0.35, 0.8, nd);
          float fade = 1.0 - smoothstep(fadeNear, fadeFar, min(dc, dmin));
          float edge = max(eDepth, eNorm) * uInk * fade;
          gl_FragColor = vec4(0.02, 0.03, 0.05, edge);
        }`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.outlineMat);
    quad.frustumCulled = false; // drawn in clip space, never cull it
    this.quadScene.add(quad);
    this._tmp = new THREE.Vector3();
  }

  /** Toon material with comic hatching on the shadow side. */
  toon({ map = null, color = 0xffffff, vertexColors = false, alphaTest = 0.5, fog = true, pixel = true } = {}) {
    if (map) {
      if (pixel) { // crisp Minecraft-style texels; pixel:false keeps smooth, hand-painted filtering
        map.magFilter = map.minFilter = THREE.NearestFilter;
        map.generateMipmaps = false;
      }
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
    }
    const mat = new THREE.MeshToonMaterial({
      map, color: map ? 0xffffff : color, vertexColors, gradientMap: this.ramp,
      alphaTest: map ? alphaTest : 0, transparent: false, side: THREE.FrontSide, fog,
    });
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uLightDirView; uniform float uInk; uniform float uHatch;")
        .replace("#include <opaque_fragment>", `
          float ndl = dot(normalize(normal), normalize(uLightDirView));
          float h1 = step(fract((gl_FragCoord.x + gl_FragCoord.y) * uHatch), 0.3);
          float h2 = step(fract((gl_FragCoord.x - gl_FragCoord.y) * uHatch), 0.3);
          float shade = smoothstep(0.1, -0.2, ndl);
          float deep = smoothstep(-0.35, -0.75, ndl);
          outgoingLight = mix(outgoingLight, outgoingLight * 0.3, uInk * clamp(h1 * shade + h2 * deep, 0.0, 1.0) * 0.8);
          #include <opaque_fragment>`);
    };
    return mat;
  }

  /** Normal-buffer material for the outline pass (respects alpha cut-outs). */
  normalMaterial(map = null) {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, useMap: { value: map ? 1 : 0 } },
      vertexShader: `varying vec3 vN; varying vec2 vUv;
        void main() {
          #ifdef USE_UV_ATTR
            vUv = uv;
          #else
            vUv = vec2(0.0);
          #endif
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform sampler2D map; uniform float useMap; varying vec3 vN; varying vec2 vUv;
        void main() {
          if (useMap > 0.5 && texture2D(map, vUv).a < 0.5) discard;
          gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, 1.0);
        }`,
      defines: map ? { USE_UV_ATTR: "" } : {},
      side: THREE.FrontSide,
    });
  }

  /** Give a mesh its toon + normal materials. */
  inkify(mesh, opts = {}) {
    const toon = opts.material || this.toon(opts);
    mesh.material = toon;
    mesh.userData.toon = toon;
    mesh.userData.inkNormal = this.normalMaterial(toon.map || null);
    return mesh;
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.normalTarget.setSize(Math.max(1, w * pr), Math.max(1, h * pr));
    this.outlineMat.uniforms.texel.value.set(1 / (w * pr), 1 / (h * pr));
  }

  /** Outlines fade out between these view distances (per scene). */
  setFade(near, far) {
    this.outlineMat.uniforms.fadeNear.value = near;
    this.outlineMat.uniforms.fadeFar.value = far;
  }

  setInk(on) {
    this.enabled = on;
    this.uniforms.uInk.value = on ? 1 : 0;
  }

  /** Render scene with hatching + outlines. Objects with userData.noInk get no outline. */
  render(scene, camera, lightPosition, target = null) {
    const r = this.renderer;
    this.uniforms.uLightDirView.value.copy(this._tmp.copy(lightPosition).normalize().transformDirection(camera.matrixWorldInverse));
    this.outlineMat.uniforms.near.value = camera.near;
    this.outlineMat.uniforms.far.value = camera.far;

    if (this.enabled) {
      const swapped = [], hidden = [];
      scene.traverseVisible((o) => {
        if (o.userData.noInk) hidden.push(o);
        else if (o.isMesh && o.userData.inkNormal) swapped.push(o);
      });
      hidden.forEach((o) => (o.visible = false));
      swapped.forEach((o) => (o.material = o.userData.inkNormal));
      const bg = scene.background, fog = scene.fog;
      scene.background = null; scene.fog = null;
      r.setRenderTarget(this.normalTarget);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(scene, camera);
      scene.background = bg; scene.fog = fog;
      swapped.forEach((o) => (o.material = o.userData.toon));
      hidden.forEach((o) => (o.visible = true));
      r.setRenderTarget(null);
    }
    r.setRenderTarget(target);
    r.clear();
    r.render(scene, camera);
    if (this.enabled) {
      const ac = r.autoClear;
      r.autoClear = false;
      r.render(this.quadScene, this.quadCam);
      r.autoClear = ac;
    }
    if (target) r.setRenderTarget(null);
  }
}
