"use client";

import * as THREE from "three";
import type { Engine, VehicleEntity } from "../Engine";
import { CHARGES, WANTED_LABELS } from "@/game/data/catalog";
import {
  addMoney,
  notify,
  playerStore,
  pushMessage,
  uiStore,
  updatePlayer,
  grantAchievement,
} from "@/game/core/store";
import { audio } from "../audio";

type Unit = {
  ent: VehicleEntity;
  state: "responding" | "pursuing" | "arriving" | "idle";
  spawnedAt: number;
};

/** /police + /wanted — dynamic response, pursuit, arrest and decay. */
export class PoliceSystem {
  engine: Engine;
  units: Unit[] = [];
  pursuitActive = false;
  arrested = false;
  jailTimer = 0;
  pendingCharges: string[] = [];
  private escapeTimer = 0;
  private arrestProgress = 0;
  private lastAlertAt = 0;
  private searchCenter = new THREE.Vector3();
  private decayTimer = 0;
  private speedTimer = 0;
  private _scratch2 = new THREE.Vector3();
  private _scratch3 = new THREE.Vector3();

  constructor(engine: Engine) {
    this.engine = engine;
  }

  get wanted() {
    return playerStore.get()?.wanted ?? 0;
  }

  /** Register a crime → raises the wanted level and alerts police units. */
  addCharge(key: string, silent = false) {
    const charge = CHARGES[key];
    if (!charge) return;
    const p = playerStore.get();
    if (!p) return;
    const next = Math.min(5, p.wanted + charge.points);
    this.pendingCharges.push(key);
    updatePlayer((s) => ({
      wanted: next,
      crimeHistory: [{ t: Date.now(), crime: charge.label, points: charge.points }, ...s.crimeHistory].slice(0, 40),
      stats: { ...s.stats, crimes: s.stats.crimes + 1 },
    }));
    this.searchCenter.copy(this.engine.pos);
    this.escapeTimer = 0;
    if (!silent) {
      notify(`Wanted ${next}★ — ${WANTED_LABELS[next]}`, charge.label, "danger", 5200);
      audio.radio();
      if (Date.now() - this.lastAlertAt > 12000) {
        this.lastAlertAt = Date.now();
        pushMessage(
          "Nova Dispatch",
          `All units: ${charge.label} reported near ${Math.round(this.engine.pos.x)}, ${Math.round(this.engine.pos.z)}.`,
        );
        void this.engine.gameplay.postWorldEvent({
          type: "crime",
          title: charge.label,
          description: `Suspect reported in the area. Wanted level ${next}.`,
          priority: next >= 4 ? 1 : 2,
          department: "police",
          x: this.engine.pos.x,
          z: this.engine.pos.z,
        });
      }
    }
  }

  clearWanted(reason: string) {
    updatePlayer(() => ({ wanted: 0 }));
    this.pendingCharges = [];
    this.pursuitActive = false;
    this.despawnAll();
    notify("Wanted status cleared", reason, "success");
  }

  private spawnUnit() {
    const e = this.engine;
    const ang = Math.random() * Math.PI * 2;
    const dist = 110 + Math.random() * 60;
    const x = e.pos.x + Math.cos(ang) * dist;
    const z = e.pos.z + Math.sin(ang) * dist;
    const model = this.wanted >= 4 && Math.random() > 0.5 ? "swatvan" : Math.random() > 0.5 ? "patrol" : "interceptor";
    const ent = e.spawnVehicle(model, x, z, { locked: true, ai: true });
    ent.siren = true;
    ent.lights = true;
    this.units.push({ ent, state: "pursuing", spawnedAt: Date.now() });
    if (this.units.length === 1) audio.sirenOn();
  }

  private despawnAll() {
    for (const u of this.units) this.engine.despawnVehicle(u.ent);
    this.units = [];
    audio.sirenOff();
    this.arrestProgress = 0;
  }

