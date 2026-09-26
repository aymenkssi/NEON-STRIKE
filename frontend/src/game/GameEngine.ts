import * as THREE from "three";
import { Renderer } from "expo-three";
import type { ExpoWebGLRenderingContext } from "expo-gl";
import { buildWorld, type World, type WorldQuality } from "./world";
import { CITIES } from "./cities";
import { buildZombie, disposeZombie } from "./characters";
import { MUZZLE, VIEW, buildWeaponModel } from "./weapons";
import { WEAPONS, weaponOf, type FireMode, type WeaponConfig } from "./armory";
import {
  CREDITS_PER_BOSS,
  CREDITS_PER_HEADSHOT,
  getLevelConfig,
  modifiersFrom,
  NO_UPGRADES,
  type Difficulty,
  type LevelConfig,
  type LevelResult,
  type PlayerModifiers,
} from "./progression";
import {
  COMBO_WINDOW_MS,
  EXPLOSION,
  HASTE_MULT,
  POWERUPS,
  POWERUP_DROP_CHANCE,
  RAGE_MULT,
  SPIT,
  ZOMBIES,
  comboBonus,
  comboLabel,
  pickZombieKind,
  sectorOf,
  type PowerUpKind,
  type Sector,
  type ZombieKind,
} from "./content";
import { t, type Key } from "../i18n";

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

// SINGLE: one round per tap. BURST: 3 rounds per tap. AUTO: fires while the trigger is held.
export type { FireMode } from "./armory";
export const FIRE_MODE_LABEL: Record<FireMode, Key> = { single: "fire.single", burst: "fire.burst", auto: "fire.auto" };
const BURST_ROUNDS = 3;

// Projectiles: grenades arc and bounce off nothing; rockets fly straight and hit harder.
const PROJECTILE = {
  grenade: { speed: 32, lift: 6, gravity: 22, damage: 14, radius: 4.5, fuseMs: 3000 },
  rocket: { speed: 55, lift: 0.5, gravity: 2, damage: 30, radius: 7, fuseMs: 3000 },
};

// Soft star-shaped glow for the muzzle flash (generated: no image file needed on the phone).
let flashTex: THREE.DataTexture | null = null;
function flashTexture() {
  if (flashTex) return flashTex;
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N - 0.5;
      const dy = (y + 0.5) / N - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const rays = Math.pow(Math.abs(Math.cos(Math.atan2(dy, dx) * 3)), 6) * 0.6;
      const a = Math.max(0, 1 - r / (0.45 + rays * 0.55));
      const v = Math.round(Math.min(1, a * a * 1.4) * 255);
      data.set([255, 255, 255, v], (y * N + x) * 4);
    }
  flashTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  flashTex.needsUpdate = true;
  return flashTex;
}

export type WeaponInfo = { key: string; short: string };

export type GameStats = {
  health: number;
  maxHealth: number;
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  score: number;
  level: number;
  wave: number; // wave inside the current level (1-based)
  totalWaves: number;
  kills: number;
  credits: number; // credits picked up during the current level
  boss: { health: number; max: number } | null;
  weaponIndex: number;
  weapons: WeaponInfo[]; // the loadout (weapons carried in this game)
  fireMode: FireMode;
  fireModes: FireMode[]; // modes of the current weapon (MODE button hidden when only one)
  sector: { index: number; name: string };
  powerups: { kind: PowerUpKind; remaining: number }[]; // seconds left, active ones only
  difficulty: Difficulty;
};

export type EngineOptions = {
  loadout?: string[]; // weapon keys chosen in the Armory (up to 4)
  aimAssist: boolean;
  invertY: boolean;
  quality: WorldQuality;
  weaponSkin?: string;
  outfit?: string;
};

// Aim assist: a light slow-down on targets and a gentle pull while the player aims or fires.
const ASSIST = {
  frictionAngle: 0.06, // radians around the crosshair where the view slows down
  friction: 0.55,
  pullAngle: 0.1, // radians where the view is pulled toward the target
  strength: 4, // pull speed (per second)
  range: 45, // metres
};

export type RunResult = { score: number; level: number; kills: number; credits: number };

// Gameplay facts consumed by missions, achievements and player stats.
export type GameEvent =
  | { type: "kill"; kind: ZombieKind | "boss"; headshot: boolean; combo: number; byExplosion: boolean }
  | { type: "powerup"; kind: PowerUpKind }
  | { type: "death" };

