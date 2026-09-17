import * as THREE from "three";
import {
  MapConfig,
  District,
  districtAt,
  mulberry32,
  hashSeed,
} from "./maps";
import {
  BoxSpec,
  mergeBoxes,
  facadeTexture,
  asphaltTexture,
  createMarker,
  labelSprite,
} from "@/game/engine/meshes";
import type { WorldMarker } from "@/game/core/types";

export type Collider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
};

export type Chunk = {
  key: string;
  cx: number;
  cz: number;
  group: THREE.Group;
  glow: THREE.Mesh | null;
};

export type TrafficLightNode = {
  x: number;
  z: number;
  /** 0 = north/south green, 1 = east/west green */
  phase: number;
};

export type PropertyListing = {
  id: string;
  name: string;
  kind: string;
  x: number;
  z: number;
  price: number;
  rent: number;
};

export type WorldData = {
  root: THREE.Group;
  chunks: Chunk[];
  colliders: Collider[];
  colliderGrid: Map<string, Collider[]>;
  markers: WorldMarker[];
  trafficLights: TrafficLightNode[];
  trafficLightMesh: THREE.InstancedMesh | null;
  properties: PropertyListing[];
  roadLines: number[];
  block: number;
  half: number;
  spawnPoints: { x: number; z: number }[];
  glowMeshes: THREE.Mesh[];
  waterMeshes: THREE.Mesh[];
};

const CHUNK = 190;
const ROAD_HALF = 7;

const chunkKey = (x: number, z: number) =>
  `${Math.floor(x / CHUNK)}:${Math.floor(z / CHUNK)}`;

const cellKey = (x: number, z: number) =>
  `${Math.floor(x / 40)}:${Math.floor(z / 40)}`;

function pushCollider(world: WorldData, c: Collider) {
  world.colliders.push(c);
  for (let x = c.minX; x <= c.maxX + 40; x += 40) {
    for (let z = c.minZ; z <= c.maxZ + 40; z += 40) {
      const k = cellKey(x, z);
      const arr = world.colliderGrid.get(k);
      if (arr) arr.push(c);
      else world.colliderGrid.set(k, [c]);
    }
  }
}

type Buckets = {
  struct: Map<string, BoxSpec[]>;
  plain: Map<string, BoxSpec[]>;
  glow: Map<string, BoxSpec[]>;
};

function add(bucket: Map<string, BoxSpec[]>, b: BoxSpec) {
  const k = chunkKey(b.x, b.z);
  const arr = bucket.get(k);
  if (arr) arr.push(b);
  else bucket.set(k, [b]);
}

