import * as THREE from "three";
import { Renderer } from "expo-three";
import type { ExpoWebGLRenderingContext } from "expo-gl";

const CONFIG = {
  fov: 78,
  speed: 60,
  sprintMult: 1.6,
  jetpackMult: 2.5,
  jumpForce: 25,
  jetpackForce: 145,
  maxJetpackSpeed: 30,
  gravity: 80,
  friction: 10,
  recoilRecovery: 15,
  swayAmount: 0.006,
  swaySmooth: 10,
  standHeight: 2.0,
};

type WeaponConfig = {
  key: string;
  name: string;
  short: string;
  unlockWave: number;
  pellets: number;
  spread: number;
  maxAmmo: number;
  reloadMs: number;
  bodyDmg: number;
  headDmg: number;
  recoil: number;
  fireRate: number;
  auto: boolean;
  flashZ: number;
};

const WEAPONS: WeaponConfig[] = [
  {
    key: "shotgun", name: "SHOTGUN", short: "SG", unlockWave: 1,
    pellets: 8, spread: 0.06, maxAmmo: 5, reloadMs: 1500,
    bodyDmg: 1, headDmg: 2, recoil: 0.18, fireRate: 400, auto: false, flashZ: -0.4,
  },
  {
    key: "smg", name: "SMG", short: "SMG", unlockWave: 2,
    pellets: 1, spread: 0.02, maxAmmo: 30, reloadMs: 1200,
    bodyDmg: 1, headDmg: 2, recoil: 0.09, fireRate: 95, auto: true, flashZ: -0.5,
  },
  {
    key: "rifle", name: "ASSAULT RIFLE", short: "AR", unlockWave: 4,
    pellets: 1, spread: 0.004, maxAmmo: 10, reloadMs: 1500,
    bodyDmg: 3, headDmg: 5, recoil: 0.22, fireRate: 320, auto: false, flashZ: -0.78,
  },
];

export type WeaponInfo = { short: string; name: string; unlocked: boolean; unlockWave: number };

export type GameStats = {
  health: number;
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  score: number;
  wave: number;
  kills: number;
  weaponIndex: number;
  weapons: WeaponInfo[];
};

export type EngineCallbacks = {
  onStats: (s: GameStats) => void;
  onHitMarker: () => void;
  onDamage: () => void;
  onGameOver: (r: { score: number; wave: number; kills: number }) => void;
  onNotify: (msg: string) => void;
  playSound: (name: string) => void;
};

export class GameEngine {
  private gl: ExpoWebGLRenderingContext;
  private renderer: any;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private cb: EngineCallbacks;

  private objects: THREE.Object3D[] = [];
  private enemies: THREE.Group[] = [];
  private particles: any[] = [];
  private pickups: any[] = [];

  private weaponGroup!: THREE.Group;
  private modelHolder!: THREE.Group;
  private muzzleFlash!: THREE.Group;
  private muzzleLight!: THREE.PointLight;

  private playerVelocity = new THREE.Vector3();
  private moveVec = { x: 0, y: 0 };
  private sprint = false;
  private isSpaceHeld = false;
  private spacePressedOnGround = false;
  private jetpackHoldTime = 0;
  private canJump = false;
  private currentEyeLevel = CONFIG.standHeight;

  private currentRecoil = 0;
  private currentRecoilX = 0;
  private currentKickback = 0;
  private swayX = 0;
  private swayY = 0;

  lookSensitivity = 0.008;

  private health = 100;
  private weaponIndex = 0;
  private ammoByWeapon: number[] = WEAPONS.map((w) => w.maxAmmo);
  private reloading = false;
  private reloadStart = 0;
  private score = 0;
  private wave = 1;
  private kills = 0;
  private spawningNextWave = false;

  private prevTime = 0;
  private rafId: any = null;
  private disposed = false;
  paused = false;
  gameOver = false;
  private muzzleTimer: any = null;

  constructor(gl: ExpoWebGLRenderingContext, cb: EngineCallbacks, opts?: { lookSensitivity?: number }) {
    this.gl = gl;
    this.cb = cb;
    if (opts?.lookSensitivity) this.lookSensitivity = opts.lookSensitivity;
    this.init();
    this.prevTime = Date.now();
    this.loop();
  }

