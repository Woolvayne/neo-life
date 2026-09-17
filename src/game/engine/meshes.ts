import * as THREE from "three";
import type { CharacterAppearance } from "@/game/core/types";
import type { VehicleModel } from "@/game/data/vehicles";

/* ------------------------------------------------------------------ */
/* geometry merging (keeps draw calls per chunk in single digits)      */
/* ------------------------------------------------------------------ */

export type BoxSpec = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: THREE.ColorRepresentation;
  rotY?: number;
};

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();

export function mergeBoxes(boxes: BoxSpec[]): THREE.BufferGeometry {
  const src = UNIT_BOX;
  const srcPos = src.getAttribute("position") as THREE.BufferAttribute;
  const srcNorm = src.getAttribute("normal") as THREE.BufferAttribute;
  const srcUv = src.getAttribute("uv") as THREE.BufferAttribute;
  const vcount = srcPos.count;
  const total = vcount * boxes.length;
  const pos = new Float32Array(total * 3);
  const norm = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);

  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  let o = 0;

  for (const b of boxes) {
    m.makeRotationY(b.rotY ?? 0);
    m.scale(new THREE.Vector3(b.w, b.h, b.d));
    m.setPosition(b.x, b.y, b.z);
    nm.getNormalMatrix(m);
    c.set(b.color);
    for (let i = 0; i < vcount; i++) {
      v.fromBufferAttribute(srcPos, i).applyMatrix4(m);
      n.fromBufferAttribute(srcNorm, i).applyMatrix3(nm).normalize();
      const p3 = (o + i) * 3;
      pos[p3] = v.x;
      pos[p3 + 1] = v.y;
      pos[p3 + 2] = v.z;
      norm[p3] = n.x;
      norm[p3 + 1] = n.y;
      norm[p3 + 2] = n.z;
      col[p3] = c.r;
      col[p3 + 1] = c.g;
      col[p3 + 2] = c.b;
      const p2 = (o + i) * 2;
      uv[p2] = srcUv.getX(i);
      uv[p2 + 1] = srcUv.getY(i);
    }
    o += vcount;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/* ------------------------------------------------------------------ */
/* procedural textures                                                 */
/* ------------------------------------------------------------------ */

let facadeTex: THREE.Texture | null = null;
export function facadeTexture(): THREE.Texture {
  if (facadeTex) return facadeTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 64);
  for (let y = 4; y < 64; y += 10) {
    for (let x = 4; x < 64; x += 10) {
      const lit = Math.random();
      g.fillStyle = lit > 0.75 ? "#cfd6de" : lit > 0.4 ? "#b9c2cc" : "#98a3b0";
      g.fillRect(x, y, 6, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.anisotropy = 2;
  facadeTex = t;
  return t;
}

let asphaltTex: THREE.Texture | null = null;
export function asphaltTexture(): THREE.Texture {
  if (asphaltTex) return asphaltTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 900; i++) {
    const v = 200 + Math.random() * 55;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * 64, Math.random() * 64, 1.4, 1.4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  asphaltTex = t;
  return t;
}

export function labelSprite(text: string, color = "#e8f0ff", bg = "rgba(9,12,18,0.72)") {
  const c = document.createElement("canvas");
  const pad = 16;
  const ctx = c.getContext("2d")!;
  ctx.font = "600 34px system-ui, sans-serif";
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  c.width = w;
  c.height = 60;
  const g = c.getContext("2d")!;
  g.font = "600 34px system-ui, sans-serif";
  g.fillStyle = bg;
  if (typeof g.roundRect === "function") {
    g.beginPath();
    g.roundRect(0, 0, w, 60, 12);
    g.fill();
  } else {
    g.fillRect(0, 0, w, 60);
  }
  g.fillStyle = color;
  g.textBaseline = "middle";
  g.fillText(text, pad, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }),
  );
  spr.scale.set((w / 60) * 1.7, 1.7, 1);
  return spr;
}

/* ------------------------------------------------------------------ */
/* characters — stylised citizens with layered clothing & full faces   */
/* ------------------------------------------------------------------ */

export type CharacterRig = {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Group;
  height: number;
};

export const HAIR_STYLE_COUNT = 6;

export function createCharacter(a: CharacterAppearance, scaleBoost = 1): CharacterRig {
  const root = new THREE.Group();
  const h = (0.86 + a.height * 0.3) * scaleBoost;
  const bw = 0.78 + a.build * 0.52;

  const skinM = new THREE.MeshStandardMaterial({ color: a.skin, roughness: 0.55, metalness: 0.02 });
  const shirtM = new THREE.MeshStandardMaterial({ color: a.shirt, roughness: 0.85, metalness: 0.02 });
  const jacketM = new THREE.MeshStandardMaterial({ color: a.jacket, roughness: 0.78, metalness: 0.04 });
  const pantsM = new THREE.MeshStandardMaterial({ color: a.pants, roughness: 0.9, metalness: 0.02 });
  const shoeM = new THREE.MeshStandardMaterial({ color: a.shoes, roughness: 0.45, metalness: 0.08 });
  const soleM = new THREE.MeshStandardMaterial({ color: "#14161c", roughness: 0.9 });
  const hairM = new THREE.MeshStandardMaterial({ color: a.hairColor, roughness: 0.6, metalness: 0.05 });
  const darkM = new THREE.MeshStandardMaterial({ color: "#14161c", roughness: 0.85 });
  const whiteM = new THREE.MeshStandardMaterial({ color: "#eef2f6", roughness: 0.3 });
  const irisM = new THREE.MeshStandardMaterial({ color: a.eyeColor, roughness: 0.25 });

  const mk = (
    w: number,
    hh: number,
    d: number,
    m: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    rz = 0,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rz;
    mesh.castShadow = true;
    return mesh;
  };

  const hipY = 0.72 * h;
  const shoulderY = 1.26 * h;

  /* ---------------------------------- torso ---------------------------------- */
  root.add(mk(0.42 * bw, 0.16 * h, 0.27 * bw, pantsM, 0, hipY + 0.075 * h));
  root.add(mk(0.43 * bw, 0.045 * h, 0.285 * bw, darkM, 0, hipY + 0.15 * h));
  root.add(mk(0.47 * bw, 0.5 * h, 0.29 * bw, jacketM, 0, hipY + 0.44 * h));
  root.add(mk(0.18 * bw, 0.46 * h, 0.02, shirtM, 0, hipY + 0.43 * h, 0.29 * bw * 0.5 + 0.004));
  root.add(mk(0.1 * bw, 0.2 * h, 0.02, jacketM, -0.13 * bw, hipY + 0.6 * h, 0.15 * bw + 0.01, -0.28));
  root.add(mk(0.1 * bw, 0.2 * h, 0.02, jacketM, 0.13 * bw, hipY + 0.6 * h, 0.15 * bw + 0.01, 0.28));
  root.add(mk(0.5 * bw, 0.07 * h, 0.31 * bw, jacketM, 0, shoulderY + 0.03 * h));
  root.add(mk(0.02, 0.46 * h, 0.012, darkM, 0.12 * bw, hipY + 0.42 * h, 0.29 * bw * 0.5 + 0.006));
  root.add(mk(0.13 * bw, 0.09 * h, 0.3 * bw, jacketM, -0.28 * bw, shoulderY + 0.015 * h));
  root.add(mk(0.13 * bw, 0.09 * h, 0.3 * bw, jacketM, 0.28 * bw, shoulderY + 0.015 * h));

  /* ---------------------------------- head ----------------------------------- */
  const head = new THREE.Group();
  const skullY = shoulderY + 0.14 * h;
  head.position.set(0, skullY, 0);

  head.add(mk(0.11, 0.1, 0.1, skinM, 0, -0.06, 0));
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.24), skinM);
  skull.position.y = 0.09;
  skull.castShadow = true;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.21), skinM);
  jaw.position.set(0, -0.045, 0.01);
  jaw.castShadow = true;
  head.add(skull, jaw);

  head.add(mk(0.03, 0.07, 0.05, skinM, -0.145, 0.06, 0.005));
  head.add(mk(0.03, 0.07, 0.05, skinM, 0.145, 0.06, 0.005));

  for (const s of [-1, 1]) {
    head.add(mk(0.075, 0.045, 0.012, whiteM, s * 0.062, 0.105, 0.115));
    head.add(mk(0.038, 0.042, 0.014, irisM, s * 0.062, 0.105, 0.12));
    const browAngle = a.face === 0 ? 0 : a.face === 1 ? -0.16 * s : a.face === 2 ? 0.12 * s : -0.08 * s;
    const browW = a.face === 2 ? 0.085 : 0.07;
    head.add(mk(browW, 0.018, 0.012, hairM, s * 0.062, 0.15, 0.118, browAngle));
  }
  head.add(mk(0.045, 0.07, 0.055, skinM, 0, 0.045, 0.12));
  head.add(mk(0.09, 0.018, 0.01, darkM, 0, -0.035, 0.105));
  if (a.face === 3) {
    head.add(mk(0.1, 0.05, 0.014, hairM, 0, -0.07, 0.105));
    head.add(mk(0.12, 0.02, 0.012, hairM, 0, -0.018, 0.108));
  }

  /* ------------------------------- hairstyles -------------------------------- */
  const style = a.hair % HAIR_STYLE_COUNT;
  if (style === 1) {
    head.add(mk(0.27, 0.05, 0.25, hairM, 0, 0.215));
  } else if (style === 2) {
    head.add(mk(0.28, 0.09, 0.26, hairM, 0, 0.225, -0.005));
    head.add(mk(0.26, 0.07, 0.05, hairM, -0.02, 0.17, 0.13, 0.06));
    head.add(mk(0.04, 0.09, 0.24, hairM, -0.145, 0.16, 0));
  } else if (style === 3) {
    head.add(mk(0.285, 0.11, 0.26, hairM, 0, 0.22, -0.005));
    head.add(mk(0.285, 0.14, 0.06, hairM, 0, 0.1, -0.135));
    head.add(mk(0.045, 0.13, 0.22, hairM, -0.145, 0.14, 0));
    head.add(mk(0.045, 0.13, 0.22, hairM, 0.145, 0.14, 0));
    head.add(mk(0.24, 0.05, 0.05, hairM, 0, 0.155, 0.13));
  } else if (style === 4) {
    head.add(mk(0.285, 0.1, 0.26, hairM, 0, 0.225, -0.005));
    head.add(mk(0.29, 0.34, 0.07, hairM, 0, -0.02, -0.14));
    head.add(mk(0.05, 0.3, 0.2, hairM, -0.15, 0.04, -0.01));
    head.add(mk(0.05, 0.3, 0.2, hairM, 0.15, 0.04, -0.01));
  } else if (style === 5) {
    head.add(mk(0.27, 0.06, 0.24, hairM, 0, 0.215));
    for (let i = -2; i <= 2; i++) {
      head.add(
        mk(0.04, 0.09, 0.06, hairM, i * 0.05, 0.26 + (i % 2 === 0 ? 0.02 : -0.005), -0.02 + i * 0.02, i * 0.12),
      );
    }
  }

  /* ---------------------------------- hats ----------------------------------- */
  if (a.hat === 1) {
    const capM = new THREE.MeshStandardMaterial({ color: a.jacket, roughness: 0.75 });
    head.add(mk(0.29, 0.1, 0.28, capM, 0, 0.225, -0.005));
    head.add(mk(0.24, 0.025, 0.16, capM, 0, 0.18, 0.19));
    head.add(mk(0.05, 0.025, 0.05, capM, 0, 0.285));
  } else if (a.hat === 2) {
    const helmM = new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.35, metalness: 0.15 });
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, 1.25), helmM);
    helm.position.y = 0.19;
    helm.castShadow = true;
    head.add(helm);
    head.add(mk(0.36, 0.025, 0.36, helmM, 0, 0.16, 0));
    head.add(mk(0.045, 0.05, 0.34, darkM, 0, 0.1, 0));
  } else if (a.hat === 3) {
    const beanieM = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.95 });
    head.add(mk(0.28, 0.13, 0.26, beanieM, 0, 0.235));
    head.add(mk(0.295, 0.045, 0.275, beanieM, 0, 0.175));
    head.add(mk(0.06, 0.05, 0.06, beanieM, 0, 0.32));
  }

  /* -------------------------------- accessories ------------------------------ */
  if (a.accessory === 1) {
    const glassM = new THREE.MeshStandardMaterial({ color: "#0b0d12", roughness: 0.2, metalness: 0.4 });
    head.add(mk(0.21, 0.045, 0.012, glassM, 0, 0.105, 0.126));
    head.add(mk(0.012, 0.012, 0.12, glassM, -0.1, 0.105, 0.06));
    head.add(mk(0.012, 0.012, 0.12, glassM, 0.1, 0.105, 0.06));
  } else if (a.accessory === 2) {
    const vestM = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.6, emissive: "#392e04" });
    const bandM = new THREE.MeshStandardMaterial({
      color: "#d9dee6",
      roughness: 0.2,
      metalness: 0.4,
      emissive: "#4a4f58",
    });
    root.add(mk(0.5 * bw, 0.42 * h, 0.31 * bw, vestM, 0, hipY + 0.4 * h));
    root.add(mk(0.505 * bw, 0.05 * h, 0.315 * bw, bandM, 0, hipY + 0.34 * h));
    root.add(mk(0.505 * bw, 0.05 * h, 0.315 * bw, bandM, 0, hipY + 0.48 * h));
  } else if (a.accessory === 3) {
    const packM = new THREE.MeshStandardMaterial({ color: "#3f3f46", roughness: 0.85 });
    root.add(mk(0.34 * bw, 0.34 * h, 0.14, packM, 0, hipY + 0.42 * h, -0.23 * bw));
    root.add(mk(0.05, 0.36 * h, 0.02, packM, -0.14 * bw, hipY + 0.42 * h, 0.15 * bw));
    root.add(mk(0.05, 0.36 * h, 0.02, packM, 0.14 * bw, hipY + 0.42 * h, 0.15 * bw));
  }
  root.add(head);

  /* ---------------------------------- limbs ---------------------------------- */
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.295 * bw, shoulderY + 0.02 * h, 0);
    g.add(mk(0.125 * bw, 0.3 * h, 0.13 * bw, jacketM, 0, -0.16 * h));
    g.add(mk(0.13 * bw, 0.05 * h, 0.135 * bw, shirtM, 0, -0.31 * h));
    g.add(mk(0.105 * bw, 0.22 * h, 0.105 * bw, skinM, 0, -0.43 * h));
    g.add(mk(0.1 * bw, 0.09 * h, 0.1 * bw, skinM, 0, -0.58 * h));
    return g;
  };

  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.115 * bw, hipY, 0);
    g.add(mk(0.155 * bw, 0.62 * h, 0.17 * bw, pantsM, 0, -0.34 * h));
    g.add(mk(0.16 * bw, 0.09 * h, 0.175 * bw, pantsM, side * 0.01, -0.32 * h, 0.002));
    g.add(mk(0.16 * bw, 0.05 * h, 0.175 * bw, darkM, 0, -0.66 * h));
    g.add(mk(0.17 * bw, 0.045 * h, 0.27 * bw, soleM, 0, -0.7 * h, 0.035));
    g.add(mk(0.16 * bw, 0.07 * h, 0.24 * bw, shoeM, 0, -0.65 * h, 0.04));
    return g;
  };

  const leftArm = mkArm(-1);
  const rightArm = mkArm(1);
  const leftLeg = mkLeg(-1);
  const rightLeg = mkLeg(1);
  root.add(leftArm, rightArm, leftLeg, rightLeg);

  return { root, leftArm, rightArm, leftLeg, rightLeg, head, height: 1.58 * h };
}

