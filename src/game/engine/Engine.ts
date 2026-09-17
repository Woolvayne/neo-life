"use client";

import * as THREE from "three";
import { MAP_BY_ID, MapConfig } from "@/game/world/maps";
import {
  generateWorld,
  WorldData,
  Collider,
  buildInterior,
  Interior,
} from "@/game/world/generator";
import {
  createCharacter,
  animateCharacter,
  CharacterRig,
  createVehicle,
  VehicleRig,
  setEmissive,
  createMarker,
  labelSprite,
} from "./meshes";
import { VEHICLE_MAP, VehicleModel, plateGen } from "@/game/data/vehicles";
import {
  hudStore,
  playerStore,
  uiStore,
  notify,
  updatePlayer,
  grantAchievement,
  addMoney,
} from "@/game/core/store";
import type { CharacterAppearance, WorldMarker } from "@/game/core/types";
import { audio } from "./audio";
import { TrafficSystem } from "./systems/traffic";
import { PoliceSystem } from "./systems/police";
import { GameplaySystem } from "./systems/gameplay";

export type VehicleEntity = {
  uid: string;
  modelId: string;
  model: VehicleModel;
  rig: VehicleRig;
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  steer: number;
  engineOn: boolean;
  lights: boolean;
  siren: boolean;
  locked: boolean;
  owned: boolean;
  plate: string;
  fuel: number;
  condition: number;
  color: string;
  stolen: boolean;
  ai: boolean;
};

const KEYMAP: Record<string, string> = {
  KeyW: "fwd",
  ArrowUp: "fwd",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "sprint",
  Space: "jump",
};

export class Engine {
  static instance: Engine | null = null;

  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  clock = new THREE.Clock();

  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;

  map!: MapConfig;
  world!: WorldData;
  interiors = new Map<string, Interior>();
  activeInterior: Interior | null = null;
  interiorReturn = new THREE.Vector3();

  rig!: CharacterRig;
  pos = new THREE.Vector3(0, 0, 0);
  vel = new THREE.Vector3();
  yaw = 0;
  grounded = true;
  health = 100;
  armor = 0;
  stamina = 100;
  onFootSpeed = 0;

  camYaw = 0;
  camPitch = 0.28;
  camDist = 7;
  pointerLocked = false;

  keys: Record<string, boolean> = {};
  vehicles: VehicleEntity[] = [];
  currentVehicle: VehicleEntity | null = null;

  timeOfDay = 9.5;
  daySpeed = 60; // 1 real second = 60 game seconds
  weather: "Clear" | "Cloudy" | "Rain" | "Heavy Rain" | "Fog" = "Clear";
  weatherTimer = 90;
  rainPoints: THREE.Points | null = null;

  traffic!: TrafficSystem;
  police!: PoliceSystem;
  gameplay!: GameplaySystem;

  nearbyMarker: WorldMarker | null = null;
  nearbyVehicle: VehicleEntity | null = null;
  holdAction: { key: string; t: number; need: number; label: string } | null = null;

  waypoint: { x: number; z: number } | null = null;
  waypointMesh: THREE.Mesh | null = null;

  /** dynamic resolution: scales render size down when FPS drops */
  private resScale = 1;
  private resTimer = 0;
  private qualityCap = 1.5;
  private shadowTick = 0;
  /** reusable scratch vectors — avoids per-frame GC pressure in hot loops */
  private _vA = new THREE.Vector3();
  private _vB = new THREE.Vector3();

