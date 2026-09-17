"use client";

import { useEffect, useState } from "react";
import { useHud, usePlayer, useUi, money } from "@/game/core/hooks";
import {
  addMoney,
  addXp,
  flushSave,
  grantAchievement,
  notify,
  uiStore,
  updatePlayer,
} from "@/game/core/store";
import { Button, Modal, Row, Tag, Bar, Field, Input } from "./ui/Kit";
import { JOBS, JOB_MAP, rankName } from "@/game/data/jobs";
import { VEHICLES, VEHICLE_MAP, PAINTS, plateGen } from "@/game/data/vehicles";
import { CRIMES, SHOP_ITEMS, WEAPONS, WEAPON_MAP, CHARGES, ACHIEVEMENTS } from "@/game/data/catalog";
import { Engine } from "@/game/engine/Engine";
import { CLOTH_COLORS, STYLE_PRESETS } from "@/game/core/defaults";
import type { OwnedVehicle, WorldMarker } from "@/game/core/types";
import { MAP_BY_ID } from "@/game/world/maps";

const close = () => uiStore.set({ panel: null, panelData: null });

/* ------------------------------------------------------------------ */

function ShopPanel() {
  const player = usePlayer();
  const ui = useUi();
  const e = Engine.instance;
  const marker = (ui.panelData?.marker ?? null) as WorldMarker | null;
  if (!player) return null;
  const isJewelry = marker?.kind === "jewelry";

  return (
    <Modal
      title={marker?.label ?? "Store"}
      subtitle={isJewelry ? "High value goods — heavily insured" : "Convenience goods & supplies"}
      icon={isJewelry ? "💎" : "🏪"}
      onClose={close}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Buy</h3>
          {SHOP_ITEMS.map((item) => (
            <Row
              key={item.id}
              title={item.name}
              subtitle={item.effect}
              right={<span className="text-emerald-300">{money(item.price)}</span>}
              onClick={() => {
                if (player.money < item.price) return notify("Not enough cash", "Visit an ATM", "warn");
                addMoney(-item.price, item.name, "cash");
                updatePlayer((s) => {
                  const inv = [...s.inventory];
                  const found = inv.find((i) => i.id === item.id);
                  if (found) found.qty += 1;
                  else inv.push({ id: item.id, name: item.name, kind: item.kind, qty: 1 });
                  return { inventory: inv };
                });
                notify("Purchased", item.name, "success");
              }}
            />
          ))}
        </div>
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Your inventory</h3>
          {player.inventory.length === 0 ? (
            <p className="text-xs text-slate-500">Empty.</p>
          ) : (
            player.inventory.map((i) => (
              <Row
                key={i.id}
                title={`${i.name} ×${i.qty}`}
                subtitle={i.kind}
                right={i.kind === "consumable" ? <span className="text-sky-300">Use</span> : null}
                onClick={
                  i.kind === "consumable"
                    ? () => {
                        if (!e) return;
                        if (i.id === "i_armor") e.armor = 100;
                        else if (i.id === "i_medkit") e.health = Math.min(100, e.health + 70);
                        else if (i.id === "i_coffee") e.stamina = 100;
                        else e.health = Math.min(100, e.health + 20);
                        updatePlayer((s) => ({
                          inventory: s.inventory
                            .map((x) => (x.id === i.id ? { ...x, qty: x.qty - 1 } : x))
                            .filter((x) => x.qty > 0),
                        }));
                        notify("Used", i.name, "success");
                      }
                    : undefined
                }
              />
            ))
          )}

          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/5 p-3">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-300">Criminal options</div>
            <p className="mt-1 text-[11px] text-slate-400">
              {isJewelry ? CRIMES.jewelry.desc : CRIMES.store.desc} Police will be alerted.
            </p>
            <Button
              variant="danger"
              className="mt-2"
              full
              onClick={() => e?.gameplay.startCrime(isJewelry ? "jewelry" : "store")}
            >
              {isJewelry ? "Smash displays (Hold E)" : "Rob the register (Hold E)"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AtmPanel() {
  const player = usePlayer();
  const e = Engine.instance;
  const [amt, setAmt] = useState(200);
  if (!player) return null;
  return (
    <Modal title="NovaBank ATM" subtitle="Cash machine" icon="🏧" onClose={close}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Available balance</div>
            <div className="text-3xl font-black text-white">{money(player.bank)}</div>
            <div className="text-xs text-slate-400">Cash on hand {money(player.money)}</div>
          </div>
          <div className="flex gap-2">
            {[50, 200, 500, 2000].map((v) => (
              <Button key={v} variant={amt === v ? "primary" : "ghost"} onClick={() => setAmt(v)}>
                {v}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                if (player.bank < amt) return notify("Insufficient funds", "", "warn");
                addMoney(-amt, "ATM withdrawal", "bank");
                addMoney(amt, "ATM withdrawal", "cash");
                notify("Cash dispensed", money(amt), "success");
              }}
            >
              Withdraw
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (player.money < amt) return notify("Not enough cash", "", "warn");
                addMoney(-amt, "ATM deposit", "cash");
                addMoney(amt, "ATM deposit", "bank");
                notify("Deposited", money(amt), "success");
              }}
            >
              Deposit
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent transactions</h3>
          {player.transactions.slice(0, 10).map((t, i) => (
            <div key={i} className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs">
              <span className="text-slate-300">{t.label}</span>
              <span className={t.amount >= 0 ? "text-emerald-300" : "text-rose-300"}>{money(t.amount)}</span>
            </div>
          ))}
          <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/5 p-3">
            <div className="text-xs font-bold text-rose-300">Tamper with the cash cassette</div>
            <p className="text-[11px] text-slate-400">Requires a crowbar. Silent alarm will trigger.</p>
            <Button variant="danger" full className="mt-2" onClick={() => e?.gameplay.startCrime("atm")}>
              Force ATM (Hold E)
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function BankPanel() {
  const player = usePlayer();
  const e = Engine.instance;
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState(500);
  const ui = useUi();
  if (!player) return null;
  return (
    <Modal title="NovaBank Central" subtitle="Banking hall" icon="🏦" onClose={close}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-800/10 p-4">
            <div className="text-[10px] uppercase tracking-wider text-amber-200">Current account</div>
            <div className="text-3xl font-black text-white">{money(player.bank)}</div>
          </div>
          <Field label="Transfer to player">
            <Input value={to} onChange={(ev) => setTo(ev.target.value)} placeholder="username" />
          </Field>
          <Field label="Amount">
            <Input type="number" value={amt} onChange={(ev) => setAmt(Number(ev.target.value))} />
          </Field>
          <Button
            full
            onClick={() => {
              if (!to) return notify("Enter a recipient", "", "warn");
              if (player.bank < amt) return notify("Insufficient funds", "", "warn");
              addMoney(-amt, `Transfer → ${to}`, "bank");
              notify("Transfer complete", `${money(amt)} sent to ${to}`, "success");
            }}
          >
            Send transfer
          </Button>
          <div className="text-[11px] text-slate-500">
            {ui.otherPlayers.length} players currently connected to this shard.
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Vault</h3>
          <p className="text-xs text-slate-400">
            The vault holds the district cash reserve. Robbing it requires a vault drill and triggers a critical
            police response.
          </p>
          <Button variant="danger" full onClick={() => e?.gameplay.startCrime("bank")}>
            Drill the vault (Hold E)
          </Button>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-slate-400">
            Reward {money(CRIMES.bank.minReward)} – {money(CRIMES.bank.maxReward)} · Wanted +5 · Cooldown 15 min
          </div>
        </div>
      </div>
    </Modal>
  );
}

function JobsPanel() {
  const player = usePlayer();
  const e = Engine.instance;
  const [dept, setDept] = useState("all");
  if (!player) return null;
  const list = JOBS.filter((j) => dept === "all" || j.dept === dept);
  return (
    <Modal title="Employment Centre" subtitle="Sign on, get equipment, start assignments" icon="💼" wide onClose={close}>
      <div className="mb-3 flex flex-wrap gap-1">
        {[
          ["all", "All"],
          ["civil", "Civilian"],
          ["public", "Public service"],
          ["police", "Police"],
          ["fire", "Fire"],
          ["medical", "Medical"],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setDept(k)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase ${
              dept === k ? "border-sky-400/60 bg-sky-500/20 text-sky-200" : "border-white/10 text-slate-400"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((job) => {
          const active = player.job === job.id;
          const xp = player.jobXp[job.id] ?? 0;
          return (
            <div
              key={job.id}
              className={`rounded-xl border p-3 ${active ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{job.icon}</span>
                    <span className="text-sm font-bold text-slate-100">{job.name}</span>
                    {active ? <Tag tone="green">Active</Tag> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{job.desc}</p>
                </div>
                <span className="text-xs font-bold text-emerald-300">{money(job.basePay)}/job</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-400">
                {job.ranks.map((r, i) => (
                  <span
                    key={r}
                    className={`rounded border px-1.5 py-0.5 ${
                      active && player.jobRank === i ? "border-sky-400/60 text-sky-200" : "border-white/10"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                Vehicles: {job.vehicles.map((v) => VEHICLE_MAP[v]?.name ?? v).join(", ") || "—"} · Tools:{" "}
                {job.tools.join(", ")}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  variant={active ? "ghost" : "primary"}
                  onClick={() => {
                    if (active) {
                      updatePlayer(() => ({ job: "unemployed", jobRank: 0 }));
                      notify("Resigned", `You left the ${job.name} role`, "info");
                      return;
                    }
                    const preset = STYLE_PRESETS[job.style] ?? STYLE_PRESETS.casual;
                    updatePlayer((s) => ({
                      job: job.id,
                      jobRank: Math.min(job.ranks.length - 1, Math.floor(xp / 600)),
                      character: {
                        ...s.character,
                        style: job.style,
                        shirt: preset.shirt,
                        jacket: preset.jacket,
                        pants: preset.pants,
                        shoes: preset.shoes,
                      },
                      inventory:
                        job.dept === "police"
                          ? [
                              ...s.inventory.filter((i) => i.id !== "w_taser" && i.id !== "w_cuffs" && i.id !== "w_baton"),
                              { id: "w_taser", name: "Arc-7 Taser", kind: "weapon" as const, qty: 1 },
                              { id: "w_cuffs", name: "Handcuffs", kind: "tool" as const, qty: 1 },
                              { id: "w_baton", name: "Service Baton", kind: "weapon" as const, qty: 1 },
                            ]
                          : s.inventory,
                    }));
                    const eng = Engine.instance;
                    if (eng) eng.rebuildCharacter({ ...player.character, style: job.style, shirt: preset.shirt, jacket: preset.jacket, pants: preset.pants, shoes: preset.shoes });
                    notify("Hired", `${job.name} — report for duty`, "success");
                    addXp(25, job.id);
                  }}
                >
                  {active ? "Resign" : "Accept job"}
                </Button>
                {active ? (
                  <Button
                    onClick={() => {
                      e?.gameplay.startJobMission();
                      close();
                    }}
                  >
                    Start assignment
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function DealershipPanel() {
  const player = usePlayer();
  const e = Engine.instance;
  const [sel, setSel] = useState(VEHICLES.filter((v) => v.price > 0)[0].id);
  const [color, setColor] = useState(PAINTS[3]);
  const [wheels, setWheels] = useState(0);
  const [perf, setPerf] = useState(0);
  if (!player) return null;
  const model = VEHICLE_MAP[sel];
  const perfCost = perf * 4500;
  const total = model.price + perfCost;

  return (
    <Modal title="Vantra Auto Centre" subtitle="New vehicles & customisation" icon="🚗" wide onClose={close}>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
          {VEHICLES.filter((v) => v.price > 0).map((v) => (
            <Row
              key={v.id}
              title={v.name}
              subtitle={`${v.brand} · ${v.cls}`}
              right={<span className="text-emerald-300">{money(v.price)}</span>}
              active={sel === v.id}
              onClick={() => setSel(v.id)}
            />
          ))}
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {model.brand} {model.name}
                </h3>
                <p className="text-xs text-slate-400">{model.desc}</p>
              </div>
              <div
                className="h-10 w-16 rounded-lg border border-white/20"
                style={{ background: color }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-400">Top speed</div>
                <Bar value={model.topSpeed + perf * 4} max={75} color="bg-sky-400" />
              </div>
              <div>
                <div className="text-slate-400">Acceleration</div>
                <Bar value={model.accel + perf * 1.2} max={18} color="bg-emerald-400" />
              </div>
              <div>
                <div className="text-slate-400">Handling</div>
                <Bar value={model.handling + perf * 0.2} max={4} color="bg-violet-400" />
              </div>
              <div>
                <div className="text-slate-400">Seats / tank</div>
                <div className="font-bold text-slate-200">
                  {model.seats} · {model.tank}L
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Paint</div>
            <div className="flex flex-wrap gap-2">
              {PAINTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  className={`h-7 w-7 rounded-lg border-2 ${color === c ? "border-sky-400" : "border-white/15"}`}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Wheels</div>
              <div className="flex gap-1">
                {["Standard", "Sport", "Gold", "Cyan"].map((w, i) => (
                  <Button key={w} variant={wheels === i ? "primary" : "ghost"} onClick={() => setWheels(i)}>
                    {w}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Performance stage ({money(perfCost)})
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((p) => (
                  <Button key={p} variant={perf === p ? "primary" : "ghost"} onClick={() => setPerf(p)}>
                    {p === 0 ? "Stock" : `S${p}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div>
              <div className="text-[11px] text-slate-400">Total price</div>
              <div className="text-xl font-black text-white">{money(total)}</div>
            </div>
            <Button
              onClick={() => {
                if (player.bank < total) return notify("Insufficient funds", "Use your bank account", "warn");
                const veh: OwnedVehicle = {
                  uid: `own_${Date.now().toString(36)}`,
                  modelId: model.id,
                  plate: plateGen(),
                  color,
                  wheels,
                  performance: perf,
                  fuel: 100,
                  condition: 100,
                  stored: false,
                  garage: "Kronen Parking Garage",
                  siren: false,
                };
                addMoney(-total, `${model.name} purchase`, "bank");
                updatePlayer((s) => ({ vehicles: [...s.vehicles, veh] }));
                grantAchievement("a_firstcar", "First Vehicle");
                e?.spawnVehicle(model.id, e.pos.x + 6, e.pos.z + 4, {
                  uid: veh.uid,
                  color,
                  owned: true,
                  wheels,
                  plate: veh.plate,
                });
                notify("Vehicle purchased", `${model.name} delivered outside · ${veh.plate}`, "success");
                close();
              }}
            >
              Buy & deliver
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function GaragePanel() {
  const player = usePlayer();
  const e = Engine.instance;
  if (!player) return null;
  const job = JOB_MAP[player.job];
  const deptVehicles = job ? job.vehicles : [];
  return (
    <Modal title="Vehicle Garage" subtitle="Your fleet & department pool" icon="🅿️" wide onClose={close}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Owned vehicles</h3>
          {player.vehicles.length === 0 ? (
            <p className="text-xs text-slate-500">No vehicles yet — visit the dealership.</p>
          ) : (
            player.vehicles.map((v) => {
              const m = VEHICLE_MAP[v.modelId];
              return (
                <div key={v.uid} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-100">{m?.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {v.plate} · {v.stored ? "Stored" : "On the street"}
                      </div>
                    </div>
                    <div className="h-6 w-10 rounded border border-white/20" style={{ background: v.color }} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-400">Fuel</span>
                      <Bar value={v.fuel} color="bg-amber-400" />
                    </div>
                    <div>
                      <span className="text-slate-400">Condition</span>
                      <Bar value={v.condition} color="bg-emerald-400" />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button variant="ghost" onClick={() => e?.spawnOwnedVehicle(v.uid)}>
                      Spawn
                    </Button>
                    <Button variant="ghost" onClick={() => e?.storeVehicle(v.uid)}>
                      Store
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const cost = Math.round((100 - v.condition) * 9 + (100 - v.fuel) * 2);
                        if (cost <= 0) return notify("No work needed", "Vehicle is in perfect condition", "info");
                        if (player.bank < cost) return notify("Insufficient funds", money(cost), "warn");
                        addMoney(-cost, "Garage service", "bank");
                        updatePlayer((s) => ({
                          vehicles: s.vehicles.map((o) => (o.uid === v.uid ? { ...o, condition: 100, fuel: 100 } : o)),
                        }));
                        const live = e?.vehicles.find((x) => x.uid === v.uid);
                        if (live) {
                          live.condition = 100;
                          live.fuel = 100;
                        }
                        notify("Serviced", `Repaired & refuelled for ${money(cost)}`, "success");
                      }}
                    >
                      Repair & refuel
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const paints = PAINTS;
                        const next = paints[(paints.indexOf(v.color) + 1) % paints.length];
                        if (player.bank < 450) return notify("Insufficient funds", "Respray costs €450", "warn");
                        addMoney(-450, "Respray", "bank");
                        updatePlayer((s) => ({
                          vehicles: s.vehicles.map((o) => (o.uid === v.uid ? { ...o, color: next } : o)),
                        }));
                        notify("Resprayed", "New paint applied — respawn to see it", "success");
                      }}
                    >
                      Respray €450
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        const value = Math.round((VEHICLE_MAP[v.modelId]?.price ?? 0) * 0.62);
                        addMoney(value, `Sold ${m?.name}`, "bank");
                        updatePlayer((s) => ({ vehicles: s.vehicles.filter((o) => o.uid !== v.uid) }));
                        const live = e?.vehicles.find((x) => x.uid === v.uid);
                        if (live) e?.despawnVehicle(live);
                        notify("Vehicle sold", money(value), "success");
                      }}
                    >
                      Sell
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Department pool {job ? `· ${job.name}` : ""}
          </h3>
          {deptVehicles.length === 0 ? (
            <p className="text-xs text-slate-500">Take a job to access department vehicles.</p>
          ) : (
            deptVehicles.map((id) => {
              const m = VEHICLE_MAP[id];
              const rankLocked = id === "swatvan" && player.jobRank < 4;
              return (
                <Row
                  key={id}
                  title={m?.name ?? id}
                  subtitle={rankLocked ? "Requires Lieutenant" : m?.desc}
                  right={<Tag tone={rankLocked ? "red" : "blue"}>{rankLocked ? "Locked" : "Take out"}</Tag>}
                  onClick={() => {
                    if (rankLocked) return notify("Rank too low", "Lieutenant required", "warn");
                    if (!e) return;
                    e.spawnVehicle(id, e.pos.x + 6, e.pos.z + 5, { yaw: e.yaw });
                    notify("Vehicle signed out", m?.name ?? id, "success");
                    close();
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

function PropertyPanel() {
  const player = usePlayer();
  const ui = useUi();
  const e = Engine.instance;
  const marker = (ui.panelData?.marker ?? null) as WorldMarker | null;
  if (!player || !marker) return null;
  const price = Number((marker.data as { price?: number })?.price ?? 100000);
  const owned = player.properties.find((p) => p.id === marker.id);
  return (
    <Modal title={marker.label} subtitle={owned ? "Your property" : "For sale"} icon="🏠" onClose={close}>
      <div className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Asking price</div>
          <div className="text-3xl font-black text-white">{money(price)}</div>
          <div className="text-xs text-slate-400">
            Rent option {money(Math.round(price * 0.004))}/day · Includes garage space and storage
          </div>
        </div>
        {owned ? (
          <>
            <Button full onClick={() => e?.enterInterior("apartment", owned.name)}>
              Enter property
            </Button>
            <Button
              full
              variant="ghost"
              onClick={() => {
                updatePlayer((s) => ({
                  properties: s.properties.map((p) => ({ ...p, isSpawn: p.id === owned.id })),
                }));
                notify("Spawn point set", owned.name, "success");
              }}
            >
              Set as spawn point
            </Button>
            <Button
              full
              variant="danger"
              onClick={() => {
                addMoney(Math.round(price * 0.8), `Sold ${owned.name}`, "bank");
                updatePlayer((s) => ({ properties: s.properties.filter((p) => p.id !== owned.id) }));
                notify("Property sold", money(Math.round(price * 0.8)), "success");
                close();
              }}
            >
              Sell for {money(Math.round(price * 0.8))}
            </Button>
          </>
        ) : (
          <>
            <Button
              full
              onClick={() => {
                if (player.bank < price) return notify("Insufficient funds", "Not enough in the bank", "warn");
                addMoney(-price, `Bought ${marker.label}`, "bank");
                updatePlayer((s) => ({
                  properties: [
                    ...s.properties,
                    {
                      id: marker.id,
                      name: marker.label,
                      kind: String((marker.data as { name?: string })?.name ?? "Apartment"),
                      map: s.currentMap,
                      x: marker.x,
                      z: marker.z,
                      price,
                      storage: [],
                      isSpawn: s.properties.length === 0,
                    },
                  ],
                }));
                grantAchievement("a_firstproperty", "Keys to the City");
                notify("Property purchased", marker.label, "success");
              }}
            >
              Buy property
            </Button>
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-3">
              <div className="text-xs font-bold text-rose-300">Break in</div>
              <p className="text-[11px] text-slate-400">{CRIMES.burglary.desc} Requires a crowbar.</p>
              <Button variant="danger" full className="mt-2" onClick={() => e?.gameplay.startCrime("burglary")}>
                Force the door (Hold E)
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function ClothingPanel() {
  const player = usePlayer();
  const e = Engine.instance;
  if (!player) return null;
  const set = (patch: Partial<typeof player.character>) => {
    const next = { ...player.character, ...patch };
    updatePlayer(() => ({ character: next }));
    e?.rebuildCharacter(next);
  };
  return (
    <Modal title="Fadenwerk Clothing" subtitle="Outfits & uniforms — €120 per change" icon="👕" onClose={close}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(STYLE_PRESETS).map(([k, p]) => (
            <button
              key={k}
              onClick={() => {
                if (player.money < 120) return notify("Not enough cash", "€120 required", "warn");
                addMoney(-120, `Outfit: ${p.label}`, "cash");
                set({ style: k, shirt: p.shirt, jacket: p.jacket, pants: p.pants, shoes: p.shoes });
                notify("Outfit changed", p.label, "success");
              }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.08]"
            >
              <div className="mb-2 flex gap-1">
                {[p.shirt, p.jacket, p.pants, p.shoes].map((c, i) => (
                  <span key={i} className="h-5 w-5 rounded" style={{ background: c }} />
                ))}
              </div>
              <div className="text-sm font-bold text-slate-100">{p.label}</div>
            </button>
          ))}
        </div>
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Custom shirt colour (€40)</div>
          <div className="flex flex-wrap gap-2">
            {CLOTH_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  if (player.money < 40) return notify("Not enough cash", "", "warn");
                  addMoney(-40, "Shirt colour", "cash");
                  set({ shirt: c });
                }}
                style={{ background: c }}
                className="h-7 w-7 rounded-lg border-2 border-white/15 hover:border-sky-400"
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function WeaponPanel() {
  const player = usePlayer();
  if (!player) return null;
  const isPolice = player.job === "police";
  return (
    <Modal title="Falkner Sport & Defence" subtitle="Fictional equipment — gameplay items only" icon="🛡️" wide onClose={close}>
      <div className="grid gap-2 md:grid-cols-2">
        {WEAPONS.map((w) => {
          const owned = player.inventory.some((i) => i.id === w.id);
          const restricted = w.restricted === "police" && !isPolice;
          return (
            <div key={w.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-100">{w.name}</div>
                  <div className="text-[11px] text-slate-400">{w.desc}</div>
                </div>
                <Tag tone={restricted ? "red" : owned ? "green" : "blue"}>
                  {restricted ? "Restricted" : owned ? "Owned" : money(w.price)}
                </Tag>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                <div>
                  DMG
                  <Bar value={w.damage} max={60} color="bg-rose-400" />
                </div>
                <div>
                  RANGE
                  <Bar value={w.range} max={100} color="bg-sky-400" />
                </div>
                <div>
                  RATE
                  <Bar value={w.fireRate} max={12} color="bg-amber-400" />
                </div>
              </div>
              <Button
                className="mt-2"
                full
                variant={owned ? "ghost" : "primary"}
                disabled={restricted}
                onClick={() => {
                  if (owned) {
                    updatePlayer((s) => ({ inventory: s.inventory.filter((i) => i.id !== w.id) }));
                    notify("Sold", w.name, "info");
                    addMoney(Math.round(w.price * 0.5), `Sold ${w.name}`, "cash");
                    return;
                  }
                  if (player.money < w.price) return notify("Not enough cash", money(w.price), "warn");
                  addMoney(-w.price, w.name, "cash");
                  updatePlayer((s) => ({
                    inventory: [
                      ...s.inventory,
                      {
                        id: w.id,
                        name: w.name,
                        kind: w.category === "tool" ? ("tool" as const) : ("weapon" as const),
                        qty: 1,
                        ammo: w.magazine,
                      },
                    ],
                  }));
                  notify("Purchased", `${w.name} — select with number keys`, "success");
                }}
              >
                {owned ? "Sell back" : restricted ? "Police only" : "Buy"}
              </Button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function MdtPanel() {
  const player = usePlayer();
  const ui = useUi();
  const e = Engine.instance;
  const [tab, setTab] = useState<"calls" | "lookup" | "records">("calls");
  const [query, setQuery] = useState("");
  if (!player) return null;
  const isPolice = player.job === "police";
  return (
    <Modal
      title="Police MDT"
      subtitle={isPolice ? `${rankName("police", player.jobRank)} ${player.displayName}` : "Read-only civilian access"}
      icon="🚓"
      wide
      onClose={close}
    >
      <div className="mb-3 flex gap-1">
        {(["calls", "lookup", "records"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md border px-3 py-1 text-[11px] font-bold uppercase ${
              tab === t ? "border-sky-400/60 bg-sky-500/20 text-sky-200" : "border-white/10 text-slate-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "calls" && (
        <div className="space-y-2">
          {ui.dispatch.length === 0 ? (
            <p className="text-xs text-slate-500">No active calls on this channel.</p>
          ) : (
            ui.dispatch.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag tone={d.priority === 1 ? "red" : d.priority === 2 ? "amber" : "slate"}>P{d.priority}</Tag>
                    <span className="text-sm font-bold text-slate-100">{d.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(d.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{d.description}</div>
                <div className="text-[10px] text-slate-500">
                  Location {Math.round(d.x)}, {Math.round(d.z)} · {d.department} · {d.status}
                  {d.assigned.length ? ` · units: ${d.assigned.join(", ")}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button variant="ghost" onClick={() => e?.setWaypoint(d.x, d.z)}>
                    GPS
                  </Button>
                  <Button variant="ghost" onClick={() => void e?.gameplay.updateDispatch(d.id, "en route")}>
                    En route
                  </Button>
                  <Button variant="ghost" onClick={() => void e?.gameplay.updateDispatch(d.id, "on scene")}>
                    Arrived
                  </Button>
                  <Button variant="success" onClick={() => void e?.gameplay.updateDispatch(d.id, "cleared")}>
                    Clear call
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "lookup" && (
        <div className="space-y-3">
          <Input value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Search plate, player or vehicle…" />
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Players online</h4>
            {ui.otherPlayers
              .filter((p) => !query || p.username.toLowerCase().includes(query.toLowerCase()))
              .map((p) => (
                <Row
                  key={p.id}
                  title={p.username}
                  subtitle={`${JOB_MAP[p.job]?.name ?? "Civilian"} · ${Math.round(p.x)}, ${Math.round(p.z)}`}
                  right={<Tag tone={p.wanted > 0 ? "red" : "green"}>{p.wanted > 0 ? `${p.wanted}★` : "Clear"}</Tag>}
                  onClick={() => e?.setWaypoint(p.x, p.z)}
                />
              ))}
            <h4 className="pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Vehicle registry</h4>
            {(e?.vehicles ?? [])
              .filter((v) => !v.ai && (!query || v.plate.toLowerCase().includes(query.toLowerCase())))
              .slice(0, 12)
              .map((v) => (
                <Row
                  key={v.uid}
                  title={`${v.plate} — ${v.model.name}`}
                  subtitle={`${v.owned ? "Registered to you" : "Unknown keeper"} · ${v.stolen ? "REPORTED STOLEN" : "No markers"}`}
                  right={<Tag tone={v.stolen ? "red" : "slate"}>{v.stolen ? "Stolen" : "Clean"}</Tag>}
                  onClick={() => e?.setWaypoint(v.pos.x, v.pos.z)}
                />
              ))}
          </div>
        </div>
      )}

      {tab === "records" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs font-bold text-slate-100">
              Your record — wanted level {player.wanted}★
            </div>
            {player.crimeHistory.length === 0 ? (
              <p className="text-[11px] text-slate-500">No offences recorded.</p>
            ) : (
              player.crimeHistory.slice(0, 12).map((c, i) => (
                <div key={i} className="flex justify-between text-[11px] text-slate-400">
                  <span>{c.crime}</span>
                  <span>
                    +{c.points}★ · {new Date(c.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
          {isPolice ? (
            <div className="grid gap-2 md:grid-cols-2">
              <Button onClick={() => e?.police.arrestSuspect()}>Arrest nearest suspect</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const fine = 250;
                  addMoney(fine, "Traffic citation issued", "bank");
                  addXp(30, "police");
                  notify("Citation issued", `${money(fine)} processed`, "success");
                }}
              >
                Issue traffic citation
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  notify("Roadblock deployed", "Units advised of closure", "info");
                  void e?.gameplay.postWorldEvent({
                    type: "roadblock",
                    title: "Roadblock in place",
                    description: "Officers have closed the carriageway.",
                    priority: 3,
                    department: "police",
                    x: e.pos.x,
                    z: e.pos.z,
                  });
                }}
              >
                Deploy roadblock
              </Button>
              <Button variant="ghost" onClick={() => e?.gameplay.startJobMission()}>
                Request patrol assignment
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Only sworn officers can use enforcement tools.</p>
          )}
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Penal code</div>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400">
              {Object.values(CHARGES).map((c) => (
                <div key={c.label} className="flex justify-between">
                  <span>{c.label}</span>
                  <span className="text-slate-500">
                    +{c.points}★ / {money(c.fine)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TravelPanel() {
  const ui = useUi();
  const player = usePlayer();
  const e = Engine.instance;
  const to = String(ui.panelData?.to ?? "novacity");
  const mode = String(ui.panelData?.mode ?? "Highway");
  const price = Number(ui.panelData?.price ?? 0);
  const target = MAP_BY_ID[to];
  if (!player || !target) return null;
  return (
    <Modal title={`${mode} to ${target.name}`} subtitle={target.tagline} icon="🧭" onClose={close}>
      <div className="space-y-3">
        <p className="text-sm text-slate-300">{target.desc}</p>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
          Ticket price {price > 0 ? money(price) : "Free (drive across)"} · Your vehicles stay in their garage.
        </div>
        <Button
          full
          onClick={() => {
            if (price > 0 && player.money < price) return notify("Not enough cash", money(price), "warn");
            if (price > 0) addMoney(-price, `${mode} ticket`, "cash");
            void e?.travelTo(to);
          }}
        >
          Travel now
        </Button>
      </div>
    </Modal>
  );
}

function SettingsPanel() {
  const player = usePlayer();
  const e = Engine.instance;
  const [tab, setTab] = useState<"graphics" | "audio" | "gameplay" | "access" | "account">("graphics");
  if (!player) return null;
  const s = player.settings;
  const upd = (patch: Partial<typeof s>) => updatePlayer((p) => ({ settings: { ...p.settings, ...patch } }));
  return (
    <Modal title="Settings" icon="⚙️" wide onClose={close}>
      <div className="mb-3 flex flex-wrap gap-1">
        {(["graphics", "audio", "gameplay", "access", "account"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md border px-3 py-1 text-[11px] font-bold uppercase ${
              tab === t ? "border-sky-400/60 bg-sky-500/20 text-sky-200" : "border-white/10 text-slate-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {tab === "graphics" && (
          <>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((q) => (
                <Button
                  key={q}
                  variant={s.quality === q ? "primary" : "ghost"}
                  onClick={() => {
                    upd({
                      quality: q,
                      shadows: q !== "low",
                      viewDistance: q === "low" ? 260 : q === "medium" ? 420 : 620,
                    });
                    e?.refreshQuality();
                  }}
                >
                  {q}
                </Button>
              ))}
            </div>
            <label className="flex items-center justify-between text-sm">
              Shadows
              <input
                type="checkbox"
                checked={s.shadows}
                onChange={(ev) => {
                  upd({ shadows: ev.target.checked });
                  e?.refreshQuality();
                }}
                className="h-4 w-4 accent-sky-500"
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              Weather & particle effects
              <input type="checkbox" checked={s.effects} onChange={(ev) => upd({ effects: ev.target.checked })} className="h-4 w-4 accent-sky-500" />
            </label>
            <div>
              <div className="mb-1 text-xs text-slate-400">View distance: {s.viewDistance} m</div>
              <input
                type="range"
                min={160}
                max={900}
                value={s.viewDistance}
                onChange={(ev) => upd({ viewDistance: Number(ev.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>
          </>
        )}
        {tab === "audio" &&
          (
            [
              ["master", "Master volume"],
              ["sfx", "Effects"],
              ["ambient", "Ambience & music beds"],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <div className="mb-1 text-xs text-slate-400">
                {label}: {Math.round((s[k] as number) * 100)}%
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={s[k] as number}
                onChange={(ev) => {
                  const v = Number(ev.target.value);
                  upd({ [k]: v } as Partial<typeof s>);
                  const ns = { ...s, [k]: v };
                  import("@/game/engine/audio").then(({ audio }) => audio.setVolumes(ns.master, ns.sfx, ns.ambient));
                }}
                className="w-full accent-sky-500"
              />
            </div>
          ))}
        {tab === "gameplay" && (
          <>
            <div>
              <div className="mb-1 text-xs text-slate-400">Mouse / driving sensitivity: {Math.round(s.sensitivity * 100)}%</div>
              <input type="range" min={0.05} max={1} step={0.01} value={s.sensitivity} onChange={(ev) => upd({ sensitivity: Number(ev.target.value) })} className="w-full accent-sky-500" />
            </div>
            <label className="flex items-center justify-between text-sm">
              Invert camera Y
              <input type="checkbox" checked={s.invertY} onChange={(ev) => upd({ invertY: ev.target.checked })} className="h-4 w-4 accent-sky-500" />
            </label>
            <label className="flex items-center justify-between text-sm">
              Show HUD
              <input type="checkbox" checked={s.hud} onChange={(ev) => upd({ hud: ev.target.checked })} className="h-4 w-4 accent-sky-500" />
            </label>
            <label className="flex items-center justify-between text-sm">
              Show minimap
              <input type="checkbox" checked={s.minimap} onChange={(ev) => upd({ minimap: ev.target.checked })} className="h-4 w-4 accent-sky-500" />
            </label>
          </>
        )}
        {tab === "access" && (
          <>
            <div>
              <div className="mb-1 text-xs text-slate-400">UI scale: {Math.round(s.uiScale * 100)}%</div>
              <input type="range" min={0.8} max={1.4} step={0.05} value={s.uiScale} onChange={(ev) => upd({ uiScale: Number(ev.target.value) })} className="w-full accent-sky-500" />
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">Text size: {Math.round(s.textSize * 100)}%</div>
              <input type="range" min={0.85} max={1.35} step={0.05} value={s.textSize} onChange={(ev) => upd({ textSize: Number(ev.target.value) })} className="w-full accent-sky-500" />
            </div>
            <label className="flex items-center justify-between text-sm">
              Reduced effects (motion / flashing)
              <input type="checkbox" checked={s.reducedEffects} onChange={(ev) => upd({ reducedEffects: ev.target.checked })} className="h-4 w-4 accent-sky-500" />
            </label>
          </>
        )}
        {tab === "account" && (
          <div className="space-y-3">
            <Field label="Display name">
              <Input
                defaultValue={player.displayName}
                onBlur={(ev) => {
                  const v = ev.target.value.trim();
                  if (v) {
                    updatePlayer(() => ({ displayName: v }));
                    notify("Display name updated", v, "success");
                  }
                }}
              />
            </Field>
            <div className="text-xs text-slate-400">Username: {player.username}</div>
            <div className="text-xs text-slate-400">
              Profile: {player.role === "guest" ? "Local guest — no account required" : player.role}
            </div>
            <div className="text-xs text-slate-400">
              Playing since {new Date(player.createdAt).toLocaleDateString()}
            </div>
            <Button variant="ghost" full onClick={() => void flushSave()}>
              {player.role === "guest" ? "Save locally now" : "Save to server now"}
            </Button>
            <Button
              variant="danger"
              full
              onClick={async () => {
                await flushSave();
                if (player.role !== "guest") {
                  await fetch("/api/auth/logout", { method: "POST" });
                }
                window.location.href = "/play";
              }}
            >
              {player.role === "guest" ? "Exit guest mode" : "Log out"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AdminPanel() {
  const player = usePlayer();
  const e = Engine.instance;
  const [data, setData] = useState<{
    players: { id: number; username: string; role: string; money: number | null; bank: number | null; level: number | null; job: string | null }[];
    online: { id: number; username: string; map: string }[];
    logs: { id: number; kind: string; actor: string; message: string }[];
  } | null>(null);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<number>(0);
  const [amount, setAmount] = useState(10000);

  useEffect(() => {
    void fetch(`/api/admin?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d));
  }, [q]);

  if (!player) return null;
  if (player.role !== "admin")
    return (
      <Modal title="Administration" icon="🛡️" onClose={close}>
        <p className="text-sm text-slate-400">
          Your account does not hold administrator permissions. The first account registered on this server is
          granted the admin role.
        </p>
      </Modal>
    );

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, targetId: target, ...extra }),
    });
    notify("Admin action", action, "success");
    const r = await fetch(`/api/admin?q=${encodeURIComponent(q)}`);
    if (r.ok) setData(await r.json());
  };

  return (
    <Modal title="Server Administration" subtitle="Permission level: Administrator" icon="🛡️" wide onClose={close}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Search players…" />
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {data?.players.map((p) => (
              <Row
                key={p.id}
                title={`${p.username} ${p.role === "admin" ? "· admin" : ""}`}
                subtitle={`LV ${p.level ?? 1} · ${p.job ?? "unemployed"} · ${money(p.bank ?? 0)}`}
                active={target === p.id}
                onClick={() => setTarget(p.id)}
              />
            ))}
          </div>
          <div className="text-[11px] text-slate-400">Online now: {data?.online.map((o) => o.username).join(", ") || "—"}</div>
        </div>
        <div className="space-y-2">
          <Input type="number" value={amount} onChange={(ev) => setAmount(Number(ev.target.value))} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => void act("giveMoney", { amount })}>
              Give money
            </Button>
            <Button variant="ghost" onClick={() => void act("giveXp", { amount })}>
              Give XP
            </Button>
            <Button variant="ghost" onClick={() => void act("clearWanted")}>
              Clear wanted
            </Button>
            <Button variant="ghost" onClick={() => void act("setJob", { job: "police", rank: 6 })}>
              Make commander
            </Button>
            <Button variant="ghost" onClick={() => void act("setRole", { role: "admin" })}>
              Grant admin
            </Button>
            <Button variant="ghost" onClick={() => void act("setRole", { role: "banned" })}>
              Ban account
            </Button>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">World control</div>
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" onClick={() => e?.setTimeOfDay(8)}>
                Morning
              </Button>
              <Button variant="ghost" onClick={() => e?.setTimeOfDay(13)}>
                Midday
              </Button>
              <Button variant="ghost" onClick={() => e?.setTimeOfDay(19)}>
                Dusk
              </Button>
              <Button variant="ghost" onClick={() => e?.setTimeOfDay(1)}>
                Night
              </Button>
              {(["Clear", "Cloudy", "Rain", "Heavy Rain", "Fog"] as const).map((w) => (
                <Button key={w} variant="ghost" onClick={() => e?.setWeather(w)}>
                  {w}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!e) return;
                  e.teleport(0, 0);
                  notify("Teleported", "City centre", "info");
                }}
              >
                Teleport to centre
              </Button>
              <Button variant="ghost" onClick={() => e?.spawnVehicle("interceptor", e.pos.x + 5, e.pos.z + 4, {})}>
                Spawn interceptor
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  updatePlayer((s) => ({ inventory: [...s.inventory, { id: "w_drill", name: "Vault Drill", kind: "tool", qty: 1 }] }));
                  notify("Item granted", "Vault Drill", "success");
                }}
              >
                Spawn vault drill
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  void act("announce", { message: "Server announcement: welcome to NovaCity!" })
                }
              >
                Broadcast announcement
              </Button>
            </div>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-slate-400">
            {data?.logs.map((l) => (
              <div key={l.id}>
                <span className="text-sky-300">{l.actor}</span> · {l.kind} · {l.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ArrestPanel() {
  const ui = useUi();
  const hud = useHud();
  const e = Engine.instance;
  const charges = (ui.panelData?.charges as string[]) ?? [];
  const fine = Number(ui.panelData?.fine ?? 0);
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
      <div className="nc-panel nc-in w-[min(520px,92vw)] rounded-2xl p-6 text-center">
        <div className="text-5xl">⛓️</div>
        <h2 className="mt-3 text-2xl font-black text-white">You have been arrested</h2>
        <p className="mt-1 text-sm text-slate-400">Processing at the custody suite</p>
        <div className="my-4 rounded-xl border border-white/10 bg-black/30 p-4 text-left">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Charges</div>
          {charges.length ? (
            charges.map((c) => (
              <div key={c} className="text-sm text-rose-300">
                • {c}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400">• Suspicious behaviour</div>
          )}
          <div className="mt-2 text-sm text-slate-300">Fine paid: {money(fine)}</div>
        </div>
        <div className="text-4xl font-black text-sky-300">{hud.jailTime}s</div>
        <p className="text-xs text-slate-500">Remaining custody time</p>
        <Button className="mt-4" full variant="ghost" onClick={() => e?.police.release()}>
          Skip remaining time (community service)
        </Button>
      </div>
    </div>
  );
}

function PausePanel() {
  const player = usePlayer();
  if (!player) return null;
  return (
    <Modal title="NovaCity" subtitle="Paused" icon="⏸️" onClose={close}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button full onClick={close}>
          Resume
        </Button>
        <Button full variant="ghost" onClick={() => uiStore.set({ panel: "map" })}>
          Open map
        </Button>
        <Button full variant="ghost" onClick={() => uiStore.set({ panel: "phone" })}>
          Phone
        </Button>
        <Button full variant="ghost" onClick={() => uiStore.set({ panel: "stats" })}>
          Progression
        </Button>
        <Button full variant="ghost" onClick={() => uiStore.set({ panel: "settings" })}>
          Settings
        </Button>
        {player.role === "admin" ? (
          <Button full variant="ghost" onClick={() => uiStore.set({ panel: "admin" })}>
            Admin panel
          </Button>
        ) : null}
        <Button full variant="ghost" onClick={() => void flushSave()}>
          {player.role === "guest" ? "Save locally" : "Save now"}
        </Button>
        <Button
          full
          variant="ghost"
          onClick={async () => {
            await flushSave();
            window.location.href = "/";
          }}
        >
          Return to website
        </Button>
        <Button
          full
          variant="danger"
          onClick={async () => {
            await flushSave();
            if (player.role !== "guest") {
              await fetch("/api/auth/logout", { method: "POST" });
            }
            window.location.href = "/play";
          }}
        >
          {player.role === "guest" ? "Exit guest mode" : "Log out"}
        </Button>
      </div>
    </Modal>
  );
}

function StatsPanel() {
  const player = usePlayer();
  if (!player) return null;
  return (
    <Modal title="Progression" subtitle="Statistics & achievements" icon="📊" wide onClose={close}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          {[
            ["Level", player.level],
            ["Total XP", player.xp],
            ["Distance driven", `${(player.stats.distance / 1000).toFixed(2)} km`],
            ["Jobs completed", player.stats.jobsCompleted],
            ["Emergency calls cleared", player.stats.callsCleared],
            ["Crimes committed", player.stats.crimes],
            ["Robberies", player.stats.robberies],
            ["Arrests made", player.stats.arrests],
            ["Times arrested", player.stats.timesArrested],
            ["Money earned", money(player.stats.moneyEarned)],
            ["Money spent", money(player.stats.moneySpent)],
            ["Vehicles owned", player.vehicles.length],
            ["Properties owned", player.properties.length],
            ["Play time", `${Math.round(player.stats.playTime / 60)} minutes`],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs">
              <span className="text-slate-400">{k}</span>
              <span className="font-bold text-slate-100">{v}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const has = player.achievements.includes(a.id);
            return (
              <div
                key={a.id}
                className={`rounded-xl border p-3 ${has ? "border-amber-400/40 bg-amber-500/10" : "border-white/10 bg-white/[0.02] opacity-60"}`}
              >
                <div className="text-xl">{a.icon}</div>
                <div className="text-xs font-bold text-slate-100">{a.name}</div>
                <div className="text-[10px] text-slate-400">{a.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export default function Panels() {
  const ui = useUi();
  switch (ui.panel) {
    case "shop":
      return <ShopPanel />;
    case "atm":
      return <AtmPanel />;
    case "bank":
      return <BankPanel />;
    case "jobs":
      return <JobsPanel />;
    case "dealership":
      return <DealershipPanel />;
    case "garage":
      return <GaragePanel />;
    case "property":
      return <PropertyPanel />;
    case "clothing":
      return <ClothingPanel />;
    case "weapon":
      return <WeaponPanel />;
    case "mdt":
      return <MdtPanel />;
    case "travel":
      return <TravelPanel />;
    case "settings":
      return <SettingsPanel />;
    case "admin":
      return <AdminPanel />;
    case "arrest":
      return <ArrestPanel />;
    case "pause":
      return <PausePanel />;
    case "stats":
      return <StatsPanel />;
    default:
      return null;
  }
}

export { WEAPON_MAP };