export type EngineCallbacks = {
  onStats: (s: GameStats) => void;
  onHitMarker: () => void;
  onDamage: () => void;
  onGameOver: (r: RunResult) => void;
  onLevelComplete: (r: LevelResult) => void;
  onNotify: (msg: string) => void;
  playSound: (name: string) => void;
  onEvent?: (e: GameEvent) => void;
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
  // Options from the Settings panel (see use-game-settings.ts) and the equipped skins.
  private opts: EngineOptions = { aimAssist: true, invertY: false, quality: "normal", weaponSkin: undefined, outfit: undefined };
  private difficulty: Difficulty = "normal";
  private lastLookAt = 0;
  private lastFrameAt = 0;
  private spits: { mesh: THREE.Mesh; vel: THREE.Vector3; born: number; damage: number }[] = [];

  private mods: PlayerModifiers = modifiersFrom(NO_UPGRADES);
  private unlockedLevel = 1;
  private levelCfg: LevelConfig = getLevelConfig(1);
  private health = 100;
  private weaponIndex = 0;
  // Trigger: shots are timed by the game loop so every fire mode respects the weapon's rate.
  private arms: WeaponConfig[] = [WEAPONS[1]]; // the loadout
  private fireModeByWeapon: number[] = [0];
  private triggerHeld = false;
  private queuedShot = false; // tap during the cooldown: fired as soon as the weapon is ready
  private nextShotAt = 0;
  private burstLeft = 0;
  private nextBurstAt = 0;
  private ammoByWeapon: number[] = [0];
  private reloading = false;
  private reloadStart = 0;
  private score = 0;
  private wave = 1;
  private kills = 0;
  private levelKills = 0;
  private levelHeadshots = 0;
  private levelCredits = 0;
  private boss: THREE.Group | null = null;
  private spawningNextWave = false;
  levelComplete = false;

  private sector: Sector = sectorOf(1);
  private world: THREE.Group | null = null;
  private worldInfo: World | null = null;
  private spawnPoints: THREE.Vector3[] = [];
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private ambient!: THREE.AmbientLight;
  private combo = 0;
  private lastKillAt = 0;
  private powerUntil: Partial<Record<PowerUpKind, number>> = {};
  private lastPowerEmit = 0;
  private shake = 0;
  private shakeOffset = new THREE.Vector3();
  private flashes: { light: THREE.PointLight; ring: THREE.Mesh; life: number }[] = [];
  private grenades: { mesh: THREE.Mesh; vel: THREE.Vector3; born: number; kind: "grenade" | "rocket" }[] = [];
  private beams: { line: THREE.Line; life: number }[] = [];

  private prevTime = 0;
  private rafId: any = null;
  private disposed = false;
  paused = false;
  gameOver = false;
  private muzzleTimer: any = null;

  constructor(
    gl: ExpoWebGLRenderingContext,
    cb: EngineCallbacks,
    opts?: {
      lookSensitivity?: number;
      level?: number;
      unlockedLevel?: number;
      modifiers?: PlayerModifiers;
      difficulty?: Difficulty;
      options?: Partial<EngineOptions>;
    }
  ) {
    this.gl = gl;
    this.cb = cb;
    if (opts?.lookSensitivity) this.lookSensitivity = opts.lookSensitivity;
    if (opts?.modifiers) this.mods = opts.modifiers;
    if (opts?.options) this.opts = { ...this.opts, ...opts.options };
    this.difficulty = opts?.difficulty ?? "normal";
    this.levelCfg = getLevelConfig(opts?.level ?? 1, this.difficulty);
    this.unlockedLevel = Math.max(opts?.unlockedLevel ?? 1, this.levelCfg.level);
    this.health = this.mods.maxHealth;
    this.setLoadout(this.opts.loadout);
    this.init();
    this.prevTime = Date.now();
    this.loop();
  }

  private get weapon() {
    return this.arms[this.weaponIndex] ?? this.arms[0];
  }
  private maxAmmoOf(i: number) {
    return Math.round(this.arms[i].maxAmmo * this.mods.ammoMult);
  }
  private get reloadMs() {
    return this.weapon.reloadMs * this.mods.reloadMult;
  }
  private get ammo() {
    return this.ammoByWeapon[this.weaponIndex];
  }
  private set ammo(v: number) {
    this.ammoByWeapon[this.weaponIndex] = v;
  }

  private get fireMode(): FireMode {
    return this.weapon.modes[this.fireModeByWeapon[this.weaponIndex]] ?? this.weapon.modes[0];
  }

  private init() {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = this.gl;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(CONFIG.fov, w / h, 0.1, 1000);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(0, CONFIG.standHeight, 12);

    this.renderer = new Renderer({ gl: this.gl });
    this.renderer.setSize(w, h);

    // Colours and intensities come from the time of day of each level (see cities.ts).
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.hemi, this.sun, this.ambient);

    this.buildWorld(this.levelCfg.level);
    this.createWeapon();
    this.spawnWave();
    this.announceLevel();
    this.emitStats();
  }

  private announceLevel() {
    const l = this.levelCfg.level;
    // First level of a sector: show the sector name instead of the level number.
    const city = t(CITIES[this.sector.city].name);
    this.cb.onNotify((l - 1) % 5 === 0 ? t("game.sector", { n: this.sector.index, name: city }) : `${t("menu.levelN", { n: l })} · ${city}`);
    // First level with a new zombie: a tip on how to beat it, after the level name.
    const tip = l === ZOMBIES.spitter.fromLevel ? "game.newSpitter" : l === ZOMBIES.shield.fromLevel ? "game.newShield" : null;
    if (tip)
      setTimeout(() => {
        if (!this.disposed && this.levelCfg.level === l) this.cb.onNotify(t(tip));
      }, 2200);
  }

  // Builds the city of a level (a new time of day each level, a new city each sector).
  private buildWorld(level: number) {
    if (this.worldInfo) {
      this.scene.remove(this.worldInfo.group);
      this.worldInfo.group.traverse((o: any) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    }
    this.sector = sectorOf(level);
    const world = buildWorld(level, this.camera, this.opts.quality);
    this.worldInfo = world;
    this.world = world.group;
    this.objects = world.colliders;
    this.spawnPoints = world.spawnPoints;
    this.scene.add(world.group);

    const L = world.lighting;
    this.scene.background = new THREE.Color(L.horizon);
    this.scene.fog = new THREE.FogExp2(L.horizon, L.fog);
    this.renderer.setClearColor(L.horizon, 1);
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemiIntensity;
    this.sun.color.set(L.sun);
    this.sun.intensity = L.sunIntensity;
    this.sun.position.set(...L.sunDir).multiplyScalar(50);
    this.ambient.color.set(L.ambient);
    this.ambient.intensity = L.ambientIntensity;
    if (this.muzzleLight) this.weaponLight();
  }

  // Spawns the current wave of the current level; the last wave brings the boss.
  private spawnWave() {
    const cfg = this.levelCfg;
    const count = cfg.zombiesPerWave(this.wave);
    for (let i = 0; i < count; i++) this.spawnZombie(pickZombieKind(cfg.level));
    if (this.wave === cfg.waves) {
      this.boss = this.spawnZombie("boss");
      this.cb.onNotify(t("game.bossIncoming"));
    }
  }

  private spawnZombie(kind: ZombieKind | "boss") {
    const cfg = this.levelCfg;
    const isBoss = kind === "boss";
    const def = ZOMBIES[isBoss ? "walker" : kind];
    const { group: g, limbs } = buildZombie(kind);
    // Zombies come in from the streets, never right next to the player.
    const far = this.spawnPoints.filter((p) => Math.hypot(p.x - this.camera.position.x, p.z - this.camera.position.z) > 24);
    const from = far.length ? far[Math.floor(Math.random() * far.length)] : this.spawnPoints[0] ?? new THREE.Vector3(0, 0, -50);
    g.position.set(from.x + (Math.random() - 0.5) * 3, 0, from.z + (Math.random() - 0.5) * 3);
    const scale = isBoss ? 2.2 : def.scale;
    g.scale.set(scale, scale, scale);

    const speed = (1.6 + Math.random() * 1.2 + cfg.zombieSpeedBonus) * cfg.speedMult;
    const hp = isBoss ? cfg.bossHealth : Math.max(1, Math.round(cfg.zombieHealth * def.hpMult));
    g.userData = {
      type: "zombie",
      kind,
      boss: isBoss,
      health: hp,
      maxHealth: hp,
      speed: isBoss ? speed * 0.7 : speed * def.speedMult,
      bite: isBoss ? cfg.biteDamage * 2 : Math.round(cfg.biteDamage * def.biteMult),
      reach: isBoss ? 2.6 : kind === "exploder" ? 1.8 : 1.5 * Math.max(1, scale),
      walkProgress: Math.random() * 100,
      bias: Math.random() < 0.5 ? 1 : -1,
      lastBite: 0,
      nextSpitAt: Date.now() + 1500 + Math.random() * 1500,
      spitWindup: 0,
      nextSightCheck: 0,
      canSee: false,
      limbs,
    };

    this.scene.add(g);
    this.enemies.push(g);
    return g;
  }

  // ---------------- Weapon models (see weapons.ts) ----------------
  private createWeapon() {
    this.weaponGroup = new THREE.Group();
    this.modelHolder = new THREE.Group();
    this.weaponGroup.add(this.modelHolder);

    const flashGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd27a, map: flashTexture(), transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.muzzleFlash = new THREE.Group();
    const f1 = new THREE.Mesh(flashGeo, flashMat);
    const f2 = new THREE.Mesh(flashGeo, flashMat.clone());
    f2.rotation.x = Math.PI / 2;
    this.muzzleFlash.add(f1);
    this.muzzleFlash.add(f2);
    this.weaponGroup.add(this.muzzleFlash);

    // One light for two jobs: a short-range key light on the weapon, and the muzzle flash when firing.
    this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
    this.weaponGroup.add(this.muzzleLight);
    this.weaponLight();

    this.weaponGroup.position.set(0.2, -0.25, -0.3);
    this.camera.add(this.weaponGroup);
    this.scene.add(this.camera);

    this.equipModel();
  }

  private equipModel() {
    this.modelHolder.clear();
    this.modelHolder.add(buildWeaponModel(this.weapon.key, this.opts.weaponSkin, this.opts.outfit));
    // Models are in metres; each weapon has its own hold (a pistol closer, a sniper further).
    const v = VIEW[this.weapon.key] ?? VIEW.m4;
    this.modelHolder.scale.setScalar(v.scale);
    this.modelHolder.position.set(v.x, v.y, v.z);
    const muzzleY = this.weapon.key === "pistol" ? 0.016 : this.weapon.key === "minigun" || this.weapon.key === "launcher" ? 0 : 0.03;
    this.muzzleFlash.position.set(v.x, v.y + muzzleY * v.scale, v.z + (MUZZLE[this.weapon.key] ?? -0.6) * v.scale);
    this.showWarhead();
  }

  // Idle: dim light just above the weapon, tinted by the sector, too short to reach the arena.
  private weaponLight() {
    this.muzzleLight.color.set(0xfff4e0);
    this.muzzleLight.intensity = 0.6;
    this.muzzleLight.distance = 1.6;
    this.muzzleLight.position.set(0.05, 0.3, 0.05);
  }

  // Weapons carried in game: the Armory loadout (unknown keys ignored, shotgun if empty).
  private setLoadout(keys?: string[]) {
    const arms = (keys ?? []).map((k) => weaponOf(k)).filter((w): w is WeaponConfig => !!w);
    this.arms = arms.length ? arms : [weaponOf("shotgun")!];
    this.weaponIndex = 0;
    this.fireModeByWeapon = this.arms.map(() => 0);
    this.ammoByWeapon = this.arms.map((_, i) => this.maxAmmoOf(i));
  }

  // RPG: the rocket is visible in the tube only when loaded.
  private showWarhead() {
    const w = this.modelHolder?.getObjectByName("warhead");
    if (w) w.visible = this.ammo > 0 && !this.reloading;
  }

  switchWeapon(index: number) {
    if (index === this.weaponIndex) return;
    const cfg = this.arms[index];
    if (!cfg) return;
    this.weaponIndex = index;
    this.reloading = false;
    this.cancelTrigger();
    this.equipModel();
    this.cb.playSound("switch");
    this.cb.onNotify(t(`weapon.${cfg.key}` as Key));
    this.emitStats();
  }

  // ---------------- Input ----------------
  pullTrigger() {
    if (this.paused || this.gameOver || this.levelComplete) return;
    this.triggerHeld = true;
    if (this.burstLeft === 0 && Date.now() >= this.nextShotAt) this.startShot(Date.now());
    else this.queuedShot = true;
  }

  releaseTrigger() {
    this.triggerHeld = false; // a burst already started still fires its 3 rounds
  }

  cycleFireMode() {
    const modes = this.weapon.modes;
    if (modes.length < 2) return;
    const i = (this.fireModeByWeapon[this.weaponIndex] + 1) % modes.length;
    this.fireModeByWeapon[this.weaponIndex] = i;
    this.cancelTrigger();
    this.cb.playSound("switch");
    this.cb.onNotify(t(FIRE_MODE_LABEL[modes[i]]));
    this.emitStats();
  }

  private cancelTrigger() {
    this.burstLeft = 0;
    this.queuedShot = false;
  }

  // First round of a tap (or of an auto stream), then the cooldown until the next one.
  private startShot(now: number) {
    this.queuedShot = false;
    const mode = this.fireMode;
    if (!this.shoot()) return;
    if (mode === "burst") {
      this.burstLeft = BURST_ROUNDS - 1;
      this.nextBurstAt = now + (this.weapon.burstGap ?? 80);
    } else {
      this.nextShotAt = now + this.weapon.fireRate;
    }
  }

  private updateTrigger(now: number) {
    if (this.burstLeft > 0) {
      if (now < this.nextBurstAt) return;
      this.burstLeft--;
      if (!this.shoot()) this.burstLeft = 0;
      this.nextBurstAt = now + (this.weapon.burstGap ?? 80);
      if (this.burstLeft === 0) this.nextShotAt = now + this.weapon.fireRate;
      return;
    }
    if (now < this.nextShotAt) return;
    if (this.queuedShot || (this.triggerHeld && this.fireMode === "auto")) this.startShot(now);
  }

  setMove(x: number, y: number, sprint: boolean) {
    this.moveVec.x = x;
    this.moveVec.y = y;
    this.sprint = sprint;
  }

  applyLook(dx: number, dy: number) {
    if (this.paused || this.gameOver || this.levelComplete) return;
    if (this.opts.invertY) dy = -dy;
    this.lastLookAt = Date.now();
    // Aim assist "friction": the view slows down while the crosshair is on a zombie.
    const slow = this.opts.aimAssist && this.assistTarget(ASSIST.frictionAngle) ? ASSIST.friction : 1;
    this.camera.rotation.y -= dx * this.lookSensitivity * slow;
    this.camera.rotation.x -= dy * this.lookSensitivity * slow;
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
    if (this.reloading || this.ammo === this.maxAmmoOf(this.weaponIndex) || this.gameOver) return;
    if (this.powerActive("infinite")) return;
    this.reloading = true;
    this.reloadStart = Date.now();
    this.cb.playSound("reload");
    this.emitStats();
  }

  // Fires one round; false when the weapon cannot fire (reloading, empty, paused).
  private shoot(): boolean {
    if (this.paused || this.gameOver || this.levelComplete || !this.weaponGroup) return false;
    if (this.reloading) return false;
    if (this.ammo <= 0) {
      this.cb.playSound("empty");
      this.reload();
      return false;
    }

    const wpn = this.weapon;
    if (!this.powerActive("infinite")) this.ammo = this.ammo - 1;
    this.cb.playSound(wpn.sound ?? wpn.key);
    this.emitStats();
    this.addShake(wpn.recoil * 0.25);
    const barrels = this.modelHolder.getObjectByName("barrels");
    if (barrels) barrels.rotation.z += 0.9;

    this.currentRecoil = wpn.recoil;
    this.currentRecoilX = (Math.random() - 0.5) * 0.05;
    this.currentKickback = 0.15;

    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    const fs = 0.35 + Math.random() * 0.2;
    this.muzzleFlash.scale.set(fs, fs, fs);
    this.muzzleFlash.children.forEach((c: any) => (c.material.opacity = 1));
    this.muzzleLight.color.set(0xffaa00);
    this.muzzleLight.distance = 8;
    this.muzzleLight.position.copy(this.muzzleFlash.position).y += 0.08;
    this.muzzleLight.intensity = 1.5 + Math.random() * 0.5;
    if (this.muzzleTimer) clearTimeout(this.muzzleTimer);
    this.muzzleTimer = setTimeout(() => {
      if (this.disposed) return;
      this.muzzleFlash.children.forEach((c: any) => (c.material.opacity = 0));
      this.weaponLight();
    }, 55);

    const base = new THREE.Raycaster();
    base.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const origin = base.ray.origin.clone();
    const baseDir = base.ray.direction.clone();
    const right = new THREE.Vector3().crossVectors(baseDir, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, baseDir).normalize();
    const candidates = [...this.objects, ...this.enemies];
    let hitZombie = false;
    let blocked = false;
    const rage = this.powerActive("rage") ? RAGE_MULT : 1;

    if (wpn.projectile) {
      this.launchGrenade(origin, baseDir, wpn.projectile);
      this.showWarhead();
      if (this.ammo <= 0) setTimeout(() => this.reload(), 200);
      return true;
    }

    if (wpn.pierce) {
      // Sniper: one heavy bullet that goes through up to `pierce` zombies, stopped by walls.
      const hits = new THREE.Raycaster(origin, baseDir).intersectObjects(candidates, true);
      const done = new Set<THREE.Object3D>();
      let end = origin.clone().addScaledVector(baseDir, 70);
      for (const hit of hits) {
        let target: any = hit.object;
        while (target.parent && target.parent !== this.scene && target.parent !== this.world) target = target.parent;
        if (target.userData?.type !== "zombie") {
          end = hit.point.clone();
          break; // wall
        }
        if (done.has(target) || target.userData.dead) continue;
        done.add(target);
        const headshot = hit.object.name === "Head";
        target.userData.health -= (headshot ? wpn.headDmg : wpn.bodyDmg) * this.mods.damageMult * rage;
        hitZombie = true;
        this.createImpact(hit.point, (hit.face as any)?.normal ?? new THREE.Vector3(0, 1, 0));
        if (target.userData.health <= 0) this.killZombie(target, headshot, false);
        if (done.size >= wpn.pierce) {
          end = hit.point.clone();
          break;
        }
      }
      this.createBeam(this.muzzleWorldPosition(), end);
      if (hitZombie) {
        this.cb.onHitMarker();
        if (this.boss) this.emitStats();
      }
      if (this.ammo <= 0) setTimeout(() => this.reload(), 200);
      return true;
    }

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
        if (hit.object.name === "Shield") {
          blocked = true; // riot shield: the bullet stops, no damage
          continue;
        }
        let target: any = hit.object;
        const headshot = hit.object.name === "Head";
        const dmg = (headshot ? wpn.headDmg : wpn.bodyDmg) * this.mods.damageMult * rage;
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
            this.killZombie(target, headshot, false);
          }
        }
      }
    }

    if (hitZombie) {
      this.cb.onHitMarker();
      if (this.boss) this.emitStats();
    } else if (blocked) this.cb.playSound("clank");
    if (this.ammo <= 0) setTimeout(() => this.reload(), 200);
    return true;
  }

  private removeZombie(target: THREE.Group) {
    this.scene.remove(target);
    disposeZombie(target);
    const idx = this.enemies.indexOf(target);
    if (idx > -1) this.enemies.splice(idx, 1);
  }

  private killZombie(target: THREE.Group, headshot: boolean, byExplosion: boolean) {
    if (target.userData.dead) return;
    target.userData.dead = true;
    const kind = target.userData.kind as ZombieKind | "boss";
    const def = ZOMBIES[kind === "boss" ? "walker" : kind];
    this.createDeath(target.position, kind === "boss" ? 0xaa0000 : def.glow ?? def.eyes);
    this.maybeDropPickup(target.position);
    this.removeZombie(target);
    const isBoss = target === this.boss;

    // Combo: kills chained within COMBO_WINDOW_MS.
    const now = Date.now();
    this.combo = now - this.lastKillAt <= COMBO_WINDOW_MS ? this.combo + 1 : 1;
    this.lastKillAt = now;
    const bonus = comboBonus(this.combo);
    const label = comboLabel(this.combo);

    this.kills++;
    this.levelKills++;
    if (headshot) this.levelHeadshots++;
    this.score += (isBoss ? 1000 : def.score + (headshot ? 50 : 0)) + bonus.score;
    const earned = (isBoss ? CREDITS_PER_BOSS : def.credits + (headshot ? CREDITS_PER_HEADSHOT : 0)) + bonus.credits;
    this.levelCredits += Math.round(earned * this.levelCfg.creditMult);
    this.cb.onEvent?.({ type: "kill", kind, headshot, combo: this.combo, byExplosion });
    if (isBoss) {
      this.boss = null;
      this.addShake(0.5);
      this.cb.onNotify(t("game.bossDown"));
    } else if (label) {
      this.cb.onNotify(`${label}  +${bonus.score}`);
    }
    if (kind === "exploder") this.explode(target.position.clone(), "shot");
    this.emitStats();
    this.checkWaveCleared();
  }

  // An exploder that reached the player blows up: no score for the player.
  private detonate(z: THREE.Group) {
    if (z.userData.dead) return;
    z.userData.dead = true;
    this.removeZombie(z);
    this.explode(z.position.clone(), "contact");
    this.checkWaveCleared();
  }

  // cause: "contact" (exploder reached the player), "shot" (exploder killed), "grenade" (player's own).
  private explode(center: THREE.Vector3, cause: "contact" | "shot" | "grenade" | "rocket") {
    const blast = cause === "rocket" ? PROJECTILE.rocket : cause === "grenade" ? PROJECTILE.grenade : null;
    const radius = blast?.radius ?? EXPLOSION.radius;
    const triggeredByContact = cause === "contact";
    this.createExplosion(center);
    this.cb.playSound("explosion");
    const dPlayer = Math.hypot(this.camera.position.x - center.x, this.camera.position.z - center.z);
    this.addShake(Math.max(0.15, 0.7 - dPlayer * 0.06));
    // The player is hurt by contact explosions, and by shot exploders that were too close.
    if (!blast && dPlayer < EXPLOSION.radius && !this.gameOver) {
      const full = EXPLOSION.playerDamage(this.levelCfg.level) * this.levelCfg.damageMult;
      this.health -= triggeredByContact ? full : Math.round(full * (1 - dPlayer / EXPLOSION.radius));
      this.cb.onDamage();
      if (this.health <= 0) {
        this.triggerGameOver();
        return;
      }
    }
    // Chain reaction on nearby zombies (a copy: kills mutate the list).
    for (const z of [...this.enemies]) {
      if (z.userData.dead) continue;
      if (z.position.distanceTo(center) < radius) {
        const base = blast ? blast.damage * this.mods.damageMult * (this.powerActive("rage") ? RAGE_MULT : 1) : EXPLOSION.zombieDamage;
        z.userData.health -= base * (z.userData.boss ? 0.5 : 1);
        if (z.userData.health <= 0) this.killZombie(z, false, true);
      }
    }
    if (this.boss) this.emitStats();
  }

  private muzzleWorldPosition() {
    const p = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(p);
    return p;
  }

  private launchGrenade(origin: THREE.Vector3, dir: THREE.Vector3, kind: "grenade" | "rocket") {
    const P = PROJECTILE[kind];
    let mesh: THREE.Mesh;
    if (kind === "rocket") {
      // Olive rocket with a bright exhaust flame, pointing where it flies.
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f5d2f }));
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb13b }));
      flame.position.z = 0.3;
      mesh.add(flame);
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3b4032, metalness: 0.4, roughness: 0.5 }));
    }
    mesh.position.copy(this.muzzleWorldPosition());
    const vel = dir.clone().multiplyScalar(P.speed);
    vel.y += P.lift;
    if (kind === "rocket") mesh.lookAt(mesh.position.clone().sub(vel));
    this.scene.add(mesh);
    this.grenades.push({ mesh, vel, born: Date.now(), kind });
  }

  private updateGrenades(delta: number, time: number) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      const P = PROJECTILE[g.kind];
      g.vel.y -= P.gravity * delta;
      g.mesh.position.addScaledVector(g.vel, delta);
      const p = g.mesh.position;
      if (g.kind === "rocket" && Math.random() < 0.6) this.createDeath(p.clone().addScaledVector(g.vel, -0.02).setY(p.y - 1), 0x9a9a9a); // smoke
      let hit = p.y <= 0.15 || time - g.born > P.fuseMs;
      if (!hit) hit = this.enemies.some((z) => !z.userData.dead && Math.hypot(z.position.x - p.x, z.position.z - p.z) < 0.9 * z.scale.x && p.y < 2.2 * z.scale.y);
      if (!hit) hit = this.objects.some((o) => (o.userData.aabb as THREE.Box3).containsPoint(p));
      if (hit) {
        this.scene.remove(g.mesh);
        g.mesh.traverse((o: any) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        this.grenades.splice(i, 1);
        this.explode(new THREE.Vector3(p.x, 0, p.z), g.kind);
        if (this.gameOver) return;
      }
    }
  }

  private createBeam(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.scene.add(line);
    this.beams.push({ line, life: 1 });
  }

  private checkWaveCleared() {
    if (this.enemies.length === 0 && !this.spawningNextWave && !this.gameOver) {
      this.spawningNextWave = true;
      setTimeout(() => {
        if (this.disposed || this.gameOver) return;
        this.spawningNextWave = false;
        this.cb.playSound("wave");
        if (this.wave >= this.levelCfg.waves) {
          this.finishLevel();
          return;
        }
        this.wave++;
        this.cb.onNotify(t("game.wave", { n: this.wave, max: this.levelCfg.waves }));
        this.spawnWave();
        this.emitStats();
      }, 1200);
    }
  }

  private finishLevel() {
    this.levelComplete = true;
    this.setMove(0, 0, false);
    this.isSpaceHeld = false;
    this.cb.onLevelComplete({
      level: this.levelCfg.level,
      score: this.score,
      kills: this.levelKills,
      headshots: this.levelHeadshots,
      health: Math.max(0, Math.round(this.health)),
      maxHealth: this.mods.maxHealth,
      credits: this.levelCredits,
      difficulty: this.difficulty,
    });
  }

  private maybeDropPickup(position: THREE.Vector3) {
    const r = Math.random();
    let type: "health" | "ammo" | PowerUpKind | null = null;
    if (r < POWERUP_DROP_CHANCE) {
      const kinds = Object.keys(POWERUPS) as PowerUpKind[];
      type = kinds[Math.floor(Math.random() * kinds.length)];
    } else if (r < POWERUP_DROP_CHANCE + 0.16) type = "health";
    else if (r < POWERUP_DROP_CHANCE + 0.41) type = "ammo";
    if (!type) return;

    const group = new THREE.Group();
    if (type in POWERUPS) {
      const color = POWERUPS[type as PowerUpKind].color;
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 });
      group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.35), mat));
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.04, 8, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
      );
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
    } else if (type === "health") {
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
    this.clearSpits();
    this.health = this.mods.maxHealth;
    this.gameOver = false;
    this.paused = false;
    this.ammo = this.maxAmmoOf(this.weaponIndex);
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

  // Restarts the current level from scratch (score and run stats reset).
  restart() {
    this.startLevel(this.levelCfg.level, { keepRun: false });
  }

  // Loads a level. keepRun carries score/kills over (used by "next level").
  startLevel(level: number, opts: { keepRun: boolean; unlockedLevel?: number; modifiers?: PlayerModifiers }) {
    this.triggerHeld = false;
    this.cancelTrigger();
    this.enemies.forEach((e) => {
      this.scene.remove(e);
      disposeZombie(e);
    });
    this.enemies = [];
    this.boss = null;
    this.particles.forEach((p) => this.scene.remove(p.mesh));
    this.particles = [];
    this.pickups.forEach((p) => this.scene.remove(p));
    this.pickups = [];
    if (opts.modifiers) this.mods = opts.modifiers;
    this.levelCfg = getLevelConfig(level, this.difficulty);
    this.buildWorld(this.levelCfg.level);
    this.clearSpits();
    this.combo = 0;
    this.powerUntil = {};
    this.shake = 0;
    this.grenades.forEach((g) => this.scene.remove(g.mesh));
    this.grenades = [];
    this.unlockedLevel = Math.max(opts.unlockedLevel ?? this.unlockedLevel, this.levelCfg.level);
    this.health = this.mods.maxHealth;
    this.ammoByWeapon = this.arms.map((_, i) => this.maxAmmoOf(i));
    this.reloading = false;
    if (!opts.keepRun) {
      this.score = 0;
      this.kills = 0;
    }
    this.wave = 1;
    this.levelKills = 0;
    this.levelHeadshots = 0;
    this.levelCredits = 0;
    this.gameOver = false;
    this.levelComplete = false;
    this.paused = false;
    this.spawningNextWave = false;
    this.playerVelocity.set(0, 0, 0);
    this.camera.position.set(0, CONFIG.standHeight, 12);
    this.camera.rotation.set(0, 0, 0);
    this.equipModel();
    this.spawnWave();
    this.announceLevel();
    this.prevTime = Date.now();
    this.emitStats();
  }

  // ---------------- Power-ups ----------------
  private powerActive(kind: PowerUpKind) {
    return (this.powerUntil[kind] ?? 0) > Date.now();
  }

  private activatePower(kind: PowerUpKind) {
    this.powerUntil[kind] = Date.now() + POWERUPS[kind].seconds * 1000;
    if (kind === "infinite") {
      this.reloading = false;
      this.ammo = this.maxAmmoOf(this.weaponIndex);
    }
    this.cb.playSound("powerup");
    this.cb.onNotify(t(`power.${kind}` as Key));
    this.cb.onEvent?.({ type: "powerup", kind });
    this.emitStats();
  }

  private addShake(amount: number) {
    this.shake = Math.min(0.8, this.shake + amount);
  }

  pause() {
    this.paused = true;
    this.triggerHeld = false;
    this.cancelTrigger();
  }
  resume() {
    this.paused = false;
    this.prevTime = Date.now();
  }

  private emitStats() {
    this.cb.onStats({
      health: Math.max(0, Math.round(this.health)),
      maxHealth: this.mods.maxHealth,
      ammo: this.ammo,
      maxAmmo: this.maxAmmoOf(this.weaponIndex),
      reloading: this.reloading,
      score: this.score,
      level: this.levelCfg.level,
      wave: this.wave,
      totalWaves: this.levelCfg.waves,
      kills: this.kills,
      credits: this.levelCredits,
      boss: this.boss
        ? { health: Math.max(0, Math.ceil(this.boss.userData.health)), max: this.boss.userData.maxHealth }
        : null,
      weaponIndex: this.weaponIndex,
      fireMode: this.fireMode,
      fireModes: this.weapon.modes,
      weapons: this.arms.map((w) => ({ key: w.key, short: w.short })),
      sector: { index: this.sector.index, name: t(CITIES[this.sector.city].name) },
      powerups: (Object.keys(this.powerUntil) as PowerUpKind[])
        .map((kind) => ({ kind, remaining: Math.ceil(((this.powerUntil[kind] ?? 0) - Date.now()) / 1000) }))
        .filter((p) => p.remaining > 0),
      difficulty: this.difficulty,
    });
  }

  private createExplosion(center: THREE.Vector3) {
    const count = 36;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const c = new THREE.Color();
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions.push(center.x, 1, center.z);
      c.setHex([0xffd000, 0xff7a1a, 0xb6ff00][i % 3]);
      colors.push(c.r, c.g, c.b);
      const a = Math.random() * Math.PI * 2;
      const sp = 6 + Math.random() * 10;
      velocities.push({ x: Math.cos(a) * sp, y: 4 + Math.random() * 10, z: Math.sin(a) * sp });
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.35, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ps = new THREE.Points(geometry, material);
    this.scene.add(ps);
    this.particles.push({ mesh: ps, velocities, life: 1.0 });

    // Flash of light + expanding shockwave ring, faded out in update().
    const light = new THREE.PointLight(0xffaa33, 6, 16);
    light.position.set(center.x, 1.5, center.z);
    this.scene.add(light);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.6, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd000, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, 0.12, center.z);
    this.scene.add(ring);
    this.flashes.push({ light, ring, life: 1 });
  }

  private createDeath(position: THREE.Vector3, color = 0xaa0000) {
    const count = 15;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < count; i++)
      positions.push(position.x + (Math.random() - 0.5), position.y + 1 + (Math.random() - 0.5), position.z + (Math.random() - 0.5));
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ size: 0.18, color, transparent: true, depthWrite: false });
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
    this.cb.onEvent?.({ type: "death" });
    this.emitStats();
    this.cb.onGameOver({ score: this.score, level: this.levelCfg.level, kills: this.kills, credits: this.levelCredits });
  }

  // ---------------- Aim assist ----------------
  // True when nothing blocks the straight line from a to b (buildings, cars, the centrepiece).
  private clearLine(a: THREE.Vector3, b: THREE.Vector3) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const ray = new THREE.Ray(a, dir.normalize());
    const hit = new THREE.Vector3();
    for (const o of this.objects) {
      if (ray.intersectBox(o.userData.aabb as THREE.Box3, hit) && hit.distanceTo(a) < len) return false;
    }
    return true;
  }

  private aimPoint(z: THREE.Object3D) {
    return new THREE.Vector3(z.position.x, z.position.y + 1.2 * z.scale.y, z.position.z);
  }

  // The visible zombie closest to the crosshair, within `maxAngle` radians.
  private assistTarget(maxAngle: number): THREE.Object3D | null {
    const eye = this.camera.position;
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    let best: THREE.Object3D | null = null;
    let bestAngle = maxAngle;
    for (const z of this.enemies) {
      if (z.userData.dead) continue;
      const to = this.aimPoint(z).sub(eye);
      if (to.length() > ASSIST.range) continue;
      const angle = fwd.angleTo(to);
      if (angle < bestAngle) {
        bestAngle = angle;
        best = z;
      }
    }
    return best && this.clearLine(eye, this.aimPoint(best)) ? best : null;
  }

  private updateAimAssist(delta: number, time: number) {
    if (!this.opts.aimAssist) return;
    const aiming = time - this.lastLookAt < 300 || this.triggerHeld || this.moveVec.x !== 0 || this.moveVec.y !== 0;
    if (!aiming) return;
    const target = this.assistTarget(ASSIST.pullAngle);
    if (!target) return;
    const dir = this.aimPoint(target).sub(this.camera.position);
    const yaw = Math.atan2(-dir.x, -dir.z);
    const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    let dYaw = yaw - this.camera.rotation.y;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw)); // shortest way round
    const k = 1 - Math.exp(-ASSIST.strength * delta);
    this.camera.rotation.y += dYaw * k;
    this.camera.rotation.x += (pitch - this.camera.rotation.x) * k * 0.6;
  }

  // ---------------- Spitter ----------------
  // Returns true when the spitter stands still this frame (in range and aiming, or winding up).
  private spitterHolds(z: THREE.Group, distance: number, time: number) {
    const ud = z.userData as any;
    if (distance > SPIT.range) {
      ud.spitWindup = 0;
      return false;
    }
    if (time >= ud.nextSightCheck) {
      ud.nextSightCheck = time + 400;
      const mouth = new THREE.Vector3(z.position.x, 1.5 * z.scale.y, z.position.z);
      ud.canSee = this.clearLine(mouth, this.camera.position);
    }
    const sac = z.getObjectByName("Glow");
    if (!ud.canSee) {
      ud.spitWindup = 0;
      sac?.scale.setScalar(1);
      return false;
    }
    if (!ud.spitWindup && time >= ud.nextSpitAt) ud.spitWindup = time;
    if (ud.spitWindup) {
      // Wind-up: the sac swells for a moment (the cue to sidestep), then the acid flies.
      const t = Math.min(1, (time - ud.spitWindup) / 450);
      sac?.scale.setScalar(1 + t * 0.6);
      if (t >= 1) {
        this.spit(z);
        ud.spitWindup = 0;
        ud.nextSpitAt = time + SPIT.cooldownMs * (0.8 + Math.random() * 0.4);
        sac?.scale.setScalar(1);
      }
      return true;
    }
    if (distance > SPIT.keepAway) return false;
    const { leftLeg, rightLeg } = ud.limbs;
    leftLeg.rotation.x = rightLeg.rotation.x = 0;
    return true;
  }

  private spit(z: THREE.Group) {
    const origin = new THREE.Vector3(z.position.x, 1.5 * z.scale.y, z.position.z);
    const target = new THREE.Vector3(this.camera.position.x, this.camera.position.y - 0.5, this.camera.position.z);
    const vel = target.sub(origin).normalize().multiplyScalar(SPIT.speed);
    origin.addScaledVector(vel, 0.5 / SPIT.speed);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9dff2e }));
    mesh.position.copy(origin);
    this.scene.add(mesh);
    const damage = Math.max(1, Math.round(SPIT.damage(this.levelCfg.level) * this.levelCfg.damageMult));
    this.spits.push({ mesh, vel, born: Date.now(), damage });
    this.cb.playSound("spit");
  }

  private removeSpit(i: number) {
    const s = this.spits[i];
    this.scene.remove(s.mesh);
    s.mesh.geometry.dispose();
    (s.mesh.material as THREE.Material).dispose();
    this.spits.splice(i, 1);
  }

  private clearSpits() {
    for (let i = this.spits.length - 1; i >= 0; i--) this.removeSpit(i);
  }

  private updateSpits(delta: number, time: number) {
    const body = new THREE.Vector3(this.camera.position.x, this.camera.position.y - 0.5, this.camera.position.z);
    for (let i = this.spits.length - 1; i >= 0; i--) {
      const s = this.spits[i];
      s.mesh.position.addScaledVector(s.vel, delta);
      const p = s.mesh.position;
      if (p.distanceTo(body) < SPIT.radius) {
        this.removeSpit(i); // no splash particles in the player's face: the red vignette shows the hit
        this.health -= s.damage;
        this.addShake(0.2);
        this.cb.onDamage();
        this.emitStats();
        if (this.health <= 0) {
          this.triggerGameOver();
          return;
        }
        continue;
      }
      if (p.y < 0.1 || time - s.born > 2500 || this.objects.some((o) => (o.userData.aabb as THREE.Box3).containsPoint(p))) {
        this.createDeath(p, 0x9dff2e);
        this.removeSpit(i);
      }
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    // "Economy" graphics: 30 frames per second saves battery on older phones.
    const now = Date.now();
    if (this.opts.quality === "low" && now - this.lastFrameAt < 30) return;
    this.lastFrameAt = now;
    this.update();
    // Screen shake: offset the camera only for rendering, never for physics.
    this.camera.position.add(this.shakeOffset);
    this.renderer.render(this.scene, this.camera);
    this.camera.position.sub(this.shakeOffset);
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

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= delta * 2.5;
      f.light.intensity = Math.max(0, f.life) * 6;
      // Ring grows up to the blast radius (outer radius 0.6 * scale).
      const sc = 1 + (1 - f.life) * (EXPLOSION.radius / 0.6 - 1);
      f.ring.scale.set(sc, sc, sc);
      (f.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f.life) * 0.55;
      if (f.life <= 0) {
        this.scene.remove(f.light);
        this.scene.remove(f.ring);
        f.ring.geometry.dispose();
        (f.ring.material as THREE.Material).dispose();
        this.flashes.splice(i, 1);
      }
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= delta * 4;
      (b.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, b.life);
      if (b.life <= 0) {
        this.scene.remove(b.line);
        b.line.geometry.dispose();
        (b.line.material as THREE.Material).dispose();
        this.beams.splice(i, 1);
      }
    }

    this.worldInfo?.update(delta, time);
    this.shake = Math.max(0, this.shake - delta * 1.8);
    const amp = this.shake * this.shake * 0.35;
    this.shakeOffset.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);

    if (this.paused || this.gameOver || this.levelComplete) {
      this.shakeOffset.set(0, 0, 0);
      return;
    }

    this.updateTrigger(time);
    this.updateGrenades(delta, time);
    if (this.gameOver) return;
    this.updateSpits(delta, time);
    if (this.gameOver) return;
    this.updateAimAssist(delta, time);

    // Refresh power-up timers in the HUD a few times per second while one is active.
    if (Object.keys(this.powerUntil).length && time - this.lastPowerEmit > 250) {
      this.lastPowerEmit = time;
      for (const k of Object.keys(this.powerUntil) as PowerUpKind[]) {
        if ((this.powerUntil[k] ?? 0) <= time) delete this.powerUntil[k];
      }
      this.emitStats();
    }

    // pickups: spin, bob, collect
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.rotation.y += delta * 2;
      pk.position.y = 0.8 + Math.sin(time * 0.004 + pk.userData.spin) * 0.15;
      const dx = pk.position.x - this.camera.position.x;
      const dz = pk.position.z - this.camera.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < 1.8) {
        if (pk.userData.type in POWERUPS) {
          this.activatePower(pk.userData.type as PowerUpKind);
        } else if (pk.userData.type === "health") {
          this.health = Math.min(this.mods.maxHealth, this.health + 25);
          this.cb.onNotify(t("game.health", { n: 25 }));
        } else {
          this.ammo = this.maxAmmoOf(this.weaponIndex);
          this.reloading = false;
          this.cb.onNotify(t("game.ammo"));
        }
        if (!(pk.userData.type in POWERUPS)) this.cb.playSound("pickup");
        this.scene.remove(pk);
        this.pickups.splice(i, 1);
        this.emitStats();
      }
    }

    if (this.reloading && time - this.reloadStart >= this.reloadMs) {
      this.reloading = false;
      this.ammo = this.maxAmmoOf(this.weaponIndex);
      this.showWarhead();
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
    const speed = CONFIG.speed * speedMult * (this.powerActive("haste") ? HASTE_MULT : 1);
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
    for (const z of [...this.enemies]) {
      if (z.userData.dead) continue;
      const target = new THREE.Vector3(this.camera.position.x, z.position.y, this.camera.position.z);
      z.lookAt(target);
      // Horizontal distance: the camera sits at eye height, so a 3D distance never drops below ~2m.
      const distance = Math.hypot(this.camera.position.x - z.position.x, this.camera.position.z - z.position.z);
      const ud = z.userData as any;

      if (ud.kind === "spitter" && distance > ud.reach && this.spitterHolds(z, distance, time)) {
        z.position.y = 0;
        continue;
      }

      if (distance > ud.reach) {
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
      } else if (ud.kind === "exploder") {
        this.detonate(z);
        if (this.gameOver) return;
      } else {
        z.position.y = 0;
        if (time - ud.lastBite > 800) {
          ud.lastBite = time;
          this.health -= ud.bite;
          damagedThisFrame = true;
        }
      }
    }

    if (damagedThisFrame) {
      this.addShake(0.25);
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
      const progress = (time - this.reloadStart) / this.reloadMs;
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