  running = false;
  private raf = 0;
  private accumHud = 0;
  private frames = 0;
  private fpsTimer = 0;
  fps = 60;
  qualityScale = 1;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    Engine.instance = this;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // shadow map renders on demand (every 2nd frame) instead of every frame
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.applyQualityCeiling();
    this.refreshQuality();

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2600);
    this.scene.background = new THREE.Color("#8fb2d6");
    this.scene.fog = new THREE.Fog("#8fb2d6", 120, 700);

    this.sun = new THREE.DirectionalLight(0xfff3e0, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const cam = this.sun.shadow.camera;
    cam.left = -90;
    cam.right = 90;
    cam.top = 90;
    cam.bottom = -90;
    cam.near = 1;
    cam.far = 420;
    this.scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x4a4a42, 0.75);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.ambient);
  }

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  async loadMap(mapId: string, spawn?: { x: number; z: number }) {
    const conf = MAP_BY_ID[mapId] ?? MAP_BY_ID.novacity;
    if (this.world) {
      this.scene.remove(this.world.root);
      this.disposeGroup(this.world.root);
      this.vehicles.forEach((v) => this.scene.remove(v.rig.root));
      this.vehicles = [];
      this.currentVehicle = null;
      this.traffic?.dispose();
      this.police?.dispose();
    }
    this.map = conf;
    this.world = generateWorld(conf);
    this.scene.add(this.world.root);
    this.scene.background = new THREE.Color(conf.sky);
    this.scene.fog = new THREE.Fog(conf.sky, 90, conf.fog);

    const p = playerStore.get();
    const appearance: CharacterAppearance | undefined = p?.character;
    if (!this.rig && appearance) {
      this.rig = createCharacter(appearance);
      this.scene.add(this.rig.root);
    }
    this.pos.set(spawn?.x ?? conf.spawn.x, 0, spawn?.z ?? conf.spawn.z);

    uiStore.set({ markers: this.world.markers });

    this.traffic = new TrafficSystem(this);
    this.police = new PoliceSystem(this);
    if (!this.gameplay) this.gameplay = new GameplaySystem(this);
    this.gameplay.onMapChanged();

    this.spawnAmbientParkedCars();
    this.spawnDepartmentVehicles();
    this.rebuildPlayerVehicles();
  }

  rebuildCharacter(appearance: CharacterAppearance) {
    if (this.rig) {
      this.scene.remove(this.rig.root);
      this.disposeGroup(this.rig.root);
    }
    this.rig = createCharacter(appearance);
    this.scene.add(this.rig.root);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.bindInput();
    this.resize();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
    this.traffic?.dispose();
    this.police?.dispose();
    this.gameplay?.dispose();
    audio.engineStop();
    audio.sirenOff();
    this.renderer.dispose();
    if (Engine.instance === this) Engine.instance = null;
  }

  private disposeGroup(obj: THREE.Object3D) {
    obj.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private applyQualityCeiling() {
    const p = playerStore.get();
    const q = p?.settings.quality ?? "medium";
    const cap = q === "low" ? 1 : q === "medium" ? 1.5 : 2;
    this.qualityCap = Math.min(window.devicePixelRatio || 1, cap);
  }

  /** (Re)apply quality-driven renderer settings. Called by the settings UI too. */
  refreshQuality() {
    const p = playerStore.get();
    this.applyQualityCeiling();
    this.renderer.shadowMap.enabled =
      (p?.settings.quality ?? "medium") !== "low" && (p?.settings.shadows ?? true);
    this.applyPixelRatio();
    this.renderer.shadowMap.needsUpdate = true;
  }

  private applyPixelRatio() {
    const pr = Math.max(0.55, this.qualityCap * this.resScale);
    this.renderer.setPixelRatio(pr);
    this.resize();
  }

  /** Automatic resolution scaling: keeps the frame rate comfortably above 45fps. */
  private updateDynamicResolution(dt: number) {
    this.resTimer += dt;
    if (this.resTimer < 1.2) return;
    this.resTimer = 0;
    if (this.fps < 42 && this.resScale > 0.55) {
      this.resScale = Math.max(0.5, this.resScale - 0.15);
      this.applyPixelRatio();
    } else if (this.fps > 57 && this.resScale < 1) {
      this.resScale = Math.min(1, this.resScale + 0.12);
      this.applyPixelRatio();
    }
  }

  /* ------------------------------------------------------------------ */
  /* input                                                              */
  /* ------------------------------------------------------------------ */

  private onKeyDown = (e: KeyboardEvent) => {
    if (uiStore.get().phase !== "playing") return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const mapped = KEYMAP[e.code];
    if (mapped) {
      this.keys[mapped] = true;
      e.preventDefault();
    }
    const panel = uiStore.get().panel;
    switch (e.code) {
      case "KeyE":
        if (!panel) this.keys.interact = true;
        break;
      case "KeyF":
        if (!panel) this.toggleVehicle();
        break;
      case "KeyM":
        uiStore.set({ panel: panel === "map" ? null : "map" });
        audio.ui();
        break;
      case "KeyP":
        uiStore.set({ panel: panel === "phone" ? null : "phone" });
        audio.ui();
        break;
      case "KeyJ":
        uiStore.set({ panel: panel === "jobs" ? null : "jobs" });
        audio.ui();
        break;
      case "KeyK":
        uiStore.set({ panel: panel === "mdt" ? null : "mdt" });
        audio.ui();
        break;
      case "KeyL":
        if (this.currentVehicle) this.setVehicleLights(!this.currentVehicle.lights);
        break;
      case "KeyQ":
        if (this.currentVehicle?.model.emergency) this.toggleSiren();
        break;
      case "KeyH":
        if (this.currentVehicle) audio.horn();
        break;
      case "KeyY":
        this.police?.surrender();
        break;
      case "KeyR":
        this.gameplay?.reload();
        break;
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
        this.gameplay?.selectSlot(Number(e.code.slice(5)) - 1);
        break;
      case "Escape":
        uiStore.set({ panel: panel ? null : "pause" });
        break;
      default:
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const mapped = KEYMAP[e.code];
    if (mapped) this.keys[mapped] = false;
    if (e.code === "KeyE") this.keys.interact = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    const p = playerStore.get();
    const sens = 0.0016 * (0.4 + (p?.settings.sensitivity ?? 0.5) * 1.6);
    this.camYaw -= e.movementX * sens;
    const dy = e.movementY * sens * (p?.settings.invertY ? -1 : 1);
    this.camPitch = Math.max(-0.45, Math.min(1.2, this.camPitch + dy));
  };

  private onMouseDown = (e: MouseEvent) => {
    if (uiStore.get().phase !== "playing") return;
    if (!this.pointerLocked) {
      this.requestLock();
      return;
    }
    if (e.button === 0) this.gameplay?.fire();
  };

  private onWheel = (e: WheelEvent) => {
    if (uiStore.get().phase !== "playing" || uiStore.get().panel) return;
    this.camDist = Math.max(3, Math.min(16, this.camDist + e.deltaY * 0.01));
  };

  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  requestLock() {
    if (uiStore.get().panel) return;
    void this.canvas.requestPointerLock?.();
    audio.init();
    audio.resume();
  }

  exitLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    document.addEventListener("pointerlockchange", this.onLockChange);
    window.addEventListener("resize", this.resizeHandler);
  }

  private unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    window.removeEventListener("resize", this.resizeHandler);
  }

  private resizeHandler = () => this.resize();

  /* ------------------------------------------------------------------ */
  /* collision helpers                                                   */
  /* ------------------------------------------------------------------ */

  collidersNear(x: number, z: number): Collider[] {
    if (this.activeInterior) return this.activeInterior.colliders;
    const out: Collider[] = [];
    const gx = Math.floor(x / 40);
    const gz = Math.floor(z / 40);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const arr = this.world.colliderGrid.get(`${gx + i}:${gz + j}`);
        if (arr) out.push(...arr);
      }
    return out;
  }

  private collideAabb(c: Collider, p: THREE.Vector3, radius: number): boolean {
    if (c.h < 1.2) return false;
    const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) return false;
    if (d2 < 1e-6) {
      p.x = c.maxX + radius;
      return true;
    }
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * radius;
    p.z = cz + (dz / d) * radius;
    return true;
  }

  /** Allocation-free circle-vs-world resolution (hot path, up to 100+ calls/frame). */
  resolveCircle(p: THREE.Vector3, radius: number): boolean {
    let hit = false;
    if (this.activeInterior) {
      for (const c of this.activeInterior.colliders) {
        if (this.collideAabb(c, p, radius)) hit = true;
      }
      return hit;
    }
    const gx = Math.floor(p.x / 40);
    const gz = Math.floor(p.z / 40);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const arr = this.world.colliderGrid.get(`${gx + i}:${gz + j}`);
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) {
          if (this.collideAabb(arr[k], p, radius)) hit = true;
        }
      }
    }
    return hit;
  }

  /* ------------------------------------------------------------------ */
  /* vehicles                                                            */
  /* ------------------------------------------------------------------ */

  spawnVehicle(
    modelId: string,
    x: number,
    z: number,
    opts: {
      uid?: string;
      color?: string;
      owned?: boolean;
      locked?: boolean;
      yaw?: number;
      wheels?: number;
      ai?: boolean;
      plate?: string;
      fuel?: number;
      condition?: number;
    } = {},
  ): VehicleEntity {
    const model = VEHICLE_MAP[modelId] ?? VEHICLE_MAP.kompakt;
    const color = opts.color ?? model.color;
    const rig = createVehicle(model, color, { wheels: opts.wheels, lightsEnabled: true });
    rig.root.position.set(x, 0, z);
    rig.root.rotation.y = opts.yaw ?? 0;
    this.scene.add(rig.root);
    const ent: VehicleEntity = {
      uid: opts.uid ?? `v_${Math.random().toString(36).slice(2, 9)}`,
      modelId,
      model,
      rig,
      pos: new THREE.Vector3(x, 0, z),
      yaw: opts.yaw ?? 0,
      speed: 0,
      steer: 0,
      engineOn: false,
      lights: false,
      siren: false,
      locked: opts.locked ?? false,
      owned: opts.owned ?? false,
      plate: opts.plate ?? plateGen(),
      fuel: opts.fuel ?? 100,
      condition: opts.condition ?? 100,
      color,
      stolen: false,
      ai: opts.ai ?? false,
    };
    this.vehicles.push(ent);
    return ent;
  }

  despawnVehicle(ent: VehicleEntity) {
    this.scene.remove(ent.rig.root);
    this.disposeGroup(ent.rig.root);
    this.vehicles = this.vehicles.filter((v) => v !== ent);
  }

  private spawnAmbientParkedCars() {
    const lines = this.world.roadLines;
    const pool = ["kompakt", "sedan", "suv", "van", "gtsport", "moto"];
    for (let i = 0; i < 26; i++) {
      const lx = lines[Math.floor(Math.random() * lines.length)];
      const s = (Math.random() * 2 - 1) * this.map.half * 0.8;
      const model = pool[Math.floor(Math.random() * pool.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      this.spawnVehicle(model, lx + side * 10.5, s, {
        locked: true,
        yaw: Math.random() > 0.5 ? 0 : Math.PI,
        color: ["#94a3b8", "#1f2937", "#b91c1c", "#0ea5e9", "#f8fafc", "#155e75"][
          Math.floor(Math.random() * 6)
        ],
      });
    }
  }

  private spawnDepartmentVehicles() {
    for (const m of this.world.markers) {
      if (m.kind === "police") {
        this.spawnVehicle("patrol", m.x - 14, m.z + 20, { locked: false, yaw: 0 });
        this.spawnVehicle("interceptor", m.x + 14, m.z + 20, { locked: false, yaw: 0 });
      } else if (m.kind === "fire") {
        this.spawnVehicle("engine", m.x - 10, m.z + 22, { locked: false, yaw: 0 });
      } else if (m.kind === "hospital") {
        this.spawnVehicle("ambulance", m.x + 12, m.z + 22, { locked: false, yaw: 0 });
      }
    }
  }

  rebuildPlayerVehicles() {
    const p = playerStore.get();
    if (!p) return;
    for (const owned of p.vehicles.filter((v) => !v.stored)) {
      if (this.vehicles.some((v) => v.uid === owned.uid)) continue;
      const garage = this.world.markers.find((m) => m.kind === "garage");
      const x = (garage?.x ?? 0) + (Math.random() * 12 - 6);
      const z = (garage?.z ?? 0) + 16 + Math.random() * 6;
      this.spawnVehicle(owned.modelId, x, z, {
        uid: owned.uid,
        color: owned.color,
        owned: true,
        wheels: owned.wheels,
        plate: owned.plate,
        fuel: owned.fuel,
        condition: owned.condition,
      });
    }
  }

  spawnOwnedVehicle(uid: string) {
    const p = playerStore.get();
    if (!p) return;
    const owned = p.vehicles.find((v) => v.uid === uid);
    if (!owned) return;
    const existing = this.vehicles.find((v) => v.uid === uid);
    if (existing) {
      existing.pos.set(this.pos.x + 5, 0, this.pos.z + 3);
      existing.rig.root.position.copy(existing.pos);
      notify("Vehicle relocated", `${VEHICLE_MAP[owned.modelId]?.name} brought to your location`, "info");
      return;
    }
    this.spawnVehicle(owned.modelId, this.pos.x + 5, this.pos.z + 3, {
      uid,
      color: owned.color,
      owned: true,
      wheels: owned.wheels,
      plate: owned.plate,
      fuel: owned.fuel,
      condition: owned.condition,
      yaw: this.yaw,
    });
    updatePlayer((s) => ({
      vehicles: s.vehicles.map((v) => (v.uid === uid ? { ...v, stored: false } : v)),
    }));
    notify("Vehicle delivered", `${VEHICLE_MAP[owned.modelId]?.name} is outside`, "success");
    audio.success();
  }

  storeVehicle(uid: string) {
    const ent = this.vehicles.find((v) => v.uid === uid);
    if (ent) {
      if (this.currentVehicle === ent) this.exitVehicle();
      this.despawnVehicle(ent);
    }
    updatePlayer((s) => ({
      vehicles: s.vehicles.map((v) => (v.uid === uid ? { ...v, stored: true } : v)),
    }));
    notify("Vehicle stored", "Moved into your garage", "info");
  }

  toggleVehicle() {
    if (this.currentVehicle) {
      this.exitVehicle();
      return;
    }
    const near = this.findNearestVehicle(4.5);
    if (!near) {
      notify("No vehicle nearby", "Stand closer to a vehicle door", "warn", 2500);
      return;
    }
    if (near.locked && !near.owned) {
      this.gameplay.beginHotwire(near);
      return;
    }
    this.enterVehicle(near);
  }

  findNearestVehicle(range: number): VehicleEntity | null {
    let best: VehicleEntity | null = null;
    let bd = range;
    for (const v of this.vehicles) {
      if (v.ai) continue;
      const d = Math.hypot(v.pos.x - this.pos.x, v.pos.z - this.pos.z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  enterVehicle(v: VehicleEntity) {
    this.currentVehicle = v;
    v.engineOn = true;
    this.rig.root.visible = false;
    audio.init();
    audio.engineStart();
    const p = playerStore.get();
    const isDept = !!v.model.job;
    if (isDept && p && p.job !== v.model.job) {
      notify("Department vehicle", `Only ${v.model.job} personnel may drive the ${v.model.name}.`, "warn");
    }
    if (v.model.emergency === "police" && p && p.job !== "police") {
      this.police.addCharge("policeveh");
    }
    notify(v.model.name, `${v.plate} · ${Math.round(v.fuel)}% fuel`, "info", 2600);
  }

  exitVehicle() {
    const v = this.currentVehicle;
    if (!v) return;
    this.currentVehicle = null;
    v.speed = 0;
    audio.engineStop();
    if (v.siren) {
      v.siren = false;
      audio.sirenOff();
    }
    this.pos.set(v.pos.x + Math.cos(v.yaw) * 2.2, 0, v.pos.z - Math.sin(v.yaw) * 2.2);
    this.rig.root.visible = true;
    this.syncOwnedVehicleState(v);
  }

  syncOwnedVehicleState(v: VehicleEntity) {
    if (!v.owned) return;
    updatePlayer((s) => ({
      vehicles: s.vehicles.map((o) =>
        o.uid === v.uid ? { ...o, fuel: Math.round(v.fuel), condition: Math.round(v.condition) } : o,
      ),
    }));
  }

  setVehicleLights(on: boolean) {
    const v = this.currentVehicle;
    if (!v) return;
    v.lights = on;
    setEmissive(v.rig.headlights, 0xfff3cf, on ? 1.6 : 0);
    setEmissive(v.rig.taillights, 0xff2222, on ? 1.2 : 0);
    if (v.rig.spot) v.rig.spot.intensity = on ? 130 : 0;
    audio.ui();
  }

  toggleSiren() {
    const v = this.currentVehicle;
    if (!v?.model.emergency) return;
    v.siren = !v.siren;
    if (v.siren) audio.sirenOn();
    else audio.sirenOff();
  }

  /* ------------------------------------------------------------------ */
  /* interiors                                                           */
  /* ------------------------------------------------------------------ */

  enterInterior(id: string, name: string) {
    if (this.activeInterior) return;
    let interior = this.interiors.get(id);
    if (!interior) {
      interior = buildInterior(id, 6000 + this.interiors.size * 300);
      this.interiors.set(id, interior);
      this.scene.add(interior.group);
    }
    interior.group.visible = true;
    this.activeInterior = interior;
    this.interiorReturn.copy(this.pos);
    if (this.currentVehicle) this.exitVehicle();
    this.pos.set(interior.origin.x, 0, 16);
    this.world.root.visible = false;
    this.scene.fog = null;
    uiStore.set({ interiorName: name });
    notify(name, "Press E at the red marker to leave", "info", 4000);
  }

  exitInterior() {
    if (!this.activeInterior) return;
    this.activeInterior.group.visible = false;
    this.activeInterior = null;
    this.pos.copy(this.interiorReturn);
    this.pos.z += 6;
    this.world.root.visible = true;
    this.scene.fog = new THREE.Fog(this.map.sky, 90, this.map.fog);
    uiStore.set({ interiorName: null });
  }

  /* ------------------------------------------------------------------ */
  /* waypoints / travel                                                  */
  /* ------------------------------------------------------------------ */

  setWaypoint(x: number, z: number) {
    this.waypoint = { x, z };
    if (!this.waypointMesh) {
      const m = createMarker("#38bdf8", 2);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 60, 8),
        new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.22 }),
      );
      beam.position.y = 30;
      m.add(beam);
      this.waypointMesh = m as unknown as THREE.Mesh;
      this.scene.add(m);
    }
    this.waypointMesh.visible = true;
    this.waypointMesh.position.set(x, 0, z);
    notify("Waypoint set", "GPS route active", "info", 2500);
  }

  clearWaypoint() {
    this.waypoint = null;
    if (this.waypointMesh) this.waypointMesh.visible = false;
  }

  async travelTo(mapId: string) {
    const conf = MAP_BY_ID[mapId];
    if (!conf) return;
    uiStore.set({ phase: "loading", loadingText: `Travelling to ${conf.name}`, loadingPct: 10, panel: null });
    await new Promise((r) => setTimeout(r, 250));
    await this.loadMap(mapId);
    updatePlayer((s) => ({
      currentMap: mapId,
      achievements: [...new Set([...s.achievements, `visited_${mapId}`])],
    }));
    const visited = (playerStore.get()?.achievements ?? []).filter((a) => a.startsWith("visited_"));
    if (visited.length >= 5) grantAchievement("a_explorer", "Explorer");
    uiStore.set({ phase: "playing", loadingPct: 100 });
    notify(`Welcome to ${conf.name}`, conf.tagline, "success");
  }

  teleport(x: number, z: number) {
    if (this.currentVehicle) {
      this.currentVehicle.pos.set(x, 0, z);
      this.currentVehicle.rig.root.position.set(x, 0, z);
    }
    this.pos.set(x, 0, z);
  }

  /* ------------------------------------------------------------------ */
  /* main loop                                                           */
  /* ------------------------------------------------------------------ */

  private tick() {
    const dtRaw = this.clock.getDelta();
    const dt = Math.min(dtRaw, 0.05);
    const playing = uiStore.get().phase === "playing";
    const paused = !!uiStore.get().panel && uiStore.get().panel !== "phone";

    this.frames++;
    this.fpsTimer += dtRaw;
    if (this.fpsTimer > 0.5) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }
    this.updateDynamicResolution(dtRaw);
    // refresh shadows every other frame — halves shadow render cost
    this.shadowTick++;
    if (this.shadowTick % 2 === 0) this.renderer.shadowMap.needsUpdate = true;

    if (playing) {
      this.updateTime(dt);
      if (!paused) {
        if (this.currentVehicle) this.updateDriving(dt);
        else this.updateOnFoot(dt);
        this.traffic?.update(dt);
        this.police?.update(dt);
        this.gameplay?.update(dt);
        this.updateInteractions(dt);
      } else if (this.police?.arrested) {
        // custody timer must keep running while the arrest screen is open
        this.police.update(dt);
      }
      if (this.health <= 0) this.handleDeath();
      this.updateCamera(dt);
      this.updateStreaming();
      this.accumHud += dt;
      if (this.accumHud > 0.12) {
        this.accumHud = 0;
        this.publishHud();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateTime(dt: number) {
    this.timeOfDay = (this.timeOfDay + (dt * this.daySpeed) / 3600) % 24;
    const t = this.timeOfDay;
    const angle = ((t - 6) / 24) * Math.PI * 2;
    const sunHeight = Math.sin(angle);
    const cx = this.pos.x;
    const cz = this.pos.z;
    this.sun.position.set(cx + Math.cos(angle) * 140, 40 + sunHeight * 150, cz + 70);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.target.updateMatrixWorld();

    const day = Math.max(0, Math.min(1, sunHeight * 1.6 + 0.25));
    const night = 1 - day;
    this.sun.intensity = 0.15 + day * 2.1;
    this.hemi.intensity = 0.2 + day * 0.7;
    this.ambient.intensity = 0.12 + day * 0.2;

    const dayCol = new THREE.Color(this.map.sky);
    const duskCol = new THREE.Color("#e58b5c");
    const nightCol = new THREE.Color("#0a1020");
    const isDusk = Math.abs(sunHeight) < 0.25;
    const target = nightCol.clone().lerp(dayCol, day);
    if (isDusk) target.lerp(duskCol, 0.45 * (1 - Math.abs(sunHeight) / 0.25));
    let fogCol = target;
    if (this.weather === "Fog") fogCol = target.clone().lerp(new THREE.Color("#9aa3ad"), 0.7);
    if (this.weather === "Rain" || this.weather === "Heavy Rain")
      fogCol = target.clone().lerp(new THREE.Color("#5b6470"), 0.55);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(fogCol);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(fogCol);
      const p = playerStore.get();
      const vd = p?.settings.viewDistance ?? 420;
      this.scene.fog.far =
        this.weather === "Fog" ? Math.min(220, vd) : this.weather === "Heavy Rain" ? vd * 0.8 : vd * 1.6;
    }

    const nightMode = night > 0.55;
    for (const g of this.world.glowMeshes) g.visible = nightMode;
    for (const v of this.vehicles) {
      if (v.ai) continue;
      if (nightMode && !v.lights && v === this.currentVehicle) this.setVehicleLights(true);
    }

    // weather scheduler
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const roll = Math.random();
      this.setWeather(
        roll < 0.42 ? "Clear" : roll < 0.66 ? "Cloudy" : roll < 0.84 ? "Rain" : roll < 0.94 ? "Heavy Rain" : "Fog",
      );
      this.weatherTimer = 120 + Math.random() * 180;
    }
    if (this.rainPoints) {
      const posAttr = this.rainPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
      const fall = this.weather === "Heavy Rain" ? 46 : 30;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - fall * dt;
        if (y < 0) y = 40 + Math.random() * 10;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
      this.rainPoints.position.set(this.pos.x, 0, this.pos.z);
    }
  }

  /** /medical — knocked out: wake up at the nearest hospital with a treatment bill. */
  private handleDeath() {
    this.health = 65;
    this.armor = 0;
    this.stamina = 100;
    if (this.currentVehicle) this.exitVehicle();
    const hospital =
      this.world.markers.find((m) => m.kind === "hospital") ?? { x: 0, z: 0 };
    this.teleport(hospital.x + 10, hospital.z + 24);
    const fee = 420;
    addMoney(-fee, "Emergency treatment", "bank");
    updatePlayer((s) => ({ wanted: Math.max(0, s.wanted - 1) }));
    notify("You were knocked out", `Treated at hospital · -€${fee}`, "danger", 7000);
    audio.error();
  }

  setWeather(w: Engine["weather"]) {
    this.weather = w;
    const raining = w === "Rain" || w === "Heavy Rain";
    audio.setRain(raining ? (w === "Heavy Rain" ? 1 : 0.55) : 0);
    const effectsEnabled = playerStore.get()?.settings.effects ?? true;
    if (raining && effectsEnabled && !this.rainPoints) {
      const count = 1600;
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 90;
        arr[i * 3 + 1] = Math.random() * 45;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 90;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      this.rainPoints = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: "#b9d6ff", size: 0.22, transparent: true, opacity: 0.65 }),
      );
      this.scene.add(this.rainPoints);
    }
    if ((!raining || !effectsEnabled) && this.rainPoints) {
      this.scene.remove(this.rainPoints);
      this.rainPoints.geometry.dispose();
      this.rainPoints = null;
    }
  }

  setTimeOfDay(h: number) {
    this.timeOfDay = ((h % 24) + 24) % 24;
  }

  /* ---------------------------- on foot ----------------------------- */

  private updateOnFoot(dt: number) {
    const sprint = this.keys.sprint && this.stamina > 1;
    const baseSpeed = sprint ? 7.4 : 4.1;
    let mx = 0;
    let mz = 0;
    if (this.keys.fwd) mz += 1;
    if (this.keys.back) mz -= 1;
    if (this.keys.left) mx -= 1;
    if (this.keys.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;

    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const wx = mx * cos - mz * sin;
      const wz = -mx * sin - mz * cos;
      this.yaw = Math.atan2(wx, wz);
      const speed = baseSpeed * (this.health < 30 ? 0.65 : 1);
      this.pos.x += wx * speed * dt;
      this.pos.z += wz * speed * dt;
      this.onFootSpeed = speed;
      if (sprint) this.stamina = Math.max(0, this.stamina - dt * 14);
      const p = playerStore.get();
      if (p) {
        const d = speed * dt;
        if (Math.random() < 0.05) updatePlayer((s) => ({ stats: { ...s.stats, distance: s.stats.distance + d * 20 } }));
      }
    } else {
      this.onFootSpeed = 0;
    }
    if (!sprint) this.stamina = Math.min(100, this.stamina + dt * 9);
    if (this.health < 100 && !this.police?.pursuitActive)
      this.health = Math.min(100, this.health + dt * 0.8);

    // jump / gravity
    if (this.keys.jump && this.grounded) {
      this.vel.y = 6.2;
      this.grounded = false;
    }
    this.vel.y -= 18 * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.grounded = true;
    }

    this.resolveCircle(this.pos, 0.45);
    const lim = this.activeInterior ? 1e6 : this.map.half + 60;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    animateCharacter(this.rig, this.onFootSpeed, this.clock.elapsedTime, this.pos.y);
  }

  /* ---------------------------- driving ----------------------------- */

  private updateDriving(dt: number) {
    const v = this.currentVehicle!;
    const m = v.model;
    const throttle = this.keys.fwd ? 1 : 0;
    const brake = this.keys.back ? 1 : 0;

    if (v.fuel <= 0) {
      v.engineOn = false;
    }
    const powerScale = (v.condition / 100) * 0.5 + 0.5;
    if (v.engineOn) {
      if (throttle) v.speed += m.accel * powerScale * dt;
      if (brake) v.speed -= (v.speed > 0 ? 14 : 6) * dt;
    }
    if (!throttle && !brake) v.speed *= 1 - 0.6 * dt;
    const maxSpeed = m.topSpeed * powerScale;
    v.speed = Math.max(-9, Math.min(maxSpeed, v.speed));
    if (Math.abs(v.speed) < 0.06) v.speed = 0;

    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    const grip = this.weather === "Rain" ? 0.82 : this.weather === "Heavy Rain" ? 0.68 : 1;
    const speedFactor = Math.min(1, Math.abs(v.speed) / 14);
    v.steer += (steerInput - v.steer) * Math.min(1, dt * 8);
    v.yaw += v.steer * m.handling * 0.42 * speedFactor * grip * dt * Math.sign(v.speed || 1);

    const nx = v.pos.x + Math.sin(v.yaw) * v.speed * dt;
    const nz = v.pos.z + Math.cos(v.yaw) * v.speed * dt;
    const probe = this._vA.set(nx, 0, nz);
    const radius = Math.max(m.body.w, m.body.l * 0.45) * 0.6;
    const hit = this.resolveCircle(probe, radius);
    if (hit) {
      const impact = Math.abs(v.speed);
      if (impact > 6) {
        v.condition = Math.max(0, v.condition - impact * 0.35);
        audio.crash(impact / 12);
        this.health = Math.max(0, this.health - Math.max(0, impact - 12) * 0.6);
        if (v.owned) this.syncOwnedVehicleState(v);
      }
      v.speed *= -0.15;
    }
    v.pos.set(probe.x, 0, probe.z);
    const lim = this.map.half + 40;
    v.pos.x = Math.max(-lim, Math.min(lim, v.pos.x));
    v.pos.z = Math.max(-lim, Math.min(lim, v.pos.z));

    v.rig.root.position.copy(v.pos);
    v.rig.root.rotation.y = v.yaw;
    const wheelSpin = (v.speed / (m.wheelR * Math.PI * 2)) * dt * 6;
    for (const w of v.rig.wheels) w.rotation.x += wheelSpin;

    if (v.engineOn && throttle) v.fuel = Math.max(0, v.fuel - dt * 0.06 * (1 + Math.abs(v.speed) / 25));
    audio.engineUpdate(Math.min(1, Math.abs(v.speed) / m.topSpeed), throttle);

    if (v.siren) {
      const flash = Math.floor(this.clock.elapsedTime * 6) % 2 === 0;
      setEmissive(v.rig.beaconA, flash ? 0x2563eb : 0x0a0a0a, flash ? 3 : 0);
      setEmissive(v.rig.beaconB, flash ? 0x0a0a0a : 0xdc2626, flash ? 0 : 3);
    }

    this.pos.set(v.pos.x, 0, v.pos.z);
    this.yaw = v.yaw;

    const dist = Math.abs(v.speed) * dt;
    if (Math.random() < 0.08)
      updatePlayer((s) => {
        const nd = s.stats.distance + dist * 12;
        if (nd > 50000 && !s.achievements.includes("a_roadwarrior")) grantAchievement("a_roadwarrior", "Road Warrior");
        return { stats: { ...s.stats, distance: nd } };
      });
  }

  /* ---------------------------- camera ------------------------------ */

  private updateCamera(dt: number) {
    const target = this._vB.set(this.pos.x, this.pos.y + 1.5, this.pos.z);
    if (this.currentVehicle) {
      const want = this.currentVehicle.yaw + Math.PI;
      const diff = ((want - this.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(this.currentVehicle.speed) > 2)
        this.camYaw += diff * Math.min(1, dt * 2.2);
    }
    const dist = this.currentVehicle
      ? this.camDist + this.currentVehicle.model.body.l * 0.55
      : this.camDist;
    const cx = target.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = target.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = target.y + Math.sin(this.camPitch) * dist + 1.2;
    this.camera.position.lerp(this._vA.set(cx, Math.max(0.8, cy), cz), Math.min(1, dt * 9));
    this.camera.lookAt(target);
  }

  /* ---------------------------- streaming --------------------------- */

  private streamTimer = 0;
  private updateStreaming() {
    this.streamTimer += 1;
    if (this.streamTimer % 12 !== 0) return;
    const p = playerStore.get();
    const vd = (p?.settings.viewDistance ?? 420) * 1.25;
    for (const c of this.world.chunks) {
      const d = Math.hypot(c.cx - this.pos.x, c.cz - this.pos.z);
      c.group.visible = d < vd && !this.activeInterior;
    }
  }

  /* ---------------------------- interactions ------------------------ */

  private updateInteractions(dt: number) {
    let best: WorldMarker | null = null;
    let bd = 7;
    if (this.activeInterior) {
      const exitD = Math.hypot(this.pos.x - this.activeInterior.exit.x, this.pos.z - this.activeInterior.exit.z);
      const key = this.activeInterior.id;
      if (exitD < 4) {
        this.setNearby("Press E to exit", "exit");
        if (this.keys.interact) {
          this.keys.interact = false;
          this.exitInterior();
        }
        return;
      }
      const terminalD = Math.hypot(this.pos.x - this.activeInterior.origin.x, this.pos.z - 0);
      if (terminalD < 8) {
        const label =
          key === "police"
            ? "Press E for the police terminal"
            : key === "bank"
              ? "Press E for the bank counter"
              : key === "shop"
                ? "Press E to shop"
                : key === "hospital"
                  ? "Press E for the medical desk"
                  : key === "fire"
                    ? "Press E for the duty board"
                    : "Press E to use";
        this.setNearby(label, `interior_${key}`);
        if (this.keys.interact) {
          this.keys.interact = false;
          audio.ui();
          uiStore.set({
            panel:
              key === "police"
                ? "mdt"
                : key === "bank"
                  ? "bank"
                  : key === "shop"
                    ? "shop"
                    : "jobs",
            panelData: { label: key },
          });
        }
        return;
      }
      this.setNearby(null, "");
      return;
    }

    for (const m of this.world.markers) {
      const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    this.nearbyMarker = best;

    const nearVeh = !this.currentVehicle ? this.findNearestVehicle(4.5) : null;
    this.nearbyVehicle = nearVeh;

    if (this.holdAction) {
      if (this.keys.interact) {
        this.holdAction.t += dt;
        this.setNearby(
          `${this.holdAction.label} ${Math.round((this.holdAction.t / this.holdAction.need) * 100)}%`,
          "hold",
        );
        if (this.holdAction.t >= this.holdAction.need) {
          const done = this.holdAction;
          this.holdAction = null;
          this.gameplay.completeHold(done.key);
        }
        return;
      }
      this.holdAction = null;
    }

    if (best) {
      const label = this.markerPrompt(best);
      this.setNearby(label, best.id);
      if (this.keys.interact) {
        this.keys.interact = false;
        this.activateMarker(best);
      }
      return;
    }
    if (nearVeh) {
      this.setNearby(
        nearVeh.locked && !nearVeh.owned
          ? `Press F to break into ${nearVeh.model.name}`
          : `Press F to enter ${nearVeh.model.name}`,
        `veh_${nearVeh.uid}`,
      );
      return;
    }
    const missionHint = this.gameplay?.nearbyPrompt();
    if (missionHint) {
      this.setNearby(missionHint.label, missionHint.key);
      if (this.keys.interact) {
        this.keys.interact = false;
        this.gameplay.activateMissionStep();
      }
      return;
    }
    this.setNearby(null, "");
  }

  private markerPrompt(m: WorldMarker) {
    switch (m.kind) {
      case "shop":
        return `Press E — ${m.label}`;
      case "atm":
        return "Press E — ATM";
      case "bank":
        return "Press E — Enter NovaBank";
      case "job":
        return "Press E — Job Centre";
      case "garage":
        return "Press E — Garage";
      case "dealership":
        return "Press E — Vehicle showroom";
      case "property":
        return `Press E — ${m.label}`;
      case "police":
        return "Press E — Enter police station";
      case "hospital":
        return "Press E — Enter hospital";
      case "fire":
        return "Press E — Enter fire station";
      case "fuel":
        return "Press E — Refuel vehicle";
      case "clothing":
        return "Press E — Clothing store";
      case "weapon":
        return "Press E — Equipment store";
      case "jewelry":
        return `Press E — ${m.label}`;
      case "travel":
        return `Press E — ${m.label}`;
      default:
        return `Press E — ${m.label}`;
    }
  }

  private activateMarker(m: WorldMarker) {
    audio.ui();
    const data = (m.data ?? {}) as Record<string, unknown>;
    switch (m.kind) {
      case "shop":
      case "jewelry":
        uiStore.set({ panel: "shop", panelData: { marker: m } });
        break;
      case "clothing":
        uiStore.set({ panel: "clothing", panelData: { marker: m } });
        break;
      case "weapon":
        uiStore.set({ panel: "weapon", panelData: { marker: m } });
        break;
      case "atm":
        uiStore.set({ panel: "atm", panelData: { marker: m } });
        break;
      case "bank":
        this.enterInterior("bank", m.label);
        break;
      case "job":
        uiStore.set({ panel: "jobs", panelData: { marker: m } });
        break;
      case "garage":
        uiStore.set({ panel: "garage", panelData: { marker: m } });
        break;
      case "dealership":
        uiStore.set({ panel: "dealership", panelData: { marker: m } });
        break;
      case "property":
        uiStore.set({ panel: "property", panelData: { marker: m } });
        break;
      case "police":
        this.enterInterior("police", m.label);
        break;
      case "hospital":
        this.enterInterior("hospital", m.label);
        break;
      case "fire":
        this.enterInterior("fire", m.label);
        break;
      case "travel":
        uiStore.set({ panel: "travel", panelData: { marker: m, to: data.to, price: data.price, mode: data.mode } });
        break;
      case "fuel":
        this.gameplay.refuel();
        break;
      default:
        break;
    }
  }

  /** Only touches the HUD store when the prompt actually changes (avoids 60fps React churn). */
  private setNearby(label: string | null, key: string) {
    const cur = hudStore.get();
    if (cur.nearby === label && cur.nearbyKey === key) return;
    hudStore.set({ nearby: label, nearbyKey: key });
  }

  beginHold(key: string, seconds: number, label: string) {
    this.holdAction = { key, t: 0, need: seconds, label };
    this.keys.interact = true;
  }

  /* ---------------------------- hud --------------------------------- */

  private publishHud() {
    const v = this.currentVehicle;
    const hh = Math.floor(this.timeOfDay);
    const mm = Math.floor((this.timeOfDay % 1) * 60);
    hudStore.set({
      speed: v ? Math.abs(v.speed) * 3.6 : this.onFootSpeed * 3.6,
      gear: v ? (v.speed > 0.2 ? "D" : v.speed < -0.2 ? "R" : "N") : "—",
      inVehicle: !!v,
      vehicleName: v ? `${v.model.brand} ${v.model.name}` : "",
      fuel: v ? v.fuel : 100,
      condition: v ? v.condition : 100,
      engineOn: v ? v.engineOn : false,
      lights: v ? v.lights : false,
      siren: v ? v.siren : false,
      health: this.health,
      armor: this.armor,
      stamina: this.stamina,
      x: this.pos.x,
      z: this.pos.z,
      heading: this.yaw,
      clock: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      weather: this.weather,
      pursuit: this.police?.pursuitActive ?? false,
      arrested: this.police?.arrested ?? false,
      jailTime: Math.ceil(this.police?.jailTimer ?? 0),
      fps: this.fps,
      otherPlayers: this.gameplay?.remoteCount() ?? 0,
      peds: this.traffic?.pedCount() ?? 0,
    });
  }

  /** Blips for the minimap / big map. */
  getBlips() {
    const blips: { x: number; z: number; kind: string; label?: string }[] = [];
    for (const v of this.vehicles) {
      if (v.ai) continue;
      blips.push({ x: v.pos.x, z: v.pos.z, kind: v.owned ? "owned" : v.model.emergency ?? "vehicle" });
    }
    for (const c of this.traffic?.cars ?? []) blips.push({ x: c.pos.x, z: c.pos.z, kind: "traffic" });
    for (const u of this.police?.units ?? []) blips.push({ x: u.ent.pos.x, z: u.ent.pos.z, kind: "policeai" });
    for (const r of this.gameplay?.remotes() ?? [])
      blips.push({ x: r.x, z: r.z, kind: "player", label: r.username });
    return blips;
  }

  labelAt(text: string, x: number, y: number, z: number, ttl = 4) {
    const spr = labelSprite(text, "#fef08a");
    spr.position.set(x, y, z);
    this.scene.add(spr);
    window.setTimeout(() => {
      this.scene.remove(spr);
      spr.material.dispose();
    }, ttl * 1000);
  }
}