function shade(base: THREE.Color, amt: number) {
  const c = base.clone();
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

export function generateWorld(map: MapConfig): WorldData {
  const rng = mulberry32(hashSeed(map.id));
  const root = new THREE.Group();
  const world: WorldData = {
    root,
    chunks: [],
    colliders: [],
    colliderGrid: new Map(),
    markers: [],
    trafficLights: [],
    trafficLightMesh: null,
    properties: [],
    roadLines: [],
    block: map.block,
    half: map.half,
    spawnPoints: [],
    glowMeshes: [],
    waterMeshes: [],
  };

  /* ---------------- ground ---------------- */
  const groundMat = new THREE.MeshStandardMaterial({
    color: map.ground,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(map.half * 2 + 400, map.half * 2 + 400),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  /* ---------------- water ---------------- */
  for (const w of map.water ?? []) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w.w, w.h),
      new THREE.MeshStandardMaterial({
        color: "#20486b",
        roughness: 0.18,
        metalness: 0.6,
        transparent: true,
        opacity: 0.92,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(w.x, 0.06, w.z);
    root.add(mesh);
    world.waterMeshes.push(mesh);
  }

  /* ---------------- hills ---------------- */
  for (const h of map.hills ?? []) {
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(h.r, h.h, 16, 3),
      new THREE.MeshStandardMaterial({ color: "#5b6450", roughness: 1, flatShading: true }),
    );
    hill.position.set(h.x, h.h / 2 - 2, h.z);
    hill.receiveShadow = true;
    root.add(hill);
    pushCollider(world, {
      minX: h.x - h.r * 0.45,
      maxX: h.x + h.r * 0.45,
      minZ: h.z - h.r * 0.45,
      maxZ: h.z + h.r * 0.45,
      h: h.h,
    });
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(h.r * 0.36, h.h * 0.34, 16, 1),
      new THREE.MeshStandardMaterial({ color: "#e8eef5", roughness: 0.9, flatShading: true }),
    );
    cap.position.set(h.x, h.h * 0.84, h.z);
    root.add(cap);
  }

  const buckets: Buckets = { struct: new Map(), plain: new Map(), glow: new Map() };

  /* ---------------- road grid ---------------- */
  const lines: number[] = [];
  for (let v = -map.half; v <= map.half + 1; v += map.block) lines.push(v);
  world.roadLines = lines;

  const roadColor = "#3a3d42";
  const laneColor = "#c9cdd4";
  const walkColor = "#6d727a";
  const span = map.half * 2 + map.block;

  for (const v of lines) {
    // segment roads into chunk-sized pieces so they stream with the chunk
    for (let s = -map.half; s < map.half; s += CHUNK) {
      const len = Math.min(CHUNK, map.half - s);
      const midS = s + len / 2;
      add(buckets.plain, { x: v, y: 0.04, z: midS, w: ROAD_HALF * 2, h: 0.08, d: len, color: roadColor });
      add(buckets.plain, { x: midS, y: 0.04, z: v, w: len, h: 0.08, d: ROAD_HALF * 2, color: roadColor });
      // center dashes
      for (let d = 0; d < len; d += 12) {
        add(buckets.plain, { x: v, y: 0.09, z: s + d, w: 0.25, h: 0.02, d: 5, color: laneColor });
        add(buckets.plain, { x: s + d, y: 0.09, z: v, w: 5, h: 0.02, d: 0.25, color: laneColor });
      }
      // sidewalk kerbs
      add(buckets.plain, { x: v - ROAD_HALF - 1.1, y: 0.1, z: midS, w: 2.2, h: 0.2, d: len, color: walkColor });
      add(buckets.plain, { x: v + ROAD_HALF + 1.1, y: 0.1, z: midS, w: 2.2, h: 0.2, d: len, color: walkColor });
      add(buckets.plain, { x: midS, y: 0.1, z: v - ROAD_HALF - 1.1, w: len, h: 0.2, d: 2.2, color: walkColor });
      add(buckets.plain, { x: midS, y: 0.1, z: v + ROAD_HALF + 1.1, w: len, h: 0.2, d: 2.2, color: walkColor });
    }
  }
  // wide ring highway
  const ringR = map.half - map.block * 0.5;
  for (const sgn of [-1, 1]) {
    add(buckets.plain, { x: sgn * ringR, y: 0.05, z: 0, w: 20, h: 0.1, d: map.half * 2, color: "#33363b" });
    add(buckets.plain, { x: 0, y: 0.05, z: sgn * ringR, w: map.half * 2, h: 0.1, d: 20, color: "#33363b" });
  }

  /* ---------------- traffic lights at major intersections ---------------- */
  const majorEvery = 2;
  lines.forEach((lx, i) => {
    lines.forEach((lz, j) => {
      if (i % majorEvery || j % majorEvery) return;
      if (Math.abs(lx) > map.half - 10 || Math.abs(lz) > map.half - 10) return;
      const dist = districtAt(map, lx, lz);
      if (!dist || dist.kind === "country" || dist.kind === "mountain") return;
      world.trafficLights.push({ x: lx, z: lz, phase: (i + j) % 2 });
      for (const [ox, oz] of [
        [-ROAD_HALF - 1, -ROAD_HALF - 1],
        [ROAD_HALF + 1, ROAD_HALF + 1],
      ]) {
        add(buckets.plain, {
          x: lx + ox,
          y: 2.4,
          z: lz + oz,
          w: 0.18,
          h: 4.8,
          d: 0.18,
          color: "#20242a",
        });
      }
    });
  });

  /* ---------------- blocks ---------------- */
  const buildingBase = new THREE.Color("#8d97a3");
  const houseColors = ["#c9b8a0", "#d7cdbb", "#b9c3cc", "#cbb6ac", "#aab8a6"];
  const industrialColors = ["#7a828c", "#6b7280", "#8a8f96"];

  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + ROAD_HALF + 2.2;
      const x1 = lines[i + 1] - ROAD_HALF - 2.2;
      const z0 = lines[j] + ROAD_HALF + 2.2;
      const z1 = lines[j + 1] - ROAD_HALF - 2.2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const bw = x1 - x0;
      const bd = z1 - z0;
      if (bw < 8 || bd < 8) continue;
      const dist: District | null = districtAt(map, cx, cz);
      const kind = dist?.kind ?? (Math.hypot(cx, cz) < map.half * 0.55 ? "commercial" : "country");
      if (isWater(map, cx, cz)) continue;

      buildBlock(world, buckets, map, rng, kind, cx, cz, bw, bd);
    }
  }

  /* ---------------- street lamps ---------------- */
  for (let i = 0; i < lines.length; i++) {
    for (let s = -map.half; s < map.half; s += 46) {
      if (rng() > 0.75) continue;
      const lx = lines[i] + ROAD_HALF + 1.2;
      const lz = s + 23;
      if (isWater(map, lx, lz)) continue;
      add(buckets.plain, { x: lx, y: 3.1, z: lz, w: 0.16, h: 6.2, d: 0.16, color: "#41464d" });
      add(buckets.plain, { x: lx - 0.7, y: 6.1, z: lz, w: 1.6, h: 0.14, d: 0.14, color: "#41464d" });
      add(buckets.glow, { x: lx - 1.4, y: 6.0, z: lz, w: 0.5, h: 0.16, d: 0.34, color: "#ffe9a8" });

      const mx = s + 23;
      const mz = lines[i] + ROAD_HALF + 1.2;
      if (isWater(map, mx, mz)) continue;
      add(buckets.plain, { x: mx, y: 3.1, z: mz, w: 0.16, h: 6.2, d: 0.16, color: "#41464d" });
      add(buckets.plain, { x: mx, y: 6.1, z: mz - 0.7, w: 0.14, h: 0.14, d: 1.6, color: "#41464d" });
      add(buckets.glow, { x: mx, y: 6.0, z: mz - 1.4, w: 0.34, h: 0.16, d: 0.5, color: "#ffe9a8" });
    }
  }

  /* ---------------- landmarks ---------------- */
  for (const lm of map.landmarks) {
    buildLandmark(world, buckets, lm.kind, lm.x, lm.z, lm.label, root);
    const markerKind = landmarkMarkerKind(lm.kind);
    if (markerKind) {
      world.markers.push({
        id: lm.id,
        kind: markerKind,
        label: lm.label,
        x: lm.x,
        z: lm.z,
        data: { interior: lm.interior, ...(lm.data ?? {}) },
      });
    }
  }

  for (const t of map.travel) {
    world.markers.push({
      id: `travel_${t.to}`,
      kind: "travel",
      label: `${t.mode} → ${t.label}`,
      x: t.x,
      z: t.z,
      data: { to: t.to, mode: t.mode, price: t.price },
    });
    add(buckets.plain, { x: t.x, y: 2, z: t.z, w: 6, h: 4, d: 6, color: "#233044" });
  }

  /* ---------------- property listings ---------------- */
  const kinds = ["Apartment", "Townhouse", "Villa", "Garage", "Business Unit"];
  for (let n = 0; n < 14; n++) {
    const i = Math.floor(rng() * (lines.length - 1));
    const j = Math.floor(rng() * (lines.length - 1));
    const px = lines[i] + map.block * 0.5;
    const pz = lines[j] + map.block * 0.5;
    if (isWater(map, px, pz)) continue;
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const price = Math.round(
      (kind === "Garage" ? 18000 : kind === "Villa" ? 320000 : kind === "Business Unit" ? 240000 : 95000) *
        (0.75 + rng() * 0.8),
    );
    const id = `${map.id}_prop_${n}`;
    world.properties.push({
      id,
      name: `${kind} · ${Math.floor(rng() * 90 + 5)} ${streetName(rng)}`,
      kind,
      x: px,
      z: pz,
      price,
      rent: Math.round(price * 0.004),
    });
    world.markers.push({
      id,
      kind: "property",
      label: `${kind} for sale`,
      x: px,
      z: pz,
      data: { price, name: kind },
    });
  }

  /* ---------------- build chunk meshes ---------------- */
  const structMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: facadeTexture(),
    roughness: 0.88,
    metalness: 0.04,
  });
  const plainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: asphaltTexture(),
    roughness: 0.95,
    metalness: 0.02,
  });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });

  const keys = new Set<string>([
    ...buckets.struct.keys(),
    ...buckets.plain.keys(),
    ...buckets.glow.keys(),
  ]);
  for (const key of keys) {
    const [kx, kz] = key.split(":").map(Number);
    const group = new THREE.Group();
    const s = buckets.struct.get(key);
    if (s?.length) {
      const mesh = new THREE.Mesh(mergeBoxes(s), structMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    const p = buckets.plain.get(key);
    if (p?.length) {
      const mesh = new THREE.Mesh(mergeBoxes(p), plainMat);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    let glowMesh: THREE.Mesh | null = null;
    const g = buckets.glow.get(key);
    if (g?.length) {
      glowMesh = new THREE.Mesh(mergeBoxes(g), glowMat);
      glowMesh.visible = false;
      group.add(glowMesh);
      world.glowMeshes.push(glowMesh);
    }
    root.add(group);
    world.chunks.push({
      key,
      cx: kx * CHUNK + CHUNK / 2,
      cz: kz * CHUNK + CHUNK / 2,
      group,
      glow: glowMesh,
    });
  }

  /* ---------------- traffic light heads (single instanced draw) ------- */
  if (world.trafficLights.length) {
    const geo = new THREE.BoxGeometry(0.5, 1.1, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(geo, mat, world.trafficLights.length * 2);
    const dummy = new THREE.Object3D();
    world.trafficLights.forEach((t, idx) => {
      dummy.position.set(t.x - ROAD_HALF - 1, 5.2, t.z - ROAD_HALF - 1);
      dummy.updateMatrix();
      inst.setMatrixAt(idx * 2, dummy.matrix);
      dummy.position.set(t.x + ROAD_HALF + 1, 5.2, t.z + ROAD_HALF + 1);
      dummy.updateMatrix();
      inst.setMatrixAt(idx * 2 + 1, dummy.matrix);
      inst.setColorAt(idx * 2, new THREE.Color(0x22c55e));
      inst.setColorAt(idx * 2 + 1, new THREE.Color(0xef4444));
    });
    inst.instanceMatrix.needsUpdate = true;
    root.add(inst);
    world.trafficLightMesh = inst;
  }

  /* ---------------- trees — 2 instanced draw calls total ---------------- */
  const treeCount = map.id === "novacity" ? 220 : 420;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1, 6);
  const crownGeo = new THREE.ConeGeometry(1, 1, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#4a3421", roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
  trunks.castShadow = true;
  crowns.castShadow = true;
  trunks.frustumCulled = false;
  crowns.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const greenA = new THREE.Color("#2f6b34");
  const greenB = new THREE.Color("#3d7a3a");
  let placed = 0;
  for (let n = 0; n < treeCount * 3 && placed < treeCount; n++) {
    const x = (rng() * 2 - 1) * map.half;
    const z = (rng() * 2 - 1) * map.half;
    const d = districtAt(map, x, z);
    const kindOk = !d || d.kind === "country" || d.kind === "park" || d.kind === "mountain" || d.kind === "suburb";
    if (!kindOk || isWater(map, x, z)) continue;
    if (nearRoad(x, map.block) && nearRoad(z, map.block)) continue;
    const th = 3.5 + rng() * 4;
    const crownR = 1.3 + rng() * 0.9;
    const scale = 0.7 + rng() * 0.8;
    const rotY = rng() * Math.PI;
    // trunk: unit cylinder height 1 → scale to th*0.45
    dummy.position.set(x, (th * 0.45 * scale) / 2, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(scale, th * 0.45 * scale, scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    // crown: unit cone height 1, apex at +0.5 → scale to th*0.8
    dummy.position.set(x, (th * 0.22 + th * 0.4) * scale, z);
    dummy.scale.set(crownR * scale, th * 0.8 * scale, crownR * scale);
    dummy.updateMatrix();
    crowns.setMatrixAt(placed, dummy.matrix);
    crowns.setColorAt(placed, rng() > 0.5 ? greenA : greenB);
    placed++;
  }
  trunks.count = placed;
  crowns.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  root.add(trunks, crowns);

  world.spawnPoints.push({ x: map.spawn.x, z: map.spawn.z });
  return world;
}

function streetName(rng: () => number) {
  const a = ["Kronen", "Linden", "Hafen", "Nord", "Berg", "Markt", "Alt", "Sonnen", "Wald", "Stein"];
  const b = ["straße", "allee", "weg", "platz", "gasse", "ring"];
  return `${a[Math.floor(rng() * a.length)]}${b[Math.floor(rng() * b.length)]}`;
}

function nearRoad(v: number, block: number) {
  const m = Math.abs(((v % block) + block) % block);
  return m < 12 || m > block - 12;
}

function isWater(map: MapConfig, x: number, z: number) {
  for (const w of map.water ?? []) {
    if (Math.abs(x - w.x) < w.w / 2 && Math.abs(z - w.z) < w.h / 2) return true;
  }
  return false;
}

function landmarkMarkerKind(kind: string): WorldMarker["kind"] | null {
  switch (kind) {
    case "police":
      return "police";
    case "hospital":
      return "hospital";
    case "fire":
      return "fire";
    case "bank":
      return "bank";
    case "shop":
      return "shop";
    case "jewelry":
      return "jewelry";
    case "clothing":
      return "clothing";
    case "weapon":
      return "weapon";
    case "dealership":
      return "dealership";
    case "garage":
      return "garage";
    case "job":
      return "job";
    case "fuel":
      return "fuel";
    case "atm":
      return "atm";
    case "travel":
      return "travel";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* block builders                                                      */
/* ------------------------------------------------------------------ */

function buildBlock(
  world: WorldData,
  buckets: Buckets,
  map: MapConfig,
  rng: () => number,
  kind: string,
  cx: number,
  cz: number,
  bw: number,
  bd: number,
) {
  const base = new THREE.Color("#8d97a3");
  const put = (b: BoxSpec, collide = true, tall = true) => {
    add(tall ? buckets.struct : buckets.plain, b);
    if (collide)
      pushCollider(world, {
        minX: b.x - b.w / 2,
        maxX: b.x + b.w / 2,
        minZ: b.z - b.d / 2,
        maxZ: b.z + b.d / 2,
        h: b.y + b.h / 2,
      });
  };

  switch (kind) {
    case "downtown": {
      const cols = rng() > 0.5 ? 2 : 1;
      for (let i = 0; i < cols; i++) {
        const w = (bw / cols) * (0.62 + rng() * 0.25);
        const d = bd * (0.55 + rng() * 0.3);
        const h = 26 + rng() * 78;
        const x = cx + (cols === 1 ? 0 : (i - 0.5) * (bw / 2));
        const z = cz + (rng() - 0.5) * (bd - d) * 0.6;
        put({ x, y: h / 2, z, w, h, d, color: shade(base, (rng() - 0.5) * 0.22) });
        put(
          { x, y: h + 1.4, z, w: w * 0.45, h: 2.8, d: d * 0.45, color: "#5a616b" },
          false,
        );
        if (rng() > 0.6)
          add(buckets.glow, { x, y: h + 3.4, z, w: 0.4, h: 2.4, d: 0.4, color: "#ff3b3b" });
      }
      break;
    }
    case "commercial": {
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const w = bw / n - 2;
        const d = bd * (0.5 + rng() * 0.35);
        const h = 10 + rng() * 22;
        const x = cx - bw / 2 + w / 2 + i * (bw / n) + 1;
        const z = cz + (rng() - 0.5) * (bd - d) * 0.5;
        put({ x, y: h / 2, z, w, h, d, color: shade(base, (rng() - 0.5) * 0.25) });
        // shopfront awning
        put(
          { x, y: 3.4, z: z + d / 2 + 0.6, w: w * 0.8, h: 0.3, d: 1.4, color: ["#b91c1c", "#0f766e", "#1d4ed8"][Math.floor(rng() * 3)] },
          false,
        );
      }
      break;
    }
    case "residential": {
      // perimeter block with courtyard
      const h = 14 + rng() * 12;
      const t = 9;
      const col = shade(new THREE.Color("#b9a893"), (rng() - 0.5) * 0.2);
      put({ x: cx, y: h / 2, z: cz - bd / 2 + t / 2, w: bw, h, d: t, color: col });
      put({ x: cx, y: h / 2, z: cz + bd / 2 - t / 2, w: bw, h, d: t, color: col });
      put({ x: cx - bw / 2 + t / 2, y: h / 2, z: cz, w: t, h, d: bd - t * 2, color: col });
      put({ x: cx + bw / 2 - t / 2, y: h / 2, z: cz, w: t, h, d: bd - t * 2, color: col });
      break;
    }
    case "suburb": {
      const n = 2;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          if (rng() > 0.82) continue;
          const w = bw / n - 8;
          const d = bd / n - 8;
          const h = 5 + rng() * 3;
          const x = cx - bw / 2 + (i + 0.5) * (bw / n);
          const z = cz - bd / 2 + (j + 0.5) * (bd / n);
          const col = ["#d9cfc0", "#c8d2cd", "#e0d3b8", "#cbbfae"][Math.floor(rng() * 4)];
          put({ x, y: h / 2, z, w, h, d, color: col });
          put({ x, y: h + 0.9, z, w: w * 1.05, h: 1.8, d: d * 1.05, color: "#7c3b2e" }, false);
        }
      break;
    }
    case "industrial": {
      const h = 8 + rng() * 8;
      put({
        x: cx,
        y: h / 2,
        z: cz,
        w: bw * 0.86,
        h,
        d: bd * 0.78,
        color: ["#7a828c", "#6b7280", "#8a8f96"][Math.floor(rng() * 3)],
      });
      for (let c = 0; c < 3; c++) {
        if (rng() > 0.6) continue;
        put(
          {
            x: cx + (rng() - 0.5) * bw * 0.7,
            y: 1.3,
            z: cz + (rng() - 0.5) * bd * 0.7,
            w: 2.5,
            h: 2.6,
            d: 6,
            color: ["#b45309", "#0e7490", "#15803d", "#b91c1c"][Math.floor(rng() * 4)],
          },
          true,
          false,
        );
      }
      break;
    }
    case "port": {
      for (let c = 0; c < 8; c++) {
        const stack = 1 + Math.floor(rng() * 3);
        const x = cx + (rng() - 0.5) * bw * 0.8;
        const z = cz + (rng() - 0.5) * bd * 0.8;
        for (let s = 0; s < stack; s++) {
          put(
            {
              x,
              y: 1.3 + s * 2.7,
              z,
              w: 2.6,
              h: 2.6,
              d: 6.2,
              color: ["#b45309", "#0e7490", "#15803d", "#b91c1c", "#1e3a8a"][Math.floor(rng() * 5)],
            },
            s === 0,
            false,
          );
        }
      }
      if (rng() > 0.55) {
        // gantry crane
        const h = 26;
        put({ x: cx - 10, y: h / 2, z: cz, w: 1.6, h, d: 1.6, color: "#c2410c" });
        put({ x: cx + 10, y: h / 2, z: cz, w: 1.6, h, d: 1.6, color: "#c2410c" });
        put({ x: cx, y: h, z: cz, w: 34, h: 2, d: 2.4, color: "#ea580c" }, false);
      }
      break;
    }
    case "airport": {
      if (rng() > 0.7) {
        const h = 12;
        put({ x: cx, y: h / 2, z: cz, w: bw * 0.7, h, d: bd * 0.6, color: "#9aa3ad" });
      } else {
        add(buckets.plain, { x: cx, y: 0.05, z: cz, w: bw, h: 0.1, d: bd, color: "#4b5158" });
      }
      break;
    }
    case "park": {
      add(buckets.plain, { x: cx, y: 0.07, z: cz, w: bw, h: 0.1, d: bd, color: "#3f6b3c" });
      add(buckets.plain, { x: cx, y: 0.12, z: cz, w: bw * 0.9, h: 0.06, d: 3, color: "#8a7f6a" });
      for (let b = 0; b < 3; b++)
        add(buckets.plain, {
          x: cx + (rng() - 0.5) * bw * 0.7,
          y: 0.5,
          z: cz + (rng() - 0.5) * bd * 0.7,
          w: 1.6,
          h: 0.5,
          d: 0.6,
          color: "#6b4a2b",
        });
      break;
    }
    case "mountain":
    case "country":
    default: {
      if (rng() > 0.86) {
        const h = 6;
        put({ x: cx, y: h / 2, z: cz, w: 14, h, d: 10, color: "#c2b49a" });
        put({ x: cx, y: h + 1.2, z: cz, w: 15, h: 2.4, d: 11, color: "#8b3a2f" }, false);
        put({ x: cx + 16, y: 4, z: cz + 8, w: 12, h: 8, d: 14, color: "#8d5a3b" });
      } else if (rng() > 0.5) {
        add(buckets.plain, {
          x: cx,
          y: 0.06,
          z: cz,
          w: bw * 0.92,
          h: 0.08,
          d: bd * 0.92,
          color: ["#6d7a3a", "#7c8443", "#5d6b31", "#94824a"][Math.floor(rng() * 4)],
        });
      }
      break;
    }
  }
}

function buildLandmark(
  world: WorldData,
  buckets: Buckets,
  kind: string,
  x: number,
  z: number,
  label: string,
  root: THREE.Group,
) {
  const put = (b: BoxSpec, collide = true, glow = false) => {
    add(glow ? buckets.glow : buckets.struct, b);
    if (collide)
      pushCollider(world, {
        minX: b.x - b.w / 2,
        maxX: b.x + b.w / 2,
        minZ: b.z - b.d / 2,
        maxZ: b.z + b.d / 2,
        h: b.y + b.h / 2,
      });
  };

  const palette: Record<string, string> = {
    police: "#1e3a8a",
    hospital: "#f1f5f9",
    fire: "#b91c1c",
    bank: "#334155",
    shop: "#0f766e",
    jewelry: "#7c3aed",
    clothing: "#be185d",
    weapon: "#78350f",
    dealership: "#0ea5e9",
    garage: "#475569",
    job: "#0369a1",
    fuel: "#ca8a04",
    atm: "#1f2937",
    tower: "#64748b",
    terminal: "#94a3b8",
    warehouse: "#6b7280",
  };
  const color = palette[kind] ?? "#6b7280";

  switch (kind) {
    case "atm":
      put({ x, y: 1.1, z, w: 1.2, h: 2.2, d: 0.6, color }, false);
      put({ x, y: 1.5, z: z + 0.32, w: 0.7, h: 0.5, d: 0.06, color: "#22d3ee" }, false, true);
      break;
    case "fuel":
      put({ x, y: 3.1, z, w: 18, h: 0.5, d: 10, color: "#e2e8f0" }, false);
      for (const ox of [-5, 5]) {
        put({ x: x + ox, y: 3, z, w: 0.6, h: 6, d: 0.6, color: "#94a3b8" });
        put({ x: x + ox, y: 0.8, z: z + 2.5, w: 1, h: 1.6, d: 0.8, color });
      }
      break;
    case "tower":
      put({ x, y: 60, z, w: 26, h: 120, d: 26, color: "#7c8794" });
      put({ x, y: 124, z, w: 3, h: 10, d: 3, color: "#475569" }, false);
      put({ x, y: 130, z, w: 1.2, h: 1.2, d: 1.2, color: "#ff3b3b" }, false, true);
      break;
    case "terminal":
      put({ x, y: 9, z, w: 120, h: 18, d: 40, color: "#aab4c0" });
      put({ x, y: 19.5, z, w: 122, h: 3, d: 42, color: "#8894a3" }, false);
      put({ x: x + 90, y: 0.1, z: z - 120, w: 60, h: 0.2, d: 400, color: "#3f4349" }, false);
      break;
    case "warehouse":
      put({ x, y: 7, z, w: 60, h: 14, d: 34, color });
      put({ x, y: 14.6, z, w: 61, h: 1.4, d: 35, color: "#505861" }, false);
      break;
    case "garage":
      put({ x, y: 6, z, w: 40, h: 12, d: 30, color });
      put({ x, y: 2.2, z: z + 15.2, w: 10, h: 4.4, d: 0.6, color: "#1f2937" }, false);
      break;
    case "police":
    case "fire":
    case "hospital":
    case "bank": {
      const h = kind === "hospital" ? 24 : 14;
      put({ x, y: h / 2, z, w: 44, h, d: 30, color });
      put({ x, y: h + 1, z, w: 46, h: 2, d: 32, color: "#1f2937" }, false);
      put({ x, y: 3, z: z + 15.6, w: 14, h: 6, d: 1.2, color: "#0f172a" }, false);
      put({ x, y: h + 3.4, z, w: 1, h: 1.6, d: 1, color: kind === "fire" ? "#ff3b3b" : "#38bdf8" }, false, true);
      break;
    }
    default: {
      put({ x, y: 5, z, w: 24, h: 10, d: 18, color });
      put({ x, y: 10.8, z, w: 25, h: 1.2, d: 19, color: "#334155" }, false);
      break;
    }
  }

  if (kind !== "atm") {
    const spr = labelSprite(label);
    spr.position.set(x, kind === "tower" ? 26 : kind === "terminal" ? 22 : 16, z);
    root.add(spr);
  }

  const markerColors: Record<string, string> = {
    police: "#3b82f6",
    fire: "#ef4444",
    hospital: "#22c55e",
    bank: "#eab308",
    shop: "#14b8a6",
    jewelry: "#a855f7",
    clothing: "#ec4899",
    weapon: "#f97316",
    dealership: "#38bdf8",
    garage: "#94a3b8",
    job: "#60a5fa",
    fuel: "#facc15",
    atm: "#22d3ee",
  };
  const mc = markerColors[kind];
  if (mc) {
    const m = createMarker(mc, kind === "atm" ? 1.1 : 2.2);
    m.position.set(x, 0, z + (kind === "atm" ? 1.2 : 14));
    root.add(m);
  }
}

/* ------------------------------------------------------------------ */
/* interiors — small detached scenes placed far from the city grid     */
/* ------------------------------------------------------------------ */

export type InteriorRoom = { name: string; x: number; z: number; w: number; d: number; color: string };

export type Interior = {
  id: string;
  group: THREE.Group;
  origin: THREE.Vector3;
  exit: { x: number; z: number };
  rooms: InteriorRoom[];
  colliders: Collider[];
};

const INTERIOR_LAYOUTS: Record<string, InteriorRoom[]> = {
  police: [
    { name: "Reception", x: 0, z: 10, w: 16, d: 10, color: "#33415a" },
    { name: "Dispatch Room", x: -14, z: 0, w: 12, d: 10, color: "#1f2937" },
    { name: "Briefing Room", x: 14, z: 0, w: 12, d: 10, color: "#27364d" },
    { name: "Locker Room", x: -14, z: -12, w: 12, d: 10, color: "#334155" },
    { name: "Evidence Room", x: 14, z: -12, w: 12, d: 10, color: "#3f3f46" },
    { name: "Holding Cells", x: 0, z: -22, w: 18, d: 10, color: "#1c1c21" },
  ],
  hospital: [
    { name: "Reception", x: 0, z: 10, w: 16, d: 10, color: "#e2e8f0" },
    { name: "Treatment Bay", x: -14, z: -2, w: 14, d: 12, color: "#f8fafc" },
    { name: "Surgery", x: 14, z: -2, w: 14, d: 12, color: "#dbeafe" },
    { name: "Morgue", x: 0, z: -18, w: 16, d: 10, color: "#94a3b8" },
  ],
  fire: [
    { name: "Apparatus Bay", x: 0, z: 8, w: 22, d: 14, color: "#7f1d1d" },
    { name: "Watch Room", x: -16, z: -8, w: 12, d: 10, color: "#991b1b" },
    { name: "Gear Store", x: 16, z: -8, w: 12, d: 10, color: "#b91c1c" },
  ],
  bank: [
    { name: "Banking Hall", x: 0, z: 8, w: 20, d: 14, color: "#cbd5e1" },
    { name: "Vault", x: 0, z: -12, w: 12, d: 10, color: "#a16207" },
  ],
  shop: [{ name: "Shop Floor", x: 0, z: 0, w: 16, d: 14, color: "#134e4a" }],
  apartment: [
    { name: "Living Room", x: 0, z: 4, w: 12, d: 10, color: "#5b6470" },
    { name: "Bedroom", x: -10, z: -8, w: 10, d: 8, color: "#4b5563" },
    { name: "Storage", x: 10, z: -8, w: 8, d: 8, color: "#374151" },
  ],
};

export function buildInterior(id: string, originX: number): Interior {
  const rooms = INTERIOR_LAYOUTS[id] ?? INTERIOR_LAYOUTS.shop;
  const group = new THREE.Group();
  group.position.set(originX, 0, 0);
  const colliders: Collider[] = [];
  const boxes: BoxSpec[] = [];

  for (const r of rooms) {
    boxes.push({ x: r.x, y: 0.02, z: r.z, w: r.w, h: 0.08, d: r.d, color: r.color });
    boxes.push({ x: r.x, y: 3.6, z: r.z, w: r.w, h: 0.2, d: r.d, color: "#1b1f26" });
    // walls with a doorway gap on the +z side
    boxes.push({ x: r.x - r.w / 2, y: 1.8, z: r.z, w: 0.3, h: 3.6, d: r.d, color: "#2b313a" });
    boxes.push({ x: r.x + r.w / 2, y: 1.8, z: r.z, w: 0.3, h: 3.6, d: r.d, color: "#2b313a" });
    boxes.push({ x: r.x, y: 1.8, z: r.z - r.d / 2, w: r.w, h: 3.6, d: 0.3, color: "#2b313a" });
    boxes.push({ x: r.x - r.w / 4 - 0.75, y: 1.8, z: r.z + r.d / 2, w: r.w / 2 - 1.5, h: 3.6, d: 0.3, color: "#2b313a" });
    boxes.push({ x: r.x + r.w / 4 + 0.75, y: 1.8, z: r.z + r.d / 2, w: r.w / 2 - 1.5, h: 3.6, d: 0.3, color: "#2b313a" });
    // furniture
    boxes.push({ x: r.x - r.w / 4, y: 0.45, z: r.z - r.d / 4, w: 2.4, h: 0.85, d: 1.1, color: "#475569" });
    boxes.push({ x: r.x + r.w / 4, y: 0.9, z: r.z - r.d / 3, w: 1.2, h: 1.8, d: 0.6, color: "#3f4753" });

    for (const wall of [
      { x: r.x - r.w / 2, z: r.z, w: 0.3, d: r.d },
      { x: r.x + r.w / 2, z: r.z, w: 0.3, d: r.d },
      { x: r.x, z: r.z - r.d / 2, w: r.w, d: 0.3 },
    ]) {
      colliders.push({
        minX: originX + wall.x - wall.w / 2,
        maxX: originX + wall.x + wall.w / 2,
        minZ: wall.z - wall.d / 2,
        maxZ: wall.z + wall.d / 2,
        h: 3.6,
      });
    }
    const spr = labelSprite(r.name, "#dbeafe");
    spr.position.set(r.x, 3.0, r.z - r.d / 2 + 0.4);
    spr.scale.multiplyScalar(0.6);
    group.add(spr);
  }

  const mesh = new THREE.Mesh(
    mergeBoxes(boxes),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  );
  group.add(mesh);
  const amb = new THREE.PointLight(0xfff1d0, 1.4, 60, 1.4);
  amb.position.set(0, 3.2, 0);
  group.add(amb);
  const amb2 = new THREE.AmbientLight(0xaab6c6, 0.85);
  group.add(amb2);

  const exitMarker = createMarker("#f87171", 1.4);
  exitMarker.position.set(0, 0, 18);
  group.add(exitMarker);

  return {
    id,
    group,
    origin: new THREE.Vector3(originX, 0, 0),
    exit: { x: originX, z: 18 },
    rooms,
    colliders,
  };
}
