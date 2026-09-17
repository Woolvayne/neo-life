"use client";

import * as THREE from "three";
import type { Engine } from "../Engine";
import { mergeBoxes } from "../meshes";

/** /npcs + /traffic — ambient life. Everything is pooled and recycled. */

type TrafficCar = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  target: number;
  axis: 0 | 1; // 0 = moves along z (north/south), 1 = moves along x
  dir: 1 | -1;
  lane: number;
  emergency: boolean;
};

type Ped = {
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  phase: number;
  panic: number;
  color: THREE.Color;
  activity: "walk" | "shop" | "talk" | "work";
  timer: number;
};

const CAR_COLORS = ["#94a3b8", "#1f2937", "#b91c1c", "#0ea5e9", "#f8fafc", "#155e75", "#4d7c0f", "#7c3aed"];

/** one shared geometry per paint colour instead of 46 unique buffers */
const carGeoCache = new Map<string, THREE.BufferGeometry>();
function carGeometry(color: string) {
  let g = carGeoCache.get(color);
  if (!g) {
    g = simpleCarGeometry(color);
    carGeoCache.set(color, g);
  }
  return g;
}

function simpleCarGeometry(color: string) {
  return mergeBoxes([
    { x: 0, y: 0.55, z: 0, w: 1.85, h: 0.7, d: 4.3, color },
    { x: 0, y: 1.1, z: -0.2, w: 1.7, h: 0.55, d: 2.1, color: "#151a22" },
    { x: 0, y: 0.3, z: 1.6, w: 1.5, h: 0.2, d: 0.2, color: "#fde68a" },
    { x: 0, y: 0.3, z: -2.1, w: 1.5, h: 0.2, d: 0.2, color: "#7f1d1d" },
    { x: -0.95, y: 0.32, z: 1.45, w: 0.22, h: 0.62, d: 0.62, color: "#111317" },
    { x: 0.95, y: 0.32, z: 1.45, w: 0.22, h: 0.62, d: 0.62, color: "#111317" },
    { x: -0.95, y: 0.32, z: -1.45, w: 0.22, h: 0.62, d: 0.62, color: "#111317" },
    { x: 0.95, y: 0.32, z: -1.45, w: 0.22, h: 0.62, d: 0.62, color: "#111317" },
  ]);
}

function pedGeometry() {
  return mergeBoxes([
    { x: 0, y: 0.42, z: 0, w: 0.3, h: 0.85, d: 0.22, color: "#ffffff" },
    { x: 0, y: 1.02, z: 0, w: 0.24, h: 0.26, d: 0.24, color: "#e8c39e" },
    { x: -0.12, y: 0.12, z: 0, w: 0.12, h: 0.45, d: 0.16, color: "#2b303a" },
    { x: 0.12, y: 0.12, z: 0, w: 0.12, h: 0.45, d: 0.16, color: "#2b303a" },
  ]);
}

export class TrafficSystem {
  engine: Engine;
  cars: TrafficCar[] = [];
  peds: Ped[] = [];
  pedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private lightClock = 0;
  private lastLightAxis = -1;
  panicLevel = 0;