  surrender() {
    if (!this.wanted || this.arrested) return;
    const near = this.units.find(
      (u) => Math.hypot(u.ent.pos.x - this.engine.pos.x, u.ent.pos.z - this.engine.pos.z) < 60,
    );
    if (!near) {
      notify("No officers nearby", "Find a unit to surrender to", "warn");
      return;
    }
    notify("Surrendering", "Hands up — stay still", "info");
    this.arrestProgress = 2.2;
  }

  private doArrest() {
    if (this.arrested) return;
    const p = playerStore.get();
    if (!p) return;
    this.arrested = true;
    this.pursuitActive = false;
    const charges = [...new Set(this.pendingCharges)];
    const fine = charges.reduce((a, c) => a + (CHARGES[c]?.fine ?? 200), 200);
    const jail = Math.max(20, Math.min(180, p.wanted * 26 + charges.length * 6));
    this.jailTimer = jail;
    this.despawnAll();
    if (this.engine.currentVehicle) this.engine.exitVehicle();

    const station = this.engine.world.markers.find((m) => m.kind === "police");
    if (station) this.engine.teleport(station.x, station.z + 26);

    const payFromBank = Math.min(p.bank, fine);
    addMoney(-payFromBank, "Court fine", "bank");
    if (payFromBank < fine) addMoney(-(fine - payFromBank), "Court fine", "cash");
    updatePlayer((s) => ({
      wanted: 0,
      stats: { ...s.stats, timesArrested: s.stats.timesArrested + 1 },
    }));
    grantAchievement("a_cuffed", "Processed");
    uiStore.set({
      panel: "arrest",
      panelData: {
        charges: charges.map((c) => CHARGES[c]?.label ?? c),
        fine,
        jail,
      },
    });
    audio.error();
    this.pendingCharges = [];
  }

  release() {
    this.arrested = false;
    this.jailTimer = 0;
    uiStore.set({ panel: null, panelData: null });
    const station = this.engine.world.markers.find((m) => m.kind === "police");
    if (station) this.engine.teleport(station.x + 18, station.z + 30);
    notify("Released", "You are free to go. Stay out of trouble.", "info");
  }