export function animateCharacter(rig: CharacterRig, speed: number, t: number, baseY = 0) {
  const amp = Math.min(1, speed / 5) * 0.85;
  const s = Math.sin(t * (6 + speed * 1.2));
  const c = Math.cos(t * (6 + speed * 1.2));
  rig.leftLeg.rotation.x = s * amp;
  rig.rightLeg.rotation.x = -s * amp;
  rig.leftArm.rotation.x = -s * amp * 0.75;
  rig.rightArm.rotation.x = s * amp * 0.75;
  if (amp < 0.05) {
    // idle breathing + slow ambient head movement
    rig.leftArm.rotation.x = c * 0.035;
    rig.rightArm.rotation.x = -c * 0.035;
    rig.head.rotation.y = Math.sin(t * 0.6) * 0.12;
  } else {
    rig.head.rotation.y = 0;
  }
  rig.root.position.y = baseY + Math.abs(s) * amp * 0.05;
}

/* ------------------------------------------------------------------ */
/* vehicles                                                            */
/* ------------------------------------------------------------------ */

export type VehicleRig = {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  headlights: THREE.Mesh;
  taillights: THREE.Mesh;
  beaconA?: THREE.Mesh;
  beaconB?: THREE.Mesh;
  spot?: THREE.SpotLight;
  length: number;
  width: number;
};