  private get weapon() {
    return WEAPONS[this.weaponIndex];
  }
  private get ammo() {
    return this.ammoByWeapon[this.weaponIndex];
  }
  private set ammo(v: number) {
    this.ammoByWeapon[this.weaponIndex] = v;
  }

  isAuto() {
    return this.weapon.auto;
  }
  getFireInterval() {
    return this.weapon.fireRate;
  }

  private init() {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = this.gl;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2740);
    this.scene.fog = new THREE.FogExp2(0x1a2740, 0.006);

    this.camera = new THREE.PerspectiveCamera(CONFIG.fov, w / h, 0.1, 1000);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(0, CONFIG.standHeight, 12);

    this.renderer = new Renderer({ gl: this.gl });
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x1a2740, 1);

    const hemi = new THREE.HemisphereLight(0xafc4ee, 0x2a3a58, 1.5);
    this.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xffffff, 1.9);
    moon.position.set(10, 24, 8);
    this.scene.add(moon);
    const fill = new THREE.DirectionalLight(0x00ffff, 0.5);
    fill.position.set(-12, 8, -10);
    this.scene.add(fill);
    const ambient = new THREE.AmbientLight(0x3a4c70, 1.5);
    this.scene.add(ambient);

    this.buildWorld();
    this.createWeapon();
    this.spawnWave(5, 1);
    this.emitStats();
  }

  private buildWorld() {
    const floorGeo = new THREE.PlaneGeometry(220, 220);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ color: 0x233350 }));
    this.scene.add(floor);

    const grid = new THREE.GridHelper(220, 110, 0x2affff, 0x2a6a9a);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as any).opacity = 0.8;
    this.scene.add(grid);

    const boxMat = new THREE.MeshPhongMaterial({ color: 0x46587a, specular: 0x1a222f, shininess: 25 });
    const neonGreen = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    for (let i = 0; i < 30; i++) {
      const size = 2 + Math.random() * 6;
      const height = size * (1 + Math.random());
      const geometry = new THREE.BoxGeometry(size, height, size);
      let material: THREE.Material = boxMat;
      const r = Math.random();
      if (r > 0.92) material = neonGreen;
      else if (r > 0.86) material = neonCyan;
      const box = new THREE.Mesh(geometry, material);
      let x = (Math.random() - 0.5) * 150;
      let z = (Math.random() - 0.5) * 150;
      if (Math.abs(x) < 12 && Math.abs(z) < 12) x += 22;
      box.position.set(x, height / 2, z);
      this.scene.add(box);
      box.userData.aabb = new THREE.Box3().setFromObject(box);
      this.objects.push(box);
    }
  }

  private spawnWave(count: number, wave: number) {
    for (let i = 0; i < count; i++) this.spawnZombie(wave);
  }

  private spawnZombie(wave: number) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x4a7a2c });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x223a66 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1a1f4a });
    const faceZ = 0.5 / 2 + 0.05 / 2;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin.clone());
    head.position.y = 1.75;
    head.name = "Head";
    g.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x162a0c });
    const le = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
    le.position.set(0.12, 1.85, faceZ);
    le.name = "Head";
    g.add(le);
    const re = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
    re.position.set(-0.12, 1.85, faceZ);
    re.name = "Head";
    g.add(re);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), mouthMat);
    mouth.position.set(0, 1.65, faceZ);
    mouth.name = "Head";
    g.add(mouth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), shirt.clone());
    body.position.y = 1.15;
    g.add(body);

    const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    armGeo.translate(0, -0.35, 0);
    const leftArm = new THREE.Mesh(armGeo, skin.clone());
    leftArm.position.set(0.35, 1.5, 0);
    leftArm.rotation.x = -Math.PI / 2;
    g.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, skin.clone());
    rightArm.position.set(-0.35, 1.5, 0);
    rightArm.rotation.x = -Math.PI / 2;
    g.add(rightArm);

    const legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    legGeo.translate(0, -0.4, 0);
    const leftLeg = new THREE.Mesh(legGeo, pants.clone());
    leftLeg.position.set(0.13, 0.8, 0);
    g.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, pants.clone());
    rightLeg.position.set(-0.13, 0.8, 0);
    g.add(rightLeg);

    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 25;
    g.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    g.userData = {
      type: "zombie",
      health: 3 + Math.floor(wave / 2),
      speed: 1.6 + Math.random() * 1.2 + wave * 0.15,
      walkProgress: Math.random() * 100,
      bias: Math.random() < 0.5 ? 1 : -1,
      lastBite: 0,
      limbs: { leftLeg, rightLeg, leftArm, rightArm },
    };

    this.scene.add(g);
    this.enemies.push(g);
  }

  // ---------------- Weapon models ----------------
  private buildShotgun(): THREE.Group {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a1e0d, roughness: 0.6 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x14141a, metalness: 0.9, roughness: 0.3 });
    const receiverMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, metalness: 0.7, roughness: 0.4 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.3 });
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.24), receiverMat));

    const shellRedMat = new THREE.MeshStandardMaterial({ color: 0xe62e2e, roughness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const shell = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 12), shellRedMat);
      hull.position.set(0, -0.02, 0);
      shell.add(hull);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), brassMat);
      base.position.set(0, 0.06, 0);
      shell.add(base);
      shell.position.set(-0.1 + i * 0.1, 0.05, -0.18);
      shell.rotation.x = -0.15;
      model.add(shell);
    }
    const stockShape = new THREE.Shape();
    stockShape.moveTo(0, 0.1);
    stockShape.bezierCurveTo(-0.6, 0.15, -1.2, 0.05, -1.8, -0.4);
    stockShape.lineTo(-1.85, -0.8);
    stockShape.lineTo(-1.5, -0.8);
    stockShape.bezierCurveTo(-1.2, -0.4, -0.6, -0.1, 0, -0.1);
    const extrude = { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 };
    const stock = new THREE.Mesh(new THREE.ExtrudeGeometry(stockShape, extrude), woodMat);
    stock.position.set(-0.4, 0, -0.12);
    model.add(stock);
    const barrelGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.2, 16);
    barrelGeo.rotateZ(Math.PI / 2);
    const lb = new THREE.Mesh(barrelGeo, metalMat);
    lb.position.set(2, 0.02, -0.045);
    model.add(lb);
    const rb = new THREE.Mesh(barrelGeo, metalMat);
    rb.position.set(2, 0.02, 0.045);
    model.add(rb);
    model.rotation.y = Math.PI / 2;
    model.scale.set(0.12, 0.12, 0.12);
    model.position.set(0, -0.02, 0.1);
    return model;
  }

  private buildSMG(): THREE.Group {
    const dark = new THREE.MeshStandardMaterial({ color: 0x181c22, metalness: 0.7, roughness: 0.45 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const model = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5), dark);
    model.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 12), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.4);
    model.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.1), dark);
    mag.position.set(0, -0.18, 0.02);
    model.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), dark);
    grip.position.set(0, -0.12, 0.2);
    grip.rotation.x = 0.2;
    model.add(grip);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.4), accent);
    strip.position.set(0.07, 0.06, -0.05);
    model.add(strip);
    model.position.set(0, 0, 0);
    return model;
  }

  private buildRifle(): THREE.Group {
    const dark = new THREE.MeshStandardMaterial({ color: 0x14181c, metalness: 0.8, roughness: 0.4 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const model = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.72), dark);
    body.position.set(0, 0, -0.05);
    model.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 12), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.6);
    model.add(barrel);
    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 12), dark);
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.14, -0.05);
    model.add(scopeBody);
    const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.12), dark);
    scopeMount.position.set(0, 0.09, -0.05);
    model.add(scopeMount);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.1), dark);
    mag.position.set(0, -0.19, 0.04);
    mag.rotation.x = -0.15;
    model.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), dark);
    grip.position.set(0, -0.12, 0.24);
    grip.rotation.x = 0.25;
    model.add(grip);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.5), accent);
    strip.position.set(0.07, 0.07, -0.1);
    model.add(strip);
    return model;
  }

  private createWeapon() {
    this.weaponGroup = new THREE.Group();
    this.modelHolder = new THREE.Group();
    this.weaponGroup.add(this.modelHolder);

    const flashGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.muzzleFlash = new THREE.Group();
    const f1 = new THREE.Mesh(flashGeo, flashMat);
    const f2 = new THREE.Mesh(flashGeo, flashMat.clone());
    f2.rotation.x = Math.PI / 2;
    this.muzzleFlash.add(f1);
    this.muzzleFlash.add(f2);
    this.weaponGroup.add(this.muzzleFlash);

    this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
    this.weaponGroup.add(this.muzzleLight);

    this.weaponGroup.position.set(0.2, -0.25, -0.3);
    this.camera.add(this.weaponGroup);
    this.scene.add(this.camera);

    this.equipModel();
  }

  private equipModel() {
    this.modelHolder.clear();
    let model: THREE.Group;
    if (this.weapon.key === "smg") model = this.buildSMG();
    else if (this.weapon.key === "rifle") model = this.buildRifle();
    else model = this.buildShotgun();
    this.modelHolder.add(model);
    const z = this.weapon.flashZ;
    this.muzzleFlash.position.set(0, 0.01, z);
    this.muzzleLight.position.set(0, 0.1, z - 0.05);
  }

  switchWeapon(index: number) {
    if (index === this.weaponIndex) return;
    const cfg = WEAPONS[index];
    if (!cfg || cfg.unlockWave > this.wave) return;
    this.weaponIndex = index;
    this.reloading = false;
    this.equipModel();
    this.cb.playSound("switch");
    this.cb.onNotify(cfg.name);
    this.emitStats();
  }

  // ---------------- Input ----------------
  setMove(x: number, y: number, sprint: boolean) {
    this.moveVec.x = x;
    this.moveVec.y = y;
    this.sprint = sprint;
  }

  applyLook(dx: number, dy: number) {
    if (this.paused || this.gameOver) return;
    this.camera.rotation.y -= dx * this.lookSensitivity;
    this.camera.rotation.x -= dy * this.lookSensitivity;
    this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
    const maxSway = 0.15;
    this.swayX = Math.max(-maxSway, Math.min(maxSway, -dx * CONFIG.swayAmount));
    this.swayY = Math.max(-maxSway, Math.min(maxSway, -dy * CONFIG.swayAmount));
  }

  jumpDown() {
    if (this.paused || this.gameOver) return;
    this.isSpaceHeld = true;
    this.spacePressedOnGround = this.canJump;
    if (this.canJump) {
      this.playerVelocity.y += CONFIG.jumpForce;
      this.canJump = false;
    }
  }
  jumpUp() {
    this.isSpaceHeld = false;
  }

  reload() {
    if (this.reloading || this.ammo === this.weapon.maxAmmo || this.gameOver) return;
    this.reloading = true;
    this.reloadStart = Date.now();
    this.cb.playSound("reload");
    this.emitStats();
  }

  shoot() {
    if (this.paused || this.gameOver || !this.weaponGroup) return;
    if (this.reloading) return;
    if (this.ammo <= 0) {
      this.cb.playSound("empty");
      this.reload();
      return;
    }

    const wpn = this.weapon;
    this.ammo = this.ammo - 1;
    this.cb.playSound(wpn.key);
    this.emitStats();

    this.currentRecoil = wpn.recoil;
    this.currentRecoilX = (Math.random() - 0.5) * 0.05;
    this.currentKickback = 0.15;

    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    const fs = 0.35 + Math.random() * 0.2;
    this.muzzleFlash.scale.set(fs, fs, fs);
    this.muzzleFlash.children.forEach((c: any) => (c.material.opacity = 1));
    this.muzzleLight.intensity = 1.5 + Math.random() * 0.5;
    if (this.muzzleTimer) clearTimeout(this.muzzleTimer);
    this.muzzleTimer = setTimeout(() => {
      if (this.disposed) return;
      this.muzzleFlash.children.forEach((c: any) => (c.material.opacity = 0));
      this.muzzleLight.intensity = 0;
    }, 55);

    const base = new THREE.Raycaster();
    base.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const origin = base.ray.origin.clone();
    const baseDir = base.ray.direction.clone();
    const right = new THREE.Vector3().crossVectors(baseDir, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, baseDir).normalize();
    const candidates = [...this.objects, ...this.enemies];
    let hitZombie = false;

    for (let i = 0; i < wpn.pellets; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * wpn.spread;
      const spreadVec = new THREE.Vector3()
        .addScaledVector(right, Math.cos(angle) * radius)
        .addScaledVector(up, Math.sin(angle) * radius);
      const dir = baseDir.clone().add(spreadVec).normalize();
      const rc = new THREE.Raycaster(origin, dir);
      const hits = rc.intersectObjects(candidates, true);
      if (hits.length > 0) {
        const hit = hits[0];
        this.createImpact(hit.point, (hit.face as any).normal);
        let target: any = hit.object;
        const headshot = hit.object.name === "Head";
        const dmg = headshot ? wpn.headDmg : wpn.bodyDmg;
        while (target.parent && target.parent !== this.scene) target = target.parent;
        if (target.userData?.type === "zombie") {
          target.userData.health -= dmg;
          hitZombie = true;
          const mat = (hit.object as any).material;
          if (mat?.emissive) {
            mat.emissive.setHex(0xff0000);
            setTimeout(() => {
              if (mat?.emissive) mat.emissive.setHex(0x000000);
            }, 90);
          }
          if (target.userData.health <= 0 && target.parent === this.scene) {
            this.killZombie(target, headshot);
          }
        }
      }
    }

    if (hitZombie) this.cb.onHitMarker();
    if (this.ammo <= 0) setTimeout(() => this.reload(), 200);
  }

  private killZombie(target: THREE.Group, headshot: boolean) {
    this.createDeath(target.position);
    this.maybeDropPickup(target.position);
    this.scene.remove(target);
    const idx = this.enemies.indexOf(target);
    if (idx > -1) this.enemies.splice(idx, 1);
    this.kills++;
    this.score += 100 + (headshot ? 50 : 0);
    this.emitStats();

    if (this.enemies.length === 0 && !this.spawningNextWave) {
      this.spawningNextWave = true;
      setTimeout(() => {
        if (this.disposed || this.gameOver) return;
        const prevWave = this.wave;
        this.wave++;
        const count = Math.min(4 + this.wave * 2, 18);
        this.cb.playSound("wave");
        this.spawnWave(count, this.wave);
        this.spawningNextWave = false;
        // Weapon unlock notifications
        WEAPONS.forEach((wcfg) => {
          if (wcfg.unlockWave > prevWave && wcfg.unlockWave <= this.wave) {
            this.cb.onNotify(`ARME DÉBLOQUÉE: ${wcfg.name}`);
          }
        });
        this.emitStats();
      }, 1200);
    }
  }

  private maybeDropPickup(position: THREE.Vector3) {
    const r = Math.random();
    let type: "health" | "ammo" | null = null;
    if (r < 0.18) type = "health";
    else if (r < 0.45) type = "ammo";
    if (!type) return;

    const group = new THREE.Group();
    if (type === "health") {
      const mat = new THREE.MeshStandardMaterial({ color: 0xff003c, emissive: 0xff003c, emissiveIntensity: 0.6 });
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.15), mat);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), mat);
      group.add(v);
      group.add(h);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffb000, emissive: 0xffb000, emissiveIntensity: 0.5 });
      group.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.45), mat));
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.08, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x14141a })
      );
      strip.position.y = 0.05;
      group.add(strip);
    }
    group.position.set(position.x, 0.8, position.z);
    group.userData = { type, spin: Math.random() * Math.PI };
    this.scene.add(group);
    this.pickups.push(group);
  }

  revive() {
    this.health = 100;
    this.gameOver = false;
    this.paused = false;
    this.ammo = this.weapon.maxAmmo;
    this.reloading = false;
    this.enemies.forEach((z) => {
      const dir = new THREE.Vector3().subVectors(z.position, this.camera.position);
      dir.y = 0;
      if (dir.length() < 20) {
        dir.normalize().multiplyScalar(22);
        z.position.x = this.camera.position.x + dir.x;
        z.position.z = this.camera.position.z + dir.z;
      }
    });
    this.prevTime = Date.now();
    this.emitStats();
  }

  restart() {
    this.enemies.forEach((e) => this.scene.remove(e));
    this.enemies = [];
    this.particles.forEach((p) => this.scene.remove(p.mesh));
    this.particles = [];
    this.pickups.forEach((p) => this.scene.remove(p));
    this.pickups = [];
    this.health = 100;
    this.weaponIndex = 0;
    this.ammoByWeapon = WEAPONS.map((w) => w.maxAmmo);
    this.reloading = false;
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.gameOver = false;
    this.paused = false;
    this.spawningNextWave = false;
    this.playerVelocity.set(0, 0, 0);
    this.camera.position.set(0, CONFIG.standHeight, 12);
    this.camera.rotation.set(0, 0, 0);
    this.equipModel();
    this.spawnWave(5, 1);
    this.prevTime = Date.now();
    this.emitStats();
  }

  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
    this.prevTime = Date.now();
  }

  private emitStats() {
    this.cb.onStats({
      health: Math.max(0, Math.round(this.health)),
      ammo: this.ammo,
      maxAmmo: this.weapon.maxAmmo,
      reloading: this.reloading,
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      weaponIndex: this.weaponIndex,
      weapons: WEAPONS.map((w) => ({
        short: w.short,
        name: w.name,
        unlocked: w.unlockWave <= this.wave,
        unlockWave: w.unlockWave,
      })),
    });
  }

  private createDeath(position: THREE.Vector3) {
    const count = 15;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < count; i++)
      positions.push(position.x + (Math.random() - 0.5), position.y + 1 + (Math.random() - 0.5), position.z + (Math.random() - 0.5));
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ size: 0.18, color: 0xaa0000, transparent: true, depthWrite: false });
    const ps = new THREE.Points(geometry, material);
    this.scene.add(ps);
    const velocities = [];
    for (let i = 0; i < count; i++)
      velocities.push({ x: (Math.random() - 0.5) * 8, y: Math.random() * 8 + 4, z: (Math.random() - 0.5) * 8 });
    this.particles.push({ mesh: ps, velocities, life: 1.0 });
  }

  private createImpact(point: THREE.Vector3, normal: THREE.Vector3) {
    const count = 4;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      positions.push(point.x, point.y, point.z);
      c.setHex(Math.random() > 0.5 ? 0xffaa00 : 0x99ff88);
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.15, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ps = new THREE.Points(geometry, material);
    this.scene.add(ps);
    const velocities = [];
    for (let i = 0; i < count; i++)
      velocities.push({
        x: normal.x * 4 + (Math.random() - 0.5) * 8,
        y: normal.y * 4 + (Math.random() - 0.5) * 8 + 4,
        z: normal.z * 4 + (Math.random() - 0.5) * 8,
      });
    this.particles.push({ mesh: ps, velocities, life: 1.0 });
  }

  private triggerGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.health = 0;
    this.cb.playSound("gameover");
    this.emitStats();
    this.cb.onGameOver({ score: this.score, wave: this.wave, kills: this.kills });
  }

  private loop = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    this.update();
    this.renderer.render(this.scene, this.camera);
    this.gl.endFrameEXP();
  };

  private update() {
    const time = Date.now();
    let delta = (time - this.prevTime) / 1000;
    this.prevTime = time;
    if (delta > 0.1) delta = 0.1;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta * 1.5;
      const pos = p.mesh.geometry.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        p.velocities[j].y -= 25 * delta;
        let px = pos.getX(j) + p.velocities[j].x * delta;
        let py = pos.getY(j) + p.velocities[j].y * delta;
        let pz = pos.getZ(j) + p.velocities[j].z * delta;
        if (py <= 0.05) {
          py = 0.05;
          p.velocities[j].y *= -0.4;
          p.velocities[j].x *= 0.6;
          p.velocities[j].z *= 0.6;
        }
        pos.setXYZ(j, px, py, pz);
      }
      pos.needsUpdate = true;
      p.mesh.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    if (this.paused || this.gameOver) return;

    // pickups: spin, bob, collect
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.rotation.y += delta * 2;
      pk.position.y = 0.8 + Math.sin(time * 0.004 + pk.userData.spin) * 0.15;
      const dx = pk.position.x - this.camera.position.x;
      const dz = pk.position.z - this.camera.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < 1.8) {
        if (pk.userData.type === "health") {
          this.health = Math.min(100, this.health + 25);
          this.cb.onNotify("+25 SANTÉ");
        } else {
          this.ammo = this.weapon.maxAmmo;
          this.reloading = false;
          this.cb.onNotify("MUNITIONS +");
        }
        this.cb.playSound("pickup");
        this.scene.remove(pk);
        this.pickups.splice(i, 1);
        this.emitStats();
      }
    }

    if (this.reloading && time - this.reloadStart >= this.weapon.reloadMs) {
      this.reloading = false;
      this.ammo = this.weapon.maxAmmo;
      this.emitStats();
    }

    this.playerVelocity.x -= this.playerVelocity.x * CONFIG.friction * delta;
    this.playerVelocity.z -= this.playerVelocity.z * CONFIG.friction * delta;
    this.playerVelocity.y -= CONFIG.gravity * delta;

    let jetpack = false;
    if (this.sprint && this.isSpaceHeld) {
      this.jetpackHoldTime += delta;
      const threshold = this.spacePressedOnGround ? 1.3 : 0.0;
      if (this.jetpackHoldTime >= threshold) {
        jetpack = true;
        this.playerVelocity.y += CONFIG.jetpackForce * delta;
        if (this.playerVelocity.y > CONFIG.maxJetpackSpeed) this.playerVelocity.y = CONFIG.maxJetpackSpeed;
        this.canJump = false;
      }
    } else {
      this.jetpackHoldTime = 0;
    }

    const yaw = this.camera.rotation.y;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const rightV = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const inputDir = new THREE.Vector3();
    const hasInput = this.moveVec.x !== 0 || this.moveVec.y !== 0;
    if (hasInput) {
      inputDir.add(forward.clone().multiplyScalar(this.moveVec.y));
      inputDir.add(rightV.clone().multiplyScalar(this.moveVec.x));
      inputDir.normalize();
    }

    let speedMult = 1.0;
    if (jetpack) speedMult = CONFIG.jetpackMult;
    else if (this.sprint) speedMult = CONFIG.sprintMult;
    const speed = CONFIG.speed * speedMult;
    if (hasInput) {
      this.playerVelocity.x += inputDir.x * speed * delta;
      this.playerVelocity.z += inputDir.z * speed * delta;
    }

    const playerRadius = 0.5;
    this.currentEyeLevel = THREE.MathUtils.lerp(this.currentEyeLevel, CONFIG.standHeight, delta * 10);

    this.camera.position.y += this.playerVelocity.y * delta;
    if (this.camera.position.y < this.currentEyeLevel) {
      this.playerVelocity.y = 0;
      this.camera.position.y = this.currentEyeLevel;
      this.canJump = true;
    }

    for (const obj of this.objects) {
      const box = obj.userData.aabb as THREE.Box3;
      if (
        this.camera.position.x >= box.min.x - playerRadius &&
        this.camera.position.x <= box.max.x + playerRadius &&
        this.camera.position.z >= box.min.z - playerRadius &&
        this.camera.position.z <= box.max.z + playerRadius
      ) {
        const feetY = this.camera.position.y - this.currentEyeLevel;
        if (this.playerVelocity.y <= 0 && feetY < box.max.y && feetY > box.max.y - 1.0) {
          this.camera.position.y = box.max.y + this.currentEyeLevel;
          this.playerVelocity.y = 0;
          this.canJump = true;
        }
      }
    }

    this.camera.position.x += this.playerVelocity.x * delta;
    for (const obj of this.objects) {
      const box = (obj.userData.aabb as THREE.Box3).clone().expandByScalar(playerRadius);
      const feetY = this.camera.position.y - this.currentEyeLevel;
      if (feetY < box.max.y - 0.1 && box.containsPoint(this.camera.position)) {
        this.camera.position.x -= this.playerVelocity.x * delta;
        this.playerVelocity.x = 0;
      }
    }
    this.camera.position.z += this.playerVelocity.z * delta;
    for (const obj of this.objects) {
      const box = (obj.userData.aabb as THREE.Box3).clone().expandByScalar(playerRadius);
      const feetY = this.camera.position.y - this.currentEyeLevel;
      if (feetY < box.max.y - 0.1 && box.containsPoint(this.camera.position)) {
        this.camera.position.z -= this.playerVelocity.z * delta;
        this.playerVelocity.z = 0;
      }
    }

    let damagedThisFrame = false;
    this.enemies.forEach((z) => {
      const target = new THREE.Vector3(this.camera.position.x, z.position.y, this.camera.position.z);
      z.lookAt(target);
      const distance = z.position.distanceTo(this.camera.position);
      const ud = z.userData as any;

      if (distance > 1.5) {
        const direction = new THREE.Vector3().subVectors(this.camera.position, z.position);
        direction.y = 0;
        direction.normalize();
        const moveDist = ud.speed * delta;
        const dx = direction.x * moveDist;
        const dz = direction.z * moveDist;
        const zr = 0.5;
        let hitX = false;
        let hitZ = false;

        z.position.x += dx;
        for (const obj of this.objects) {
          const box = obj.userData.aabb as THREE.Box3;
          if (z.position.x + zr > box.min.x && z.position.x - zr < box.max.x && z.position.z + zr > box.min.z && z.position.z - zr < box.max.z) {
            hitX = true;
            z.position.x -= dx;
            break;
          }
        }
        z.position.z += dz;
        for (const obj of this.objects) {
          const box = obj.userData.aabb as THREE.Box3;
          if (z.position.x + zr > box.min.x && z.position.x - zr < box.max.x && z.position.z + zr > box.min.z && z.position.z - zr < box.max.z) {
            hitZ = true;
            z.position.z -= dz;
            break;
          }
        }
        if (hitX && !hitZ && Math.abs(direction.z) < 0.3) z.position.z += moveDist * ud.bias;
        else if (hitZ && !hitX && Math.abs(direction.x) < 0.3) z.position.x += moveDist * ud.bias;
        else if (hitX && hitZ) ud.bias *= -1;

        ud.walkProgress += moveDist * 3.5;
        const wlk = ud.walkProgress;
        const { leftLeg, rightLeg, leftArm, rightArm } = ud.limbs;
        const legAngle = Math.sin(wlk) * 0.6;
        leftLeg.rotation.x = legAngle;
        rightLeg.rotation.x = -legAngle;
        z.position.y = Math.abs(Math.cos(wlk)) * 0.05;
        const armBounce = Math.abs(Math.cos(wlk)) * 0.03;
        leftArm.rotation.x = -Math.PI / 2 + armBounce;
        rightArm.rotation.x = -Math.PI / 2 + armBounce;
      } else {
        z.position.y = 0;
        if (time - ud.lastBite > 800) {
          ud.lastBite = time;
          this.health -= 9;
          damagedThisFrame = true;
        }
      }
    });

    if (damagedThisFrame) {
      this.cb.onDamage();
      this.emitStats();
      if (this.health <= 0) {
        this.triggerGameOver();
        return;
      }
    }

    this.swayX = THREE.MathUtils.lerp(this.swayX, 0, delta * CONFIG.swaySmooth);
    this.swayY = THREE.MathUtils.lerp(this.swayY, 0, delta * CONFIG.swaySmooth);
    this.currentRecoil = THREE.MathUtils.lerp(this.currentRecoil, 0, delta * CONFIG.recoilRecovery);
    this.currentRecoilX = THREE.MathUtils.lerp(this.currentRecoilX, 0, delta * CONFIG.recoilRecovery);
    this.currentKickback = THREE.MathUtils.lerp(this.currentKickback, 0, delta * CONFIG.recoilRecovery);

    const speedMag = Math.sqrt(this.playerVelocity.x ** 2 + this.playerVelocity.z ** 2);
    let bobX = 0;
    let bobY = 0;
    if (speedMag > 0.5) {
      const intensity = this.sprint ? 0.0012 : 0.0008;
      bobX = Math.cos(time * 0.015) * speedMag * intensity;
      bobY = Math.abs(Math.sin(time * 0.015)) * speedMag * intensity;
    } else {
      bobX = Math.cos(time * 0.0015) * 0.003;
      bobY = Math.sin(time * 0.003) * 0.003;
    }

    let reloadRotX = 0;
    let reloadRotZ = 0;
    let reloadPosY = 0;
    if (this.reloading) {
      const progress = (time - this.reloadStart) / this.weapon.reloadMs;
      const dip = Math.sin(Math.min(progress, 1) * Math.PI);
      reloadRotX = dip * -0.8;
      reloadRotZ = dip * 0.4;
      reloadPosY = dip * -0.4;
    }

    if (this.weaponGroup) {
      this.weaponGroup.rotation.x = -this.swayY + this.currentRecoil + reloadRotX;
      this.weaponGroup.rotation.y = -this.swayX + this.currentRecoilX;
      this.weaponGroup.rotation.z = reloadRotZ;
      const hipPos = { x: 0.2, y: -0.25, z: -0.3 };
      const blend = delta * 15;
      this.weaponGroup.position.x = THREE.MathUtils.lerp(this.weaponGroup.position.x, hipPos.x + bobX - this.swayX * 0.5, blend);
      this.weaponGroup.position.y = THREE.MathUtils.lerp(this.weaponGroup.position.y, hipPos.y + bobY - this.swayY * 0.5, blend) + reloadPosY;
      this.weaponGroup.position.z = THREE.MathUtils.lerp(this.weaponGroup.position.z, hipPos.z + this.currentKickback + this.currentRecoil * 0.2, blend);
    }
  }

  dispose() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.muzzleTimer) clearTimeout(this.muzzleTimer);
  }
}