  update(dt: number) {
    const e = this.engine;
    const p = playerStore.get();
    if (!p) return;

    if (this.arrested) {
      this.jailTimer -= dt;
      if (this.jailTimer <= 0) this.release();
      return;
    }

    const wanted = p.wanted;
    this.pursuitActive = wanted > 0 && this.units.length > 0;

    // speeding / reckless detection near police
    this.speedTimer -= dt;
    const v = e.currentVehicle;
    if (v && this.speedTimer <= 0) {
      const kmh = Math.abs(v.speed) * 3.6;
      const cop = this.units.length > 0;
      const nearStation = e.world.markers.some(
        (m) => m.kind === "police" && Math.hypot(m.x - e.pos.x, m.z - e.pos.z) < 90,
      );
      if (kmh > 130 && (cop || nearStation || Math.random() < 0.25) && p.job !== "police") {
        this.speedTimer = 25;
        this.addCharge(kmh > 180 ? "reckless" : "speeding");
      }
    }

    if (wanted <= 0) {
      if (this.units.length) this.despawnAll();
      return;
    }

    // spawn response units
    const desired = Math.min(6, wanted + (wanted >= 4 ? 1 : 0));
    if (this.units.length < desired && Math.random() < dt * 0.9) this.spawnUnit();

    let closest = Infinity;
    for (const u of this.units) {
      const ent = u.ent;
      const dx = e.pos.x - ent.pos.x;
      const dz = e.pos.z - ent.pos.z;
      const dist = Math.hypot(dx, dz);
      closest = Math.min(closest, dist);

      // steer toward the player (with basic obstacle nudging)
      const desiredYaw = Math.atan2(dx, dz);
      let diff = ((desiredYaw - ent.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const probe = this._scratch2.set(
        ent.pos.x + Math.sin(ent.yaw) * 6,
        0,
        ent.pos.z + Math.cos(ent.yaw) * 6,
      );
      const blocked = e.resolveCircle(probe, 2.4);
      if (blocked) diff += 0.9;
      ent.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 2.2 * dt * 2));

      const targetSpeed = dist > 16 ? Math.min(ent.model.topSpeed * 0.8, 12 + dist * 0.22) : dist > 8 ? 5 : 0;
      ent.speed += (targetSpeed - ent.speed) * Math.min(1, dt * 1.6);
      const next = this._scratch3.set(
        ent.pos.x + Math.sin(ent.yaw) * ent.speed * dt,
        0,
        ent.pos.z + Math.cos(ent.yaw) * ent.speed * dt,
      );
      if (e.resolveCircle(next, 2.2)) ent.speed *= 0.55;
      ent.pos.copy(next);
      ent.rig.root.position.copy(ent.pos);
      ent.rig.root.rotation.y = ent.yaw;

      // flashing beacons
      const flash = Math.floor(e.clock.elapsedTime * 7) % 2 === 0;
      if (ent.rig.beaconA) {
        const ma = ent.rig.beaconA.material as THREE.MeshStandardMaterial;
        ma.emissiveIntensity = flash ? 3.5 : 0;
      }
      if (ent.rig.beaconB) {
        const mb = ent.rig.beaconB.material as THREE.MeshStandardMaterial;
        mb.emissiveIntensity = flash ? 0 : 3.5;
      }

      if (Date.now() - u.spawnedAt > 240000) {
        this.engine.despawnVehicle(ent);
        this.units = this.units.filter((x) => x !== u);
      }
    }

    // arrest logic
    const playerSpeed = e.currentVehicle ? Math.abs(e.currentVehicle.speed) : e.onFootSpeed;
    if (closest < 11 && playerSpeed < 2.2) {
      this.arrestProgress += dt;
      if (this.arrestProgress > 1 && Math.random() < dt * 2)
        notify("Police", "Stop! You are under arrest.", "danger", 1600);
      if (this.arrestProgress >= 3) this.doArrest();
    } else {
      this.arrestProgress = Math.max(0, this.arrestProgress - dt * 0.6);
      if (closest < 40 && playerSpeed > 8 && Math.random() < dt * 0.05) this.addCharge("evading", true);
    }

    // escape / decay
    if (closest > 150) {
      this.escapeTimer += dt;
      if (this.escapeTimer > 22) {
        this.escapeTimer = 0;
        const nw = Math.max(0, wanted - 1);
        updatePlayer(() => ({ wanted: nw }));
        if (nw === 0) {
          this.despawnAll();
          notify("You lost the police", "Wanted status cleared", "success");
          if (wanted >= 3) grantAchievement("a_escape", "Escape Artist");
        } else {
          notify("Search narrowing", `Wanted reduced to ${nw}★`, "info");
        }
      }
    } else {
      this.escapeTimer = Math.max(0, this.escapeTimer - dt * 0.5);
    }

    this.decayTimer += dt;
    if (this.decayTimer > 60) {
      this.decayTimer = 0;
      if (this.units.length === 0 && wanted > 0) updatePlayer(() => ({ wanted: Math.max(0, wanted - 1) }));
    }
  }

  /** Player (as an officer) arresting an NPC suspect. */
  arrestSuspect() {
    const p = playerStore.get();
    if (!p || p.job !== "police") {
      notify("Not authorised", "Only sworn officers can make arrests", "warn");
      return;
    }
    const ped = this.engine.traffic.nearestPed(this.engine.pos.x, this.engine.pos.z, 6);
    if (!ped) {
      notify("No suspect nearby", "Get closer to the suspect", "warn");
      return;
    }
    ped.panic = 0;
    const pay = 240 + Math.round(Math.random() * 260);
    addMoney(pay, "Arrest bonus", "bank");
    updatePlayer((s) => ({ stats: { ...s.stats, arrests: s.stats.arrests + 1 } }));
    notify("Suspect detained", `Transport to custody · +€${pay}`, "success");
    audio.success();
  }

  dispose() {
    this.despawnAll();
  }
}
