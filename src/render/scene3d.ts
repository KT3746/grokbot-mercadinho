import * as THREE from "three";
import { ARCHETYPES } from "../data/catalog";
import type { CosmeticPalette } from "../data/cosmetics";
import type { Customer, Run } from "../game/sim";
import type { ProductId, View } from "../types";
import { detectFx, hexColor, probeWebGL, type FxProfile } from "./fx";
import { applyShelfOrder, type PlayLayout } from "./layout";
import { makeProduct, makeSharedGeo, type SharedGeo } from "./products3d";

const FOG = 0x241810;
const WEBGL_FAIL_PT =
  "Não deu pra ligar o gráfico 3D neste aparelho. O MERCADINHO segue no visual clássico.";

function lambert(hex: number, extra?: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: hex, ...extra });
}

type CustomerRig = {
  root: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  hair: THREE.Object3D;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  shirtMat: THREE.MeshLambertMaterial;
  skinMat: THREE.MeshLambertMaterial;
  hairMat: THREE.MeshLambertMaterial;
  capMat: THREE.MeshLambertMaterial;
  ring: THREE.Mesh;
};

export class Scene3D {
  ok = false;
  lowFx = false;
  canvas: HTMLCanvasElement | null = null;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private fx: FxProfile = detectFx();
  private geo: SharedGeo | null = null;
  private store: THREE.Group | null = null;
  private signGroup: THREE.Group | null = null;
  private shelfBody: THREE.Mesh | null = null;
  private shelfWell: THREE.Mesh | null = null;
  private counter: THREE.Mesh | null = null;
  private cooler: THREE.Mesh | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private lamp: THREE.PointLight | null = null;
  private ambient: THREE.AmbientLight | null = null;
  private products = new Map<ProductId, THREE.Group>();
  private customers: CustomerRig[] = [];
  private cat: THREE.Group | null = null;
  private ghostMesh: THREE.Group | null = null;
  private floorMat: THREE.MeshLambertMaterial | null = null;
  private wallMat: THREE.MeshLambertMaterial | null = null;
  private shelfMat: THREE.MeshLambertMaterial | null = null;
  private shelfDeepMat: THREE.MeshLambertMaterial | null = null;
  private signFace: THREE.MeshLambertMaterial | null = null;
  private signEdge: THREE.MeshLambertMaterial | null = null;
  private idleT = 0;
  private failShown = false;
  private readonly _ndc = new THREE.Vector2();
  private readonly _ray = new THREE.Raycaster();
  private readonly _hit = new THREE.Vector3();
  private readonly _plane = new THREE.Plane();

  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    this.fx = detectFx();
    this.lowFx = this.fx.lowFx;
    if (!probeWebGL()) {
      this.showFail();
      return false;
    }
    if (!THREE?.WebGLRenderer) {
      this.showFail();
      return false;
    }
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(FOG);
      scene.fog = new THREE.FogExp2(FOG, this.fx.lowFx ? 0.038 : 0.024);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.12, 60);
      camera.position.set(0, 11.6, 8.4);
      camera.lookAt(0, 0.4, -0.6);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: this.fx.antialias,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.fx.dprCap));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;

      this.scene = scene;
      this.camera = camera;
      this.renderer = renderer;
      this.geo = makeSharedGeo(this.fx.lowFx);

      this.ambient = new THREE.AmbientLight(0xc8b49a, 0.62);
      scene.add(this.ambient);
      this.hemi = new THREE.HemisphereLight(0xfff0d8, 0x3a2818, 0.95);
      scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight(0xfff6e4, 1.35);
      this.sun.position.set(-3.2, 12, 6.5);
      scene.add(this.sun);
      if (!this.fx.lowFx) {
        this.lamp = new THREE.PointLight(0xffc878, 0.55, 16, 2);
        this.lamp.position.set(0, 4.2, 1.2);
        scene.add(this.lamp);
      }

      this.buildStore();
      this.buildCustomers();
      this.buildProducts();
      this.buildCat();

      renderer.render(scene, camera);
      this.ok = true;
      document.body.classList.add("webgl-on");
      this.hideFail();
      return true;
    } catch (err) {
      console.error("MERCADINHO 3D", err);
      this.showFail();
      this.ok = false;
      this.teardown();
      return false;
    }
  }

  resize(cssW: number, cssH: number): void {
    if (!this.ok || !this.renderer || !this.camera) return;
    const w = Math.max(1, cssW);
    const h = Math.max(1, cssH);
    this.camera.aspect = w / h;
    this.camera.fov = h < 620 && w > h * 1.12 ? 38 : w < 700 ? 46 : 42;
    this.camera.updateProjectionMatrix();
    this.fx = detectFx();
    this.lowFx = this.fx.lowFx;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.fx.dprCap));
    this.renderer.setSize(w, h, false);
  }

  sync(opts: {
    view: View;
    run: Run | null;
    layout: PlayLayout | null;
    cosmetics: CosmeticPalette;
    selected: number | null;
    ghost: { x: number; y: number; id: ProductId } | null;
    cssW: number;
    cssH: number;
  }): void {
    if (!this.ok || !this.scene || !this.camera) return;
    const { view, run, layout, cosmetics, selected, ghost, cssW, cssH } = opts;
    this.applyCosmetics(cosmetics, run?.t ?? this.idleT);
    this.applyChaosLights(run);

    const playing =
      (view === "play" || view === "paused" || view === "summary" || view === "tutorial") && !!run && !!layout;

    if (playing && run && layout) {
      this.aimPlayCamera(layout, run);
      this.layoutStore(layout);
      this.syncProducts(run, layout);
      this.syncCustomers(run, layout, selected, run.t);
      this.syncCat(run, layout, run.t);
      this.syncGhost(ghost, layout, run.t);
    } else {
      this.layoutMenu(cssW, cssH);
      this.syncMenuProducts(this.idleT);
      this.hideCustomers();
      this.poseMenuCustomers(this.idleT);
      if (this.cat) this.cat.visible = false;
      if (this.ghostMesh) this.ghostMesh.visible = false;
      this.aimMenuCamera(cssW, cssH, this.idleT);
    }
  }

  render(dt: number): void {
    if (!this.ok || !this.renderer || !this.scene || !this.camera) return;
    this.idleT += dt;
    this.renderer.render(this.scene, this.camera);
  }

  private showFail(): void {
    if (this.failShown) return;
    this.failShown = true;
    const el = document.getElementById("webgl-fail");
    if (el) {
      el.textContent = WEBGL_FAIL_PT;
      el.hidden = false;
      window.setTimeout(() => {
        el.hidden = true;
      }, 7000);
    }
    document.body.classList.remove("webgl-on");
    document.body.classList.add("webgl-fallback");
  }

  private hideFail(): void {
    const el = document.getElementById("webgl-fail");
    if (el) el.hidden = true;
    document.body.classList.remove("webgl-fallback");
  }

  private teardown(): void {
    try {
      this.renderer?.dispose();
    } catch {
      /* ignore */
    }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }

  private buildStore(): void {
    const scene = this.scene!;
    const geo = this.geo!;
    const root = new THREE.Group();
    this.store = root;
    scene.add(root);

    this.floorMat = lambert(0x4a3428);
    this.wallMat = lambert(0x5a4436);
    this.shelfMat = lambert(0x3a5a44);
    this.shelfDeepMat = lambert(0x24382c);
    this.signFace = lambert(0x2a2218, { emissive: 0x3a2a10, emissiveIntensity: 0.18 });
    this.signEdge = lambert(0xe3b23c, { emissive: 0xe3b23c, emissiveIntensity: 0.35 });

    const floor = new THREE.Mesh(geo.box, this.floorMat);
    floor.scale.set(22, 0.12, 22);
    floor.position.y = -0.06;
    root.add(floor);

    if (!this.fx.lowFx) {
      const tile = lambert(0x3a2818);
      const tileB = lambert(0x1e1610);
      for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
          const t = new THREE.Mesh(geo.box, (i + j) % 2 === 0 ? tile : tileB);
          t.scale.set(1.35, 0.04, 1.35);
          t.position.set(i * 1.4, 0.01, j * 1.4);
          root.add(t);
        }
      }
    }

    const back = new THREE.Mesh(geo.box, this.wallMat);
    back.scale.set(18, 6.2, 0.28);
    back.position.set(0, 3.0, -6.4);
    root.add(back);
    const left = new THREE.Mesh(geo.box, this.wallMat);
    left.scale.set(0.28, 6.2, 14);
    left.position.set(-8.6, 3.0, 0);
    root.add(left);
    const right = left.clone();
    right.position.x = 8.6;
    root.add(right);

    const windowMat = lambert(0x1a2838, { emissive: 0x6a90b8, emissiveIntensity: 0.28 });
    const win = new THREE.Mesh(geo.box, windowMat);
    win.scale.set(3.4, 1.8, 0.12);
    win.position.set(-3.2, 3.4, -6.22);
    root.add(win);
    const win2 = win.clone();
    win2.position.x = 3.2;
    root.add(win2);

    const door = new THREE.Mesh(geo.box, lambert(0x1a100c));
    door.scale.set(1.6, 2.8, 0.16);
    door.position.set(0, 1.4, -6.22);
    root.add(door);

    this.signGroup = new THREE.Group();
    const sign = new THREE.Mesh(geo.box, this.signFace);
    sign.scale.set(3.4, 0.7, 0.12);
    this.signGroup.add(sign);
    const trim = new THREE.Mesh(geo.box, this.signEdge);
    trim.scale.set(3.55, 0.84, 0.06);
    trim.position.z = -0.04;
    this.signGroup.add(trim);
    this.signGroup.position.set(0, 4.55, -6.05);
    root.add(this.signGroup);

    this.counter = new THREE.Mesh(geo.box, lambert(0x5a3a22));
    this.counter.scale.set(6.5, 0.95, 0.9);
    this.counter.position.set(0, 0.48, -1.1);
    root.add(this.counter);
    const counterTop = new THREE.Mesh(geo.box, lambert(0x7a5230));
    counterTop.scale.set(6.7, 0.08, 1.05);
    counterTop.position.set(0, 0.98, -1.1);
    counterTop.name = "counterTop";
    root.add(counterTop);

    this.shelfBody = new THREE.Mesh(geo.box, this.shelfMat);
    this.shelfBody.scale.set(7.2, 1.35, 2.2);
    this.shelfBody.position.set(0, 0.7, 3.4);
    root.add(this.shelfBody);
    this.shelfWell = new THREE.Mesh(geo.box, this.shelfDeepMat);
    this.shelfWell.scale.set(6.6, 0.7, 1.7);
    this.shelfWell.position.set(0, 0.95, 3.4);
    root.add(this.shelfWell);

    this.cooler = new THREE.Mesh(geo.box, lambert(0x2a4050, { emissive: 0x1a3040, emissiveIntensity: 0.2 }));
    this.cooler.scale.set(1.4, 2.4, 0.9);
    this.cooler.position.set(6.2, 1.2, -3.4);
    root.add(this.cooler);
    const coolGlass = new THREE.Mesh(geo.box, lambert(0x9fd4ee, { emissive: 0x4d8fbf, emissiveIntensity: 0.15 }));
    coolGlass.scale.set(1.18, 1.6, 0.08);
    coolGlass.position.set(6.2, 1.35, -2.92);
    root.add(coolGlass);

    const crate = new THREE.Mesh(geo.box, lambert(0x8a5a30));
    crate.scale.set(1.1, 0.55, 0.8);
    crate.position.set(-6.4, 0.3, -3.6);
    root.add(crate);
    const crate2 = crate.clone();
    crate2.position.set(-5.5, 0.3, -4.2);
    crate2.scale.set(0.9, 0.45, 0.7);
    root.add(crate2);

    if (!this.fx.lowFx) {
      const lampGeo = geo.cyl;
      const lampMat = lambert(0xf6e27a, { emissive: 0xe3b23c, emissiveIntensity: 0.55 });
      for (const x of [-2.4, 2.4]) {
        const shade = new THREE.Mesh(lampGeo, lampMat);
        shade.scale.set(0.55, 0.18, 0.55);
        shade.position.set(x, 4.35, 0.4);
        root.add(shade);
      }
    }
  }

  private buildCustomers(): void {
    const scene = this.scene!;
    for (let i = 0; i < 4; i++) {
      this.customers.push(this.makeCustomerRig());
      scene.add(this.customers[i]!.root);
    }
  }

  private makeCustomerRig(): CustomerRig {
    const geo = this.geo!;
    const root = new THREE.Group();
    const shirtMat = lambert(0xc4491d);
    const skinMat = lambert(0xd8a07a);
    const hairMat = lambert(0x2a1d12);
    const capMat = lambert(0xc4491d);
    const pantsMat = lambert(0x2a2218);

    const shadow = new THREE.Mesh(
      geo.sphere,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    shadow.scale.set(0.7, 0.08, 0.5);
    shadow.position.y = 0.04;
    root.add(shadow);

    const legs = new THREE.Mesh(geo.box, pantsMat);
    legs.scale.set(0.42, 0.55, 0.28);
    legs.position.y = 0.32;
    root.add(legs);

    const torso = new THREE.Mesh(geo.box, shirtMat);
    torso.scale.set(0.55, 0.62, 0.32);
    torso.position.y = 0.92;
    root.add(torso);

    const head = new THREE.Mesh(geo.box, skinMat);
    head.scale.set(0.38, 0.38, 0.36);
    head.position.y = 1.42;
    root.add(head);

    const hair = new THREE.Mesh(geo.box, hairMat);
    hair.scale.set(0.4, 0.16, 0.38);
    hair.position.y = 1.64;
    root.add(hair);

    const armL = new THREE.Mesh(geo.box, skinMat);
    armL.scale.set(0.14, 0.5, 0.14);
    armL.position.set(-0.38, 0.92, 0);
    root.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.38;
    root.add(armR);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.035, 6, this.fx.lowFx ? 12 : 20),
      new THREE.MeshBasicMaterial({ color: 0xe3b23c, transparent: true, opacity: 0 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    root.add(ring);

    root.visible = false;
    return { root, torso, head, hair, armL, armR, shirtMat, skinMat, hairMat, capMat, ring };
  }

  private styleHair(rig: CustomerRig, style: string): void {
    const h = rig.hair;
    h.visible = true;
    h.scale.set(0.4, 0.16, 0.38);
    h.position.set(0, 1.64, 0);
    h.rotation.set(0, 0, 0);
    if (style === "bald") {
      h.scale.set(0.28, 0.08, 0.28);
      h.position.y = 1.6;
    } else if (style === "bun") {
      h.scale.set(0.22, 0.22, 0.22);
      h.position.y = 1.78;
    } else if (style === "puff") {
      h.scale.set(0.52, 0.28, 0.42);
      h.position.y = 1.68;
    } else if (style === "side") {
      h.scale.set(0.42, 0.18, 0.4);
      h.position.set(0.06, 1.64, 0);
    } else if (style === "cap") {
      h.scale.set(0.46, 0.12, 0.46);
      h.position.y = 1.66;
    }
    if (h instanceof THREE.Mesh) h.material = style === "cap" ? rig.capMat : rig.hairMat;
  }

  private buildProducts(): void {
    const scene = this.scene!;
    const geo = this.geo!;
    const ids: ProductId[] = [
      "refri",
      "refriZero",
      "suco",
      "leite",
      "cremeLeite",
      "agua",
      "aguaGas",
      "pao",
      "biscoito",
      "salgadinho",
      "chocolate",
      "ovos",
      "macarrao",
      "arroz",
      "feijao",
      "cafe",
      "detergente",
      "amaciante",
    ];
    for (const id of ids) {
      const mesh = makeProduct(id, geo);
      mesh.visible = false;
      scene.add(mesh);
      this.products.set(id, mesh);
    }
    this.ghostMesh = makeProduct("pao", geo);
    this.ghostMesh.visible = false;
    scene.add(this.ghostMesh);
  }

  private buildCat(): void {
    const geo = this.geo!;
    const g = new THREE.Group();
    const fur = lambert(0x2a1d12);
    const body = new THREE.Mesh(geo.box, fur);
    body.scale.set(0.55, 0.28, 0.32);
    body.position.y = 0.2;
    g.add(body);
    const head = new THREE.Mesh(geo.box, fur);
    head.scale.set(0.24, 0.22, 0.22);
    head.position.set(0.28, 0.28, 0);
    g.add(head);
    const ear = new THREE.Mesh(geo.cone, fur);
    ear.scale.set(0.1, 0.16, 0.08);
    ear.position.set(0.22, 0.42, 0.06);
    g.add(ear);
    const ear2 = ear.clone();
    ear2.position.set(0.32, 0.42, -0.06);
    g.add(ear2);
    const eye = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: 0xe3b23c }));
    eye.scale.set(0.05, 0.05, 0.05);
    eye.position.set(0.38, 0.3, 0.08);
    g.add(eye);
    const eye2 = eye.clone();
    eye2.position.z = -0.08;
    g.add(eye2);
    g.visible = false;
    this.cat = g;
    this.scene!.add(g);
  }

  private applyCosmetics(cos: CosmeticPalette, t: number): void {
    this.shelfMat?.color.setHex(hexColor(cos.shelfAccent));
    this.shelfDeepMat?.color.setHex(hexColor(cos.shelfDeep));
    this.signFace?.color.setHex(hexColor(cos.signFill));
    this.signEdge?.color.setHex(hexColor(cos.signStroke));
    if (this.signEdge) {
      this.signEdge.emissive.setHex(hexColor(cos.signStroke));
      this.signEdge.emissiveIntensity = cos.signId === "sign-neon" ? 0.55 + Math.sin(t * 4) * 0.12 : 0.28;
    }
    if (this.lamp) {
      this.lamp.color.setHex(hexColor(cos.badge));
      this.lamp.intensity = cos.signId === "sign-neon" ? 0.7 : 0.5;
    }
  }

  private applyChaosLights(run: Run | null): void {
    const apagao = run?.chaos?.kind === "apagao";
    const rush = run?.chaos?.kind === "rush";
    if (this.ambient) this.ambient.intensity = apagao ? 0.16 : 0.62;
    if (this.hemi) this.hemi.intensity = apagao ? 0.22 : 0.95;
    if (this.sun) this.sun.intensity = apagao ? 0.18 : rush ? 1.5 : 1.35;
    if (this.lamp) this.lamp.intensity = apagao ? 0.1 : 0.7;
    if (this.scene?.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = apagao ? 0.09 : this.fx.lowFx ? 0.038 : 0.024;
    }
    if (this.scene?.background instanceof THREE.Color) {
      this.scene.background.setHex(apagao ? 0x080604 : FOG);
    }
  }

  /** Converte pixel CSS → ponto no plano y=const, alinhado ao overlay 2D. */
  private screenToY(cssX: number, cssY: number, y: number, layout: PlayLayout): THREE.Vector3 | null {
    if (!this.camera) return null;
    this._ndc.set((cssX / Math.max(1, layout.w)) * 2 - 1, -(cssY / Math.max(1, layout.h)) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    this._plane.setComponents(0, 1, 0, -y);
    const hit = this._ray.ray.intersectPlane(this._plane, this._hit);
    return hit;
  }

  private layoutStore(layout: PlayLayout): void {
    const s = layout.shelves;
    const q = layout.queue;
    const y = 0.52;
    const a = this.screenToY(s.x, s.y, y, layout);
    const b = this.screenToY(s.x + s.w, s.y + s.h, y, layout);
    if (a && b && this.shelfBody) {
      const cx = (a.x + b.x) / 2;
      const cz = (a.z + b.z) / 2;
      const sw = Math.max(0.6, Math.abs(b.x - a.x));
      const sd = Math.max(0.6, Math.abs(b.z - a.z));
      this.shelfBody.position.set(cx, y, cz);
      this.shelfBody.scale.set(sw * 1.02, 0.9, sd * 1.02);
      if (this.shelfWell) {
        this.shelfWell.position.set(cx, y + 0.22, cz);
        this.shelfWell.scale.set(sw * 0.92, 0.4, sd * 0.86);
      }
    }
    const qa = this.screenToY(q.x + q.w / 2, q.y + q.h, 0.48, layout);
    const sa = this.screenToY(s.x + s.w / 2, s.y, 0.48, layout);
    const left = this.screenToY(s.x, s.y, 0.48, layout);
    const right = this.screenToY(s.x + s.w, s.y, 0.48, layout);
    if (this.counter && qa && sa) {
      this.counter.position.set((qa.x + sa.x) / 2, 0.48, (qa.z + sa.z) / 2);
      const spanX = left && right ? Math.abs(right.x - left.x) : 5;
      this.counter.scale.set(layout.landscape ? 0.7 : Math.min(8, Math.max(2.6, spanX * 0.88)), 0.9, 0.62);
      const top = this.store?.getObjectByName("counterTop") as THREE.Mesh | undefined;
      if (top) {
        top.position.copy(this.counter.position);
        top.position.y = 0.96;
        top.scale.set(this.counter.scale.x * 1.04, 0.08, this.counter.scale.z * 1.12);
      }
    }
    const mid = this.screenToY(q.x + q.w / 2, q.y + 8, 3.1, layout);
    if (this.signGroup && mid) {
      this.signGroup.position.set(mid.x, 3.1, mid.z);
    }
  }

  private layoutMenu(_cssW: number, _cssH: number): void {
    if (this.shelfBody) this.shelfBody.position.set(0, 0.7, 3.2);
    if (this.shelfBody) this.shelfBody.scale.set(7.2, 1.35, 2.2);
    if (this.shelfWell) {
      this.shelfWell.position.set(0, 0.95, 3.2);
      this.shelfWell.scale.set(6.6, 0.7, 1.7);
    }
    if (this.counter) {
      this.counter.position.set(0, 0.48, -0.8);
      this.counter.scale.set(6.5, 0.95, 0.9);
    }
    if (this.signGroup) this.signGroup.position.set(0, 4.55, -6.05);
  }

  private syncProducts(run: Run, layout: PlayLayout): void {
    for (const mesh of this.products.values()) mesh.visible = false;
    const cells = applyShelfOrder(
      layout.cells,
      run.shelfOrder.length === layout.cells.length ? run.shelfOrder : layout.cells.map((c) => c.id),
    );
    const catBlock =
      run.chaos?.kind === "gato"
        ? { x: layout.shelves.x + run.catX * layout.shelves.w, y: layout.catY }
        : null;
    for (const cell of cells) {
      const mesh = this.products.get(cell.id);
      if (!mesh) continue;
      const y = 1.18;
      const hit = this.screenToY(cell.rect.x + cell.rect.w / 2, cell.rect.y + cell.rect.h * 0.4, y, layout);
      if (!hit) continue;
      const hx = hit.x;
      const hz = hit.z;
      const edge = this.screenToY(cell.rect.x + cell.rect.w * 0.78, cell.rect.y + cell.rect.h * 0.4, y, layout);
      const span = edge ? Math.hypot(edge.x - hx, edge.z - hz) * 1.65 : 0.8;
      mesh.visible = true;
      mesh.position.set(hx, y, hz);
      mesh.scale.setScalar(Math.max(0.5, Math.min(1.05, span)));
      mesh.rotation.y = this.fx.reduceMotion ? 0 : Math.sin(run.t * 1.2 + cell.rect.x * 0.02) * 0.08;
      const blocked =
        catBlock &&
        cell.rect.x - 8 <= catBlock.x &&
        catBlock.x <= cell.rect.x + cell.rect.w + 8 &&
        cell.rect.y - 18 <= catBlock.y &&
        catBlock.y <= cell.rect.y + cell.rect.h + 18;
      mesh.visible = mesh.visible && !blocked;
      const hold = run.holding === cell.id;
      mesh.traverse((obj: THREE.Object3D) => {
        const m = obj as THREE.Mesh;
        const mat = m.material as THREE.MeshLambertMaterial | undefined;
        if (mat && "emissive" in mat && "emissiveIntensity" in mat) {
          mat.emissiveIntensity = hold ? 0.45 : 0;
        }
      });
    }
  }

  private syncMenuProducts(t: number): void {
    const ids: ProductId[] = ["pao", "leite", "refri", "biscoito", "macarrao", "suco", "detergente", "cafe"];
    let i = 0;
    for (const [id, mesh] of this.products) {
      const on = ids.includes(id);
      mesh.visible = on;
      if (!on) continue;
      const x = -3.2 + (i % 4) * 2.15;
      const z = 2.6 + Math.floor(i / 4) * 1.3;
      mesh.position.set(x, 1.15, z);
      mesh.scale.setScalar(0.95);
      mesh.rotation.y = t * 0.35 + i * 0.4;
      i += 1;
    }
  }

  private hideCustomers(): void {
    for (const rig of this.customers) rig.root.visible = false;
  }

  private poseMenuCustomers(t: number): void {
    const spots = [
      { x: -1.35, z: -0.15, arch: 0 },
      { x: 1.45, z: 0.05, arch: 2 },
    ];
    spots.forEach((s, i) => {
      const rig = this.customers[i];
      const arch = ARCHETYPES[s.arch] ?? ARCHETYPES[0]!;
      if (!rig) return;
      rig.shirtMat.color.setHex(hexColor(arch.shirt));
      rig.skinMat.color.setHex(hexColor(arch.skin));
      rig.hairMat.color.setHex(hexColor(arch.hair));
      this.styleHair(rig, arch.hairStyle);
      rig.root.visible = true;
      rig.root.position.set(s.x, Math.sin(t * 2 + i) * 0.04, s.z);
      rig.root.scale.setScalar(1.55);
      rig.root.rotation.y = i === 0 ? 0.35 : -0.4;
      (rig.ring.material as THREE.MeshBasicMaterial).opacity = 0;
      rig.ring.visible = false;
    });
  }

  private syncCustomers(run: Run, layout: PlayLayout, selected: number | null, t: number): void {
    this.hideCustomers();
    const waiting = run.customers.filter((c) => c.mood !== "leave" || c.anim < 1);
    waiting.forEach((c, i) => {
      const rig = this.customers[i];
      if (!rig) return;
      this.poseCustomer(rig, c, layout, selected === c.id, t);
    });
  }

  private poseCustomer(rig: CustomerRig, c: Customer, layout: PlayLayout, selected: boolean, t: number): void {
    const slot = layout.slots[c.slot];
    if (!slot) {
      rig.root.visible = false;
      return;
    }
    const arch = ARCHETYPES.find((a) => a.id === c.arch) ?? ARCHETYPES[0]!;
    rig.shirtMat.color.setHex(hexColor(arch.shirt));
    rig.skinMat.color.setHex(hexColor(arch.skin));
    rig.hairMat.color.setHex(hexColor(arch.hair));
    this.styleHair(rig, arch.hairStyle);

    let ox = 0;
    let oy = 0;
    let scale = 1;
    let rot = 0;
    if (c.mood === "enter") {
      const k = 1 - c.anim;
      oy = k * (layout.landscape ? 0 : -0.6);
      ox = layout.landscape ? k * -0.8 : 0;
      scale = 0.82 + c.anim * 0.18;
    }
    if (c.mood === "leave") {
      oy += c.anim * (layout.landscape ? 0 : -0.7);
      ox -= layout.landscape ? c.anim * 0.9 : 0;
      scale = 1 - c.anim * 0.22;
    }
    if (c.mood === "rage") {
      ox += (1 - c.anim) * Math.sin(t * 38 + c.id) * 0.12;
      rot = ox * 0.4;
    }
    if (c.mood === "happy") {
      oy -= Math.sin(Math.min(1, c.anim * 2) * Math.PI) * 0.28;
      scale = 1 + Math.sin(Math.min(1, c.anim * 2) * Math.PI) * 0.08;
    }
    const bob = c.mood === "wait" ? Math.sin(t * 3 + c.id) * 0.03 : 0;
    const hit = this.screenToY(slot.x + slot.w / 2, slot.y + slot.h * 0.78, 0, layout);
    if (!hit) {
      rig.root.visible = false;
      return;
    }
    rig.root.visible = c.mood !== "leave" || c.anim < 0.95;
    rig.root.position.set(hit.x + ox * 0.35, Math.max(0, oy * 0.4 + bob), hit.z);
    rig.root.scale.setScalar(Math.max(0.72, Math.min(1.05, (slot.h / Math.max(layout.h, 1)) * 8)) * scale);
    rig.root.rotation.y = rot;
    rig.armL.rotation.x = c.mood === "happy" ? -0.9 : c.mood === "rage" ? 0.5 : 0;
    rig.armR.rotation.x = c.mood === "happy" ? -0.9 : c.mood === "rage" ? 0.5 : 0;
    const ringMat = rig.ring.material as THREE.MeshBasicMaterial;
    ringMat.opacity = selected ? 0.9 : 0;
    rig.ring.visible = selected;
  }

  private syncCat(run: Run, layout: PlayLayout, t: number): void {
    if (!this.cat) return;
    const on = run.chaos?.kind === "gato";
    this.cat.visible = !!on;
    if (!on) return;
    const hit = this.screenToY(layout.shelves.x + run.catX * layout.shelves.w, layout.catY, 1.2, layout);
    if (!hit) return;
    this.cat.position.set(hit.x, 1.2 + Math.sin(t * 8) * 0.05, hit.z);
    this.cat.scale.setScalar(0.85);
  }

  private syncGhost(ghost: { x: number; y: number; id: ProductId } | null, layout: PlayLayout, t: number): void {
    if (!this.ghostMesh) return;
    if (!ghost) {
      this.ghostMesh.visible = false;
      return;
    }
    const src = this.products.get(ghost.id);
    const hit = this.screenToY(ghost.x, ghost.y, 1.55, layout);
    if (!hit) {
      this.ghostMesh.visible = false;
      return;
    }
    this.ghostMesh.visible = true;
    this.ghostMesh.position.set(hit.x, 1.55 + Math.sin(t * 6) * 0.08, hit.z);
    this.ghostMesh.scale.setScalar(1.05);
    this.ghostMesh.rotation.y = t * 2;
    if (src) this.ghostMesh.visible = true;
  }

  private aimPlayCamera(layout: PlayLayout, run: Run): void {
    if (!this.camera) return;
    const punch = run.punch > 0 ? run.punch * 0.8 : 0;
    const shake = run.shake > 0.4 && !this.fx.reduceMotion ? (Math.random() - 0.5) * run.shake * 0.012 : 0;
    if (layout.landscape) {
      this.camera.position.set(0.15 + shake, 12.4 - punch, 4.6);
      this.camera.lookAt(0, 0.45, 0.2);
    } else {
      this.camera.position.set(shake * 0.6, 13.2 - punch, 3.8);
      this.camera.lookAt(0, 0.4, 0.35);
    }
  }

  private aimMenuCamera(cssW: number, cssH: number, t: number): void {
    if (!this.camera) return;
    const bob = this.fx.reduceMotion ? 0 : Math.sin(t * 0.35) * 0.55;
    this.camera.position.set(0.8 + bob, 7.4, 11.2);
    this.camera.lookAt(0.1, 1.1, -0.8);
    this.camera.aspect = Math.max(1, cssW) / Math.max(1, cssH);
    this.camera.updateProjectionMatrix();
  }
}