export function createVehicle(
  model: VehicleModel,
  color: string,
  opts: { wheels?: number; lightsEnabled?: boolean } = {},
): VehicleRig {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.55,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#111820",
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.8,
  });
  const trim = new THREE.MeshStandardMaterial({ color: "#15181d", roughness: 0.8 });

  const b = model.body;
  const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.l), paint);
  body.position.y = model.wheelR + b.h / 2;
  body.castShadow = true;
  root.add(body);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(model.cabin.w, model.cabin.h, model.cabin.l),
    glass,
  );
  cab.position.set(0, model.wheelR + model.cabin.y, model.cabin.z);
  root.add(cab);

  // bumpers / skirts
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.04, 0.16, b.l * 0.98), trim);
  skirt.position.y = model.wheelR * 0.85;
  root.add(skirt);

  // police / emergency livery stripes
  if (model.emergency === "police") {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.02, 0.22, b.l * 0.6),
      new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.4 }),
    );
    stripe.position.set(0, model.wheelR + b.h * 0.45, 0);
    root.add(stripe);
  } else if (model.emergency === "medical") {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.02, 0.3, b.l * 0.85),
      new THREE.MeshStandardMaterial({ color: "#16a34a", roughness: 0.4 }),
    );
    stripe.position.set(0, model.wheelR + b.h * 0.35, 0);
    root.add(stripe);
  }

  const wheelGeo = new THREE.CylinderGeometry(model.wheelR, model.wheelR, 0.25, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimColors = ["#1b1e24", "#9ca3af", "#d4af37", "#0ea5e9"];
  const wheelMat = new THREE.MeshStandardMaterial({
    color: rimColors[(opts.wheels ?? 0) % rimColors.length],
    roughness: 0.7,
    metalness: 0.4,
  });
  const wheels: THREE.Mesh[] = [];
  const wx = b.w / 2 - 0.05;
  const wz = b.l / 2 - model.wheelR - 0.15;
  const axles: [number, number][] =
    model.cls === "moto"
      ? [
          [0, wz],
          [0, -wz],
        ]
      : [
          [wx, wz],
          [-wx, wz],
          [wx, -wz],
          [-wx, -wz],
        ];
  if (model.body.l > 6.5) {
    axles.push([wx, -wz + 1.2], [-wx, -wz + 1.2]);
  }
  for (const [x, z] of axles) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, model.wheelR, z);
    w.castShadow = true;
    root.add(w);
    wheels.push(w);
  }

  const headlights = new THREE.Mesh(
    new THREE.BoxGeometry(b.w * 0.85, 0.14, 0.08),
    new THREE.MeshStandardMaterial({ color: "#fff7d6", emissive: "#000000" }),
  );
  headlights.position.set(0, model.wheelR + b.h * 0.4, b.l / 2 + 0.02);
  root.add(headlights);

  const taillights = new THREE.Mesh(
    new THREE.BoxGeometry(b.w * 0.85, 0.12, 0.07),
    new THREE.MeshStandardMaterial({ color: "#7f1d1d", emissive: "#000000" }),
  );
  taillights.position.set(0, model.wheelR + b.h * 0.4, -b.l / 2 - 0.02);
  root.add(taillights);

  let beaconA: THREE.Mesh | undefined;
  let beaconB: THREE.Mesh | undefined;
  if (model.emergency) {
    const barY = model.wheelR + model.cabin.y + model.cabin.h / 2 + 0.08;
    const colA =
      model.emergency === "police" ? "#2563eb" : model.emergency === "tow" ? "#f59e0b" : "#dc2626";
    const colB = model.emergency === "police" ? "#dc2626" : model.emergency === "tow" ? "#f59e0b" : "#f8fafc";
    beaconA = new THREE.Mesh(
      new THREE.BoxGeometry(model.cabin.w * 0.4, 0.12, 0.2),
      new THREE.MeshStandardMaterial({ color: colA, emissive: colA, emissiveIntensity: 0 }),
    );
    beaconA.position.set(-model.cabin.w * 0.25, barY, model.cabin.z);
    beaconB = new THREE.Mesh(
      new THREE.BoxGeometry(model.cabin.w * 0.4, 0.12, 0.2),
      new THREE.MeshStandardMaterial({ color: colB, emissive: colB, emissiveIntensity: 0 }),
    );
    beaconB.position.set(model.cabin.w * 0.25, barY, model.cabin.z);
    root.add(beaconA, beaconB);
  }

  let spot: THREE.SpotLight | undefined;
  if (opts.lightsEnabled) {
    spot = new THREE.SpotLight(0xfff3cf, 0, 60, 0.55, 0.5, 1.2);
    spot.position.set(0, model.wheelR + b.h * 0.6, b.l / 2);
    spot.target.position.set(0, -1, b.l / 2 + 18);
    root.add(spot, spot.target);
  }

  return { root, wheels, headlights, taillights, beaconA, beaconB, spot, length: b.l, width: b.w };
}

export function setEmissive(mesh: THREE.Mesh | undefined, hex: number, intensity: number) {
  if (!mesh) return;
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.emissive.setHex(hex);
  m.emissiveIntensity = intensity;
}

/* ------------------------------------------------------------------ */
/* world props                                                         */
/* ------------------------------------------------------------------ */

export function createMarker(color: string, radius = 1.5) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 2.4, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  cyl.position.y = 1.2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.75, radius, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(cyl, ring);
  return g;
}

export function createTree(rng: () => number) {
  const g = new THREE.Group();
  const h = 3.5 + rng() * 4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, h * 0.45, 6),
    new THREE.MeshStandardMaterial({ color: "#4a3421", roughness: 1 }),
  );
  trunk.position.y = h * 0.22;
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.3 + rng() * 0.9, h * 0.8, 7),
    new THREE.MeshStandardMaterial({ color: rng() > 0.5 ? "#2f6b34" : "#3d7a3a", roughness: 1 }),
  );
  crown.position.y = h * 0.62;
  crown.castShadow = true;
  g.add(trunk, crown);
  return g;
}
