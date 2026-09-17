"use client";

import * as THREE from "three";
import type { Engine, VehicleEntity } from "../Engine";
import {
  addMoney,
  addXp,
  grantAchievement,
  notify,
  playerStore,
  pushMessage,
  uiStore,
  updatePlayer,
} from "@/game/core/store";
import { CRIMES, WEAPON_MAP } from "@/game/data/catalog";
import { JOB_MAP, rankForXp, rankName } from "@/game/data/jobs";
import type { ActiveMission, DispatchCall, MissionStep } from "@/game/core/types";
import { createCharacter, CharacterRig, labelSprite } from "../meshes";
import { defaultCharacter } from "@/game/core/defaults";
import { audio } from "../audio";

type Remote = {
  id: number;
  username: string;
  x: number;
  z: number;
  heading: number;
  job: string;
  wanted: number;
  bot: boolean;
  tx: number;
  tz: number;
  rig: CharacterRig;
  label: THREE.Sprite;
  speed: number;
};

const BOT_NAMES = ["Lena_K", "Mikkel", "Aurora", "Jonas_92", "Ines", "Tobias", "Runa"];
const BOT_JOBS = ["police", "medical", "fire", "taxi", "trucker", "unemployed"];

/** /missions /crime /dispatch /multiplayer — the gameplay glue layer. */
export class GameplaySystem {
  engine: Engine;
  mission: ActiveMission | null = null;
  cooldowns: Record<string, number> = {};
  equipped = 0;
  ammo: Record<string, number> = {};
  private remoteList: Remote[] = [];
  private presenceTimer = 0;
  private dispatchTimer = 0;
  private eventTimer = 30;
  private markerMesh: THREE.Mesh | null = null;
  private holdContext: Record<string, unknown> = {};
  private treated = 0;
  private incidentProps: THREE.Group[] = [];

  constructor(engine: Engine) {
    this.engine = engine;
    this.spawnBots();
  }

  onMapChanged() {
    for (const r of this.remoteList) {
      this.engine.scene.add(r.rig.root);
      this.engine.scene.add(r.label);
    }
    if (this.markerMesh) this.engine.scene.add(this.markerMesh);
    void this.fetchDispatch();
  }

  /* ------------------------------------------------------------------ */
  /* simulated + real multiplayer                                        */
  /* ------------------------------------------------------------------ */

  private spawnBots() {
    for (let i = 0; i < 5; i++) {
      const name = BOT_NAMES[i % BOT_NAMES.length];
      const job = BOT_JOBS[i % BOT_JOBS.length];
      const appearance = { ...defaultCharacter(), style: job === "police" ? "police" : "casual" };
      const rig = createCharacter(appearance);
      // ambient bots skip the shadow pass — saves fill-rate in dense scenes
      rig.root.traverse((o) => {
        o.castShadow = false;
      });
      const label = labelSprite(`${name} · ${JOB_MAP[job]?.name ?? "Civilian"}`, "#bfdbfe");
      label.scale.multiplyScalar(0.55);
      const x = (Math.random() - 0.5) * 220;
      const z = (Math.random() - 0.5) * 220;
      rig.root.position.set(x, 0, z);
      label.position.set(x, 2.4, z);
      this.engine.scene.add(rig.root, label);
      this.remoteList.push({
        id: -1000 - i,
        username: name,
        x,
        z,
        heading: 0,
        job,
        wanted: 0,
        bot: true,
        tx: x,
        tz: z,
        rig,
        label,
        speed: 1.4 + Math.random(),
      });
    }
  }

  remotes() {
    return this.remoteList;
  }

  remoteCount() {
    return this.remoteList.length;
  }