  constructor(engine: Engine) {
    this.engine = engine;
    const density = engine.map.trafficDensity;
    const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35 });
    for (let i = 0; i < density; i++) {
      const geo = carGeometry(CAR_COLORS[i % CAR_COLORS.length]);
      const mesh = new THREE.Mesh(geo, carMat);
      mesh.castShadow = false;
      engine.scene.add(mesh);
      const car: TrafficCar = {
        mesh,
        pos: new THREE.Vector3(),
        yaw: 0,
        speed: 8 + Math.random() * 7,
        target: 8 + Math.random() * 7,
        axis: Math.random() > 0.5 ? 0 : 1,
        dir: Math.random() > 0.5 ? 1 : -1,
        lane: Math.random() > 0.5 ? 3.4 : -3.4,
        emergency: false,
      };
      this.cars.push(car);
      this.respawnCar(car, true);
    }

    const pedCount = engine.map.pedDensity;
    this.pedMesh = new THREE.InstancedMesh(
      pedGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      pedCount,
    );
    this.pedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pedMesh.frustumCulled = false;
    engine.scene.add(this.pedMesh);
    const activities: Ped["activity"][] = ["walk", "shop", "talk", "work"];
    for (let i = 0; i < pedCount; i++) {
      const ped: Ped = {
        pos: new THREE.Vector3(),
        yaw: Math.random() * Math.PI * 2,
        speed: 1.1 + Math.random() * 0.9,
        phase: Math.random() * 10,
        panic: 0,
        color: new THREE.Color().setHSL(Math.random(), 0.35, 0.45 + Math.random() * 0.25),
        activity: activities[Math.floor(Math.random() * activities.length)],
        timer: Math.random() * 12,
      };
      this.peds.push(ped);
      this.respawnPed(ped, true);
      this.pedMesh.setColorAt(i, ped.color);
    }
    if (this.pedMesh.instanceColor) this.pedMesh.instanceColor.needsUpdate = true;
  }

  pedCount() {
    return this.peds.length;
  }

  private roadCoord(around: number) {
    const block = this.engine.map.block;
    const half = this.engine.map.half;
    const k = Math.round(around / block) + Math.floor(Math.random() * 5) - 2;
    return Math.max(-half, Math.min(half, k * block));
  }

  private respawnCar(car: TrafficCar, initial = false) {
    const e = this.engine;
    const dist = initial ? 40 + Math.random() * 200 : 110 + Math.random() * 70;
    const ang = Math.random() * Math.PI * 2;
    const px = e.pos.x + Math.cos(ang) * dist;
    const pz = e.pos.z + Math.sin(ang) * dist;
    car.axis = Math.random() > 0.5 ? 0 : 1;
    car.dir = Math.random() > 0.5 ? 1 : -1;
    car.lane = car.dir > 0 ? 3.4 : -3.4;
    if (car.axis === 0) {
      car.pos.set(this.roadCoord(px) + car.lane, 0, pz);
      car.yaw = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.pos.set(px, 0, this.roadCoord(pz) - car.lane);
      car.yaw = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.speed = 6 + Math.random() * 8;
  }

  private respawnPed(ped: Ped, initial = false) {
    const e = this.engine;
    const dist = initial ? 15 + Math.random() * 90 : 70 + Math.random() * 50;
    const ang = Math.random() * Math.PI * 2;
    const px = e.pos.x + Math.cos(ang) * dist;
    const pz = e.pos.z + Math.sin(ang) * dist;
    const block = e.map.block;
    const snapX = Math.round(px / block) * block + (Math.random() > 0.5 ? 9.5 : -9.5);
    ped.pos.set(snapX, 0, pz);
    ped.yaw = Math.random() > 0.5 ? 0 : Math.PI;
    ped.panic = 0;
  }

  /** A crime/gunshot scares everyone nearby (they will call it in). */
  alarm(x: number, z: number, radius = 45) {
    this.panicLevel = 1;
    for (const p of this.peds) {
      if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius) {
        p.panic = 6 + Math.random() * 4;
        p.yaw = Math.atan2(p.pos.x - x, p.pos.z - z);
      }
    }
  }

  private lightGreenAxis() {
    // 0 => north/south green, 1 => east/west green
    return Math.floor(this.lightClock / 14) % 2 === 0 ? 0 : 1;
  }

  update(dt: number) {
    const e = this.engine;
    this.lightClock += dt;
    this.panicLevel = Math.max(0, this.panicLevel - dt * 0.2);

    // traffic light instance colours — only re-upload when the phase flips
    const inst = e.world.trafficLightMesh;
    const greenAxis = this.lightGreenAxis();
    if (inst && greenAxis !== this.lastLightAxis) {
      this.lastLightAxis = greenAxis;
      const red = new THREE.Color(0xef4444);
      const grn = new THREE.Color(0x22c55e);
      e.world.trafficLights.forEach((t, i) => {
        const nsGreen = (greenAxis + t.phase) % 2 === 0;
        inst.setColorAt(i * 2, nsGreen ? grn : red);
        inst.setColorAt(i * 2 + 1, nsGreen ? red : grn);
      });
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }

    for (const car of this.cars) {
      const d = Math.hypot(car.pos.x - e.pos.x, car.pos.z - e.pos.z);
      if (d > 300) {
        this.respawnCar(car);
        continue;
      }
      // stop at red light
      let stop = false;
      const block = e.map.block;
      const aheadX = car.axis === 1 ? car.pos.x + car.dir * 14 : car.pos.x;
      const aheadZ = car.axis === 0 ? car.pos.z + car.dir * 14 : car.pos.z;
      const nearIntX = Math.abs(aheadX - Math.round(aheadX / block) * block) < 9;
      const nearIntZ = Math.abs(aheadZ - Math.round(aheadZ / block) * block) < 9;
      if (nearIntX && nearIntZ) {
        const ix = Math.round(aheadX / block);
        const iz = Math.round(aheadZ / block);
        const phase = (ix + iz) % 2 === 0 ? 0 : 1;
        const nsGreen = (greenAxis + phase) % 2 === 0;
        stop = car.axis === 0 ? !nsGreen : nsGreen;
      }
      // avoid the player's vehicle
      const pv = e.currentVehicle;
      if (pv) {
        const pd = Math.hypot(pv.pos.x - car.pos.x, pv.pos.z - car.pos.z);
        if (pd < 9) stop = true;
      }
      const targetSpeed = stop ? 0 : car.target;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2.2);
      if (car.axis === 0) car.pos.z += car.dir * car.speed * dt;
      else car.pos.x += car.dir * car.speed * dt;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.yaw;
      const half = e.map.half;
      if (Math.abs(car.pos.x) > half || Math.abs(car.pos.z) > half) this.respawnCar(car);
      car.mesh.visible = d < 320 && !e.activeInterior;
    }

    // pedestrians
    const dummy = this.dummy;
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
      if (d > 190) {
        this.respawnPed(p);
      }
      p.timer -= dt;
      if (p.timer <= 0) {
        p.timer = 6 + Math.random() * 10;
        if (p.panic <= 0) {
          p.activity = (["walk", "shop", "talk", "work"] as const)[Math.floor(Math.random() * 4)];
          if (p.activity === "walk") p.yaw += (Math.random() - 0.5) * Math.PI;
        }
      }
      let speed = p.speed;
      if (p.panic > 0) {
        p.panic -= dt;
        speed = p.speed * 2.6;
      } else if (p.activity !== "walk") {
        speed = 0;
      }
      // avoid the player vehicle
      const pv = e.currentVehicle;
      if (pv) {
        const vd = Math.hypot(pv.pos.x - p.pos.x, pv.pos.z - p.pos.z);
        if (vd < 7) {
          p.yaw = Math.atan2(p.pos.x - pv.pos.x, p.pos.z - pv.pos.z);
          speed = p.speed * 2.4;
          if (vd < 2 && Math.abs(pv.speed) > 6) {
            p.panic = 5;
            this.alarm(p.pos.x, p.pos.z, 30);
          }
        }
      }
      p.pos.x += Math.sin(p.yaw) * speed * dt;
      p.pos.z += Math.cos(p.yaw) * speed * dt;
      if (e.resolveCircle(p.pos, 0.4)) p.yaw += Math.PI * (0.5 + Math.random() * 0.5);

      p.phase += dt * (speed > 0.1 ? 6 : 1);
      dummy.position.set(p.pos.x, speed > 0.1 ? Math.abs(Math.sin(p.phase)) * 0.05 : 0, p.pos.z);
      dummy.rotation.set(0, p.yaw, 0);
      const vis = d < 170 && !e.activeInterior;
      dummy.scale.setScalar(vis ? 1 : 0.0001);
      dummy.updateMatrix();
      this.pedMesh.setMatrixAt(i, dummy.matrix);
    }
    this.pedMesh.instanceMatrix.needsUpdate = true;
  }

  /** Nearest pedestrian used by weapons / paramedic / police interactions. */
  nearestPed(x: number, z: number, maxDist = 6) {
    let best: Ped | null = null;
    let bd = maxDist;
    for (const p of this.peds) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  scatter(x: number, z: number) {
    this.alarm(x, z, 60);
  }

  dispose() {
    for (const c of this.cars) {
      // geometries are shared via carGeoCache — do not dispose them here
      this.engine.scene.remove(c.mesh);
    }
    this.cars = [];
    this.engine.scene.remove(this.pedMesh);
    this.pedMesh.geometry.dispose();
    this.peds = [];
  }
}