  private async syncPresence() {
    const p = playerStore.get();
    if (!p || p.role === "guest" || p.accountId <= 0) return;
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: p.displayName || p.username,
          map: p.currentMap,
          x: this.engine.pos.x,
          z: this.engine.pos.z,
          heading: this.engine.yaw,
          job: p.job,
          wanted: p.wanted,
          inVehicle: this.engine.currentVehicle?.model.name ?? "",
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        players: { id: number; username: string; x: number; z: number; heading: number; job: string; wanted: number }[];
      };
      const seen = new Set<number>();
      for (const rp of data.players) {
        seen.add(rp.id);
        let r = this.remoteList.find((x) => x.id === rp.id);
        if (!r) {
          const rig = createCharacter({ ...defaultCharacter(), style: "casual" });
          rig.root.traverse((o) => {
            o.castShadow = false;
          });
          const label = labelSprite(`${rp.username}`, "#a7f3d0");
          label.scale.multiplyScalar(0.55);
          this.engine.scene.add(rig.root, label);
          r = {
            id: rp.id,
            username: rp.username,
            x: rp.x,
            z: rp.z,
            heading: rp.heading,
            job: rp.job,
            wanted: rp.wanted,
            bot: false,
            tx: rp.x,
            tz: rp.z,
            rig,
            label,
            speed: 0,
          };
          this.remoteList.push(r);
        }
        r.tx = rp.x;
        r.tz = rp.z;
        r.heading = rp.heading;
        r.job = rp.job;
        r.wanted = rp.wanted;
      }
      for (const r of [...this.remoteList]) {
        if (!r.bot && !seen.has(r.id)) {
          this.engine.scene.remove(r.rig.root, r.label);
          this.remoteList = this.remoteList.filter((x) => x !== r);
        }
      }
      uiStore.set({
        otherPlayers: this.remoteList.map((r) => ({
          id: r.id,
          username: r.bot ? `${r.username} (sim)` : r.username,
          x: r.x,
          z: r.z,
          job: r.job,
          wanted: r.wanted,
        })),
      });
    } catch {
      /* offline — simulated players continue */
    }
  }

  private updateRemotes(dt: number) {
    for (const r of this.remoteList) {
      if (r.bot) {
        const d = Math.hypot(r.tx - r.x, r.tz - r.z);
        if (d < 3) {
          const block = this.engine.map.block;
          r.tx = Math.round((this.engine.pos.x + (Math.random() - 0.5) * 260) / block) * block + 9;
          r.tz = this.engine.pos.z + (Math.random() - 0.5) * 260;
        }
        const ang = Math.atan2(r.tx - r.x, r.tz - r.z);
        r.heading = ang;
        r.x += Math.sin(ang) * r.speed * dt;
        r.z += Math.cos(ang) * r.speed * dt;
      } else {
        r.x += (r.tx - r.x) * Math.min(1, dt * 5);
        r.z += (r.tz - r.z) * Math.min(1, dt * 5);
      }
      r.rig.root.position.set(r.x, 0, r.z);
      r.rig.root.rotation.y = r.heading;
      r.label.position.set(r.x, 2.5, r.z);
      const dist = Math.hypot(r.x - this.engine.pos.x, r.z - this.engine.pos.z);
      const vis = dist < 150 && !this.engine.activeInterior;
      r.rig.root.visible = vis;
      r.label.visible = dist < 55 && !this.engine.activeInterior;
    }
  }

  /* ------------------------------------------------------------------ */
  /* dispatch                                                            */
  /* ------------------------------------------------------------------ */

  async fetchDispatch() {
    const p = playerStore.get();
    if (!p) return;
    try {
      const res = await fetch(`/api/world/events?map=${p.currentMap}`);
      if (!res.ok) return;
      const data = (await res.json()) as { events: DispatchCall[] };
      if (p.role === "guest" || p.accountId <= 0) {
        uiStore.set((s) => ({
          dispatch: [
            ...s.dispatch.filter((event) => event.id < 0 && event.status !== "cleared"),
            ...data.events,
          ].slice(0, 30),
        }));
      } else {
        uiStore.set({ dispatch: data.events });
      }
    } catch {
      /* keep local list */
    }
  }

  async postWorldEvent(ev: {
    type: string;
    title: string;
    description: string;
    priority: number;
    department: string;
    x: number;
    z: number;
  }) {
    const p = playerStore.get();
    if (!p) return;
    const addLocal = () => {
      const local: DispatchCall = {
        id: -Math.floor(1 + Math.random() * 1e6),
        map: p.currentMap,
        status: "open",
        assigned: [],
        createdAt: Date.now(),
        ...ev,
      };
      uiStore.set((s) => ({ dispatch: [local, ...s.dispatch].slice(0, 30) }));
    };
    if (p.role === "guest" || p.accountId <= 0) {
      addLocal();
      return;
    }
    try {
      const res = await fetch("/api/world/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...ev, map: p.currentMap }),
      });
      if (!res.ok) {
        addLocal();
        return;
      }
      const data = (await res.json()) as { event: DispatchCall };
      uiStore.set((s) => ({ dispatch: [data.event, ...s.dispatch].slice(0, 30) }));
    } catch {
      addLocal();
    }
  }

  async updateDispatch(id: number, status: string) {
    const p = playerStore.get();
    uiStore.set((s) => ({
      dispatch: s.dispatch.map((d) =>
        d.id === id ? { ...d, status, assigned: [...new Set([...d.assigned, p?.username ?? "unit"])] } : d,
      ),
    }));
    if (p && p.role !== "guest" && p.accountId > 0) {
      try {
        await fetch("/api/world/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "update", id, status, assigned: [p.username] }),
        });
      } catch {
        /* offline */
      }
    }
    if (status === "cleared") {
      const pay = 320 + Math.floor(Math.random() * 280);
      addMoney(pay, "Emergency callout", "bank");
      addXp(90, p?.job);
      updatePlayer((s) => ({ stats: { ...s.stats, callsCleared: s.stats.callsCleared + 1 } }));
      grantAchievement("a_responder", "Emergency Responder");
      notify("Call cleared", `+€${pay} · +90 XP`, "success");
      audio.success();
    }
  }

  private spawnRandomEvent() {
    const p = playerStore.get();
    if (!p) return;
    const types = [
      { type: "rtc", title: "Road traffic collision", dept: "police", desc: "Two vehicles, possible injuries, road partially blocked.", pri: 1 },
      { type: "fire", title: "Vehicle fire", dept: "fire", desc: "Car well alight on the carriageway.", pri: 1 },
      { type: "medical", title: "Medical emergency", dept: "medical", desc: "Collapsed person, bystanders performing first aid.", pri: 1 },
      { type: "building", title: "Building fire", dept: "fire", desc: "Smoke issuing from a residential block.", pri: 1 },
      { type: "alarm", title: "Intruder alarm", dept: "police", desc: "Activated alarm at a commercial premises.", pri: 2 },
      { type: "missing", title: "Missing person", dept: "police", desc: "Elderly resident missing from home.", pri: 3 },
      { type: "blockage", title: "Road blockage", dept: "public", desc: "Debris across both lanes.", pri: 3 },
      { type: "gas", title: "Suspected gas leak", dept: "fire", desc: "Strong smell of gas reported by residents.", pri: 2 },
      { type: "industrial", title: "Industrial accident", dept: "medical", desc: "Worker injured at a site.", pri: 1 },
    ];
    const t = types[Math.floor(Math.random() * types.length)];
    const block = this.engine.map.block;
    const x = Math.round((this.engine.pos.x + (Math.random() - 0.5) * 700) / block) * block + 8;
    const z = this.engine.pos.z + (Math.random() - 0.5) * 700;
    void this.postWorldEvent({
      type: t.type,
      title: t.title,
      description: t.desc,
      priority: t.pri,
      department: t.dept,
      x,
      z,
    });
    const job = JOB_MAP[p.job];
    if (job && (job.dept === t.dept || (t.dept === "public" && job.dept === "public"))) {
      pushMessage("Nova Dispatch", `${t.title} — respond when able.`);
      notify("Dispatch", t.title, "dispatch", 7000);
      audio.radio();
    }
  }

  /* ------------------------------------------------------------------ */
  /* missions                                                            */
  /* ------------------------------------------------------------------ */

  private randomRoadPoint(spread = 420) {
    const block = this.engine.map.block;
    const half = this.engine.map.half - block;
    const x = Math.max(-half, Math.min(half, Math.round((this.engine.pos.x + (Math.random() - 0.5) * spread) / block) * block + 9));
    const z = Math.max(-half, Math.min(half, this.engine.pos.z + (Math.random() - 0.5) * spread));
    return { x, z };
  }

  startJobMission(dispatchCall?: DispatchCall) {
    const p = playerStore.get();
    if (!p) return;
    const job = JOB_MAP[p.job];
    if (!job) {
      notify("No job selected", "Visit a job centre or use the phone", "warn");
      return;
    }
    if (this.mission) {
      notify("Mission already active", this.mission.title, "warn");
      return;
    }
    const steps: MissionStep[] = [];
    if (dispatchCall) {
      steps.push({ label: `Respond: ${dispatchCall.title}`, x: dispatchCall.x, z: dispatchCall.z, hold: 6 });
      steps.push({ label: "Return to station", x: this.nearestStation().x, z: this.nearestStation().z, hold: 0 });
    } else if (job.missionKind === "transport") {
      const a = this.randomRoadPoint(250);
      const b = this.randomRoadPoint(700);
      steps.push({ label: job.missionVerb, x: a.x, z: a.z, hold: 3 });
      steps.push({ label: "Drive to the destination", x: b.x, z: b.z, hold: 2 });
    } else if (job.missionKind === "service") {
      const a = this.randomRoadPoint(400);
      steps.push({ label: job.missionVerb, x: a.x, z: a.z, hold: 6 });
    } else {
      const a = this.randomRoadPoint(500);
      steps.push({ label: job.missionVerb, x: a.x, z: a.z, hold: 7 });
      steps.push({ label: "Return to station", x: this.nearestStation().x, z: this.nearestStation().z, hold: 0 });
    }
    const rank = p.jobRank;
    const mission: ActiveMission = {
      id: `m_${Date.now()}`,
      title: `${job.name} — ${dispatchCall ? dispatchCall.title : "Assignment"}`,
      job: job.id,
      steps,
      index: 0,
      progress: 0,
      pay: Math.round(job.basePay * (1 + rank * 0.25) * (0.85 + Math.random() * 0.5)),
      xp: 70 + rank * 15,
    };
    this.mission = mission;
    uiStore.set({ mission });
    this.updateMissionMarker();
    this.engine.setWaypoint(steps[0].x, steps[0].z);
    notify("Assignment received", steps[0].label, "info");
    audio.radio();
  }

  cancelMission() {
    this.mission = null;
    uiStore.set({ mission: null });
    this.engine.clearWaypoint();
    if (this.markerMesh) this.markerMesh.visible = false;
    notify("Assignment cancelled", "", "warn");
  }

  private nearestStation() {
    const p = playerStore.get();
    const job = p ? JOB_MAP[p.job] : null;
    const kind = job?.dept === "fire" ? "fire" : job?.dept === "medical" ? "hospital" : job?.dept === "police" ? "police" : "job";
    const markers = this.engine.world.markers.filter((m) => m.kind === kind);
    if (!markers.length) return { x: 0, z: 0 };
    let best = markers[0];
    let bd = Infinity;
    for (const m of markers) {
      const d = Math.hypot(m.x - this.engine.pos.x, m.z - this.engine.pos.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  private updateMissionMarker() {
    const step = this.mission?.steps[this.mission.index];
    if (!this.markerMesh) {
      const geo = new THREE.CylinderGeometry(2.4, 2.4, 40, 14, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: "#fbbf24",
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.markerMesh = new THREE.Mesh(geo, mat);
      this.engine.scene.add(this.markerMesh);
    }
    if (!step) {
      this.markerMesh.visible = false;
      return;
    }
    this.markerMesh.visible = true;
    this.markerMesh.position.set(step.x, 20, step.z);
  }

  nearbyPrompt(): { label: string; key: string } | null {
    const step = this.mission?.steps[this.mission.index];
    if (!step) return null;
    const d = Math.hypot(step.x - this.engine.pos.x, step.z - this.engine.pos.z);
    if (d > 9) return null;
    if (step.hold <= 0) return { label: `Press E — ${step.label}`, key: "mission" };
    return { label: `Hold E — ${step.label}`, key: "mission" };
  }

  activateMissionStep() {
    const m = this.mission;
    const step = m?.steps[m.index];
    if (!m || !step) return;
    if (step.hold > 0) {
      this.engine.beginHold("mission", step.hold, step.label);
    } else {
      this.completeHold("mission");
    }
  }

  /* ------------------------------------------------------------------ */
  /* crimes                                                              */
  /* ------------------------------------------------------------------ */

  startCrime(kind: string, ctx: Record<string, unknown> = {}) {
    const def = CRIMES[kind];
    const p = playerStore.get();
    if (!def || !p) return;
    const cd = this.cooldowns[kind] ?? 0;
    if (cd > 0) {
      notify("Too soon", `${def.name} available in ${Math.ceil(cd)}s`, "warn");
      return;
    }
    if (def.requires && !p.inventory.some((i) => i.id === def.requires)) {
      notify("Missing equipment", `${def.name} requires ${WEAPON_MAP[def.requires]?.name ?? def.requires}`, "warn");
      audio.error();
      return;
    }
    uiStore.set({ panel: null });
    this.holdContext = ctx;
    this.engine.beginHold(`crime_${kind}`, def.duration, def.name);
    notify(def.name, "Hold E — stay in position", "danger");
    this.engine.traffic.alarm(this.engine.pos.x, this.engine.pos.z, 50);
  }

  beginHotwire(v: VehicleEntity) {
    const p = playerStore.get();
    if (!p) return;
    if (v.model.job && p.job === v.model.job) {
      this.engine.enterVehicle(v);
      return;
    }
    this.holdContext = { vehicle: v };
    this.engine.beginHold("crime_carjack", CRIMES.carjack.duration, "Hotwiring vehicle");
    notify("Breaking in", "Hold E to force the lock", "danger");
  }

  completeHold(key: string) {
    const p = playerStore.get();
    if (!p) return;

    if (key === "mission") {
      const m = this.mission;
      if (!m) return;
      m.index += 1;
      if (m.index >= m.steps.length) {
        const job = JOB_MAP[m.job];
        addMoney(m.pay, `${job?.name ?? "Job"} payout`, "bank");
        addXp(m.xp, m.job);
        const newXp = (playerStore.get()?.jobXp[m.job] ?? 0);
        const newRank = rankForXp(m.job, newXp);
        if (newRank > p.jobRank && p.job === m.job) {
          updatePlayer(() => ({ jobRank: newRank }));
          notify("Promotion", `You are now ${rankName(m.job, newRank)}`, "success", 8000);
          if (m.job === "police" && newRank >= 3) grantAchievement("a_officer", "Master Officer");
        }
        updatePlayer((s) => ({ stats: { ...s.stats, jobsCompleted: s.stats.jobsCompleted + 1 } }));
        grantAchievement("a_firstjob", "First Job");
        if (m.job === "medical") {
          this.treated++;
          if (this.treated >= 5) grantAchievement("a_lifesaver", "Lifesaver");
        }
        notify("Assignment complete", `+€${m.pay} · +${m.xp} XP`, "success");
        audio.cash();
        this.mission = null;
        uiStore.set({ mission: null });
        this.engine.clearWaypoint();
        this.updateMissionMarker();
      } else {
        uiStore.set({ mission: { ...m } });
        const next = m.steps[m.index];
        this.engine.setWaypoint(next.x, next.z);
        this.updateMissionMarker();
        notify("Next objective", next.label, "info");
      }
      return;
    }

    if (key.startsWith("crime_")) {
      const kind = key.slice(6);
      const def = CRIMES[kind];
      if (!def) return;
      this.cooldowns[kind] = def.cooldown;
      if (kind === "carjack") {
        const v = this.holdContext.vehicle as VehicleEntity | undefined;
        if (v) {
          v.locked = false;
          v.stolen = true;
          this.engine.enterVehicle(v);
          this.engine.police.addCharge(v.model.emergency === "police" ? "policeveh" : "carjack");
          notify("Vehicle stolen", `${v.model.name} · ${v.plate} flagged as stolen`, "danger");
        }
        return;
      }
      const reward = Math.round(def.minReward + Math.random() * (def.maxReward - def.minReward));
      addMoney(reward, def.name, "cash");
      updatePlayer((s) => ({ stats: { ...s.stats, robberies: s.stats.robberies + 1 } }));
      const chargeKey =
        kind === "bank" ? "bank" : kind === "burglary" ? "burglary" : kind === "atm" ? "robbery" : this.hasWeapon() ? "armed" : "robbery";
      this.engine.police.addCharge(chargeKey);
      if (kind === "bank") grantAchievement("a_heist", "Vault Breaker");
      notify(`${def.name} complete`, `+€${reward} cash — get out of the area`, "danger", 7000);
      audio.cash();
      this.engine.traffic.scatter(this.engine.pos.x, this.engine.pos.z);
      return;
    }

    if (key === "refuel") {
      const v = this.engine.currentVehicle;
      if (!v) return;
      const litres = v.model.tank * (1 - v.fuel / 100);
      const cost = Math.round(litres * 1.85);
      if (p.money < cost) {
        notify("Not enough cash", `Refuel costs €${cost}`, "warn");
        return;
      }
      v.fuel = 100;
      this.engine.syncOwnedVehicleState(v);
      addMoney(-cost, "Fuel", "cash");
      notify("Tank full", `-€${cost}`, "success");
      audio.cash();
      return;
    }
  }

  hasWeapon() {
    const p = playerStore.get();
    return !!p?.inventory.some((i) => i.kind === "weapon");
  }

  refuel() {
    const v = this.engine.currentVehicle;
    if (!v) {
      notify("No vehicle", "Drive onto the forecourt first", "warn");
      return;
    }
    this.engine.beginHold("refuel", 3, "Refuelling");
  }

  /* ------------------------------------------------------------------ */
  /* weapons                                                             */
  /* ------------------------------------------------------------------ */

  weaponSlots() {
    const p = playerStore.get();
    return p ? p.inventory.filter((i) => i.kind === "weapon") : [];
  }

  selectSlot(i: number) {
    const slots = this.weaponSlots();
    if (i >= slots.length) {
      this.equipped = -1;
      notify("Holstered", "", "info", 1200);
      return;
    }
    this.equipped = i;
    notify("Equipped", slots[i].name, "info", 1600);
    audio.ui();
  }

  currentWeapon() {
    const slots = this.weaponSlots();
    if (this.equipped < 0 || this.equipped >= slots.length) return null;
    return slots[this.equipped];
  }

  reload() {
    const w = this.currentWeapon();
    if (!w) return;
    const def = WEAPON_MAP[w.id];
    if (!def) return;
    this.ammo[w.id] = def.magazine;
    notify("Reloaded", `${def.name} · ${def.magazine} rounds`, "info", 1600);
    audio.ui();
  }

  fire() {
    const p = playerStore.get();
    if (!p) return;
    const w = this.currentWeapon();
    if (!w) return;
    const def = WEAPON_MAP[w.id];
    if (!def) return;
    if (def.magazine > 0) {
      const left = this.ammo[w.id] ?? def.magazine;
      if (left <= 0) {
        notify("Empty", "Press R to reload", "warn", 1400);
        audio.error();
        return;
      }
      this.ammo[w.id] = left - 1;
    }
    audio.gunshot();
    this.engine.traffic.alarm(this.engine.pos.x, this.engine.pos.z, 60);
    const ped = this.engine.traffic.nearestPed(
      this.engine.pos.x + Math.sin(this.engine.yaw) * 4,
      this.engine.pos.z + Math.cos(this.engine.yaw) * 4,
      6,
    );
    if (def.id === "w_taser") {
      if (p.job === "police" && ped) {
        this.engine.police.arrestSuspect();
      } else if (p.job !== "police") {
        this.engine.police.addCharge("weapon");
      }
      return;
    }
    if (ped) {
      ped.panic = 8;
      this.engine.police.addCharge("assault");
      this.engine.labelAt("Civilian hit!", this.engine.pos.x, 3, this.engine.pos.z, 2);
    } else if (p.job !== "police") {
      this.engine.police.addCharge("weapon", true);
    }
  }

  /* ------------------------------------------------------------------ */
  /* loop                                                                */
  /* ------------------------------------------------------------------ */

  private incidentTargets: { x: number; z: number; dept: string }[] = [];
  private incidentTargetTimer = 0;

  private refreshIncidentTargets() {
    this.incidentTargets = uiStore
      .get()
      .dispatch.filter((d) => d.status !== "cleared")
      .map((d) => ({
        x: d.x,
        z: d.z,
        dept: d.department,
        dist: Math.hypot(d.x - this.engine.pos.x, d.z - this.engine.pos.z),
      }))
      .filter((x) => x.dist < 400)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 4)
      .map(({ x, z, dept }) => ({ x, z, dept }));
  }

  /** Visual props (flames / debris / casualty markers) for the closest open calls. */
  private updateIncidentProps(dt: number) {
    if (this.incidentProps.length === 0) {
      for (let i = 0; i < 4; i++) {
        const g = new THREE.Group();
        const core = new THREE.Mesh(
          new THREE.ConeGeometry(1.4, 3.2, 8),
          new THREE.MeshBasicMaterial({ color: "#f97316", transparent: true, opacity: 0.85 }),
        );
        core.position.y = 1.6;
        const glow = new THREE.PointLight(0xff8a3c, 0, 40, 1.6);
        glow.position.y = 3;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(3.2, 4, 20),
          new THREE.MeshBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        g.add(core, glow, ring);
        g.visible = false;
        this.engine.scene.add(g);
        this.incidentProps.push(g);
      }
    }
    this.incidentTargetTimer -= dt;
    if (this.incidentTargetTimer <= 0) {
      this.incidentTargetTimer = 1;
      this.refreshIncidentTargets();
    }

    this.incidentProps.forEach((g, i) => {
      const item = this.incidentTargets[i];
      if (!item || this.engine.activeInterior) {
        g.visible = false;
        return;
      }
      g.visible = true;
      g.position.set(item.x, 0, item.z);
      const flame = item.dept === "fire";
      const core = g.children[0] as THREE.Mesh;
      const light = g.children[1] as THREE.PointLight;
      const mat = core.material as THREE.MeshBasicMaterial;
      mat.color.set(flame ? "#f97316" : item.dept === "medical" ? "#22c55e" : "#3b82f6");
      light.color.set(mat.color);
      light.intensity = flame ? 40 + Math.sin(this.engine.clock.elapsedTime * 12) * 18 : 8;
      core.scale.setScalar(flame ? 1 + Math.sin(this.engine.clock.elapsedTime * 9 + i) * 0.18 : 1);
      g.rotation.y += dt * (flame ? 1.6 : 0.5);
    });
  }

  update(dt: number) {
    for (const k of Object.keys(this.cooldowns)) {
      this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
    this.updateRemotes(dt);
    this.updateIncidentProps(dt);

    this.presenceTimer -= dt;
    if (this.presenceTimer <= 0) {
      this.presenceTimer = 1.2;
      void this.syncPresence();
    }
    this.dispatchTimer -= dt;
    if (this.dispatchTimer <= 0) {
      this.dispatchTimer = 15;
      void this.fetchDispatch();
    }
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = 70 + Math.random() * 80;
      this.spawnRandomEvent();
    }

    // play-time stat
    const p = playerStore.get();
    if (p && Math.random() < dt * 0.2) {
      updatePlayer((s) => ({ stats: { ...s.stats, playTime: s.stats.playTime + 5 } }));
      if (p.bank >= 1000000) grantAchievement("a_millionaire", "Millionaire");
    }
  }

  dispose() {
    for (const r of this.remoteList) {
      this.engine.scene.remove(r.rig.root, r.label);
    }
    this.remoteList = [];
    for (const g of this.incidentProps) this.engine.scene.remove(g);
    this.incidentProps = [];
  }
}
