"use client";

import { useState } from "react";
import { useHud, usePlayer, useUi, money } from "@/game/core/hooks";
import { addMoney, uiStore, updatePlayer, notify } from "@/game/core/store";
import { JOBS, JOB_MAP, rankName } from "@/game/data/jobs";
import { VEHICLE_MAP } from "@/game/data/vehicles";
import { Engine } from "@/game/engine/Engine";
import { Button, Row, Tag } from "./ui/Kit";
import { ACHIEVEMENT_MAP } from "@/game/data/catalog";

type App =
  | "home"
  | "messages"
  | "contacts"
  | "map"
  | "bank"
  | "jobs"
  | "emergency"
  | "vehicles"
  | "property"
  | "news"
  | "settings"
  | "stats";

const NEWS = [
  ["Nova Tower opens observation deck", "Kronen Core's tallest building welcomes visitors this weekend."],
  ["Ring road resurfacing begins", "Expect delays between Marktviertel and Südhafen Works."],
  ["Police launch new traffic unit", "Nova Police Service adds interceptors to the highway patrol fleet."],
  ["Harbour ferry adds late service", "Port District commuters get a midnight crossing."],
  ["County fire brigade recruiting", "Volunteer firefighters wanted in Hollerbach."],
];

export default function Phone() {
  const player = usePlayer();
  const ui = useUi();
  const hud = useHud();
  const [app, setApp] = useState<App>("home");
  const [amount, setAmount] = useState(250);
  if (!player) return null;
  const e = Engine.instance;

  const apps: { id: App; icon: string; label: string; tone: string }[] = [
    { id: "messages", icon: "💬", label: "Messages", tone: "bg-emerald-500/20" },
    { id: "contacts", icon: "👥", label: "Contacts", tone: "bg-sky-500/20" },
    { id: "map", icon: "🗺️", label: "Map", tone: "bg-indigo-500/20" },
    { id: "bank", icon: "🏦", label: "NovaBank", tone: "bg-amber-500/20" },
    { id: "jobs", icon: "💼", label: "Jobs", tone: "bg-blue-500/20" },
    { id: "emergency", icon: "🚨", label: "Dispatch", tone: "bg-rose-500/20" },
    { id: "vehicles", icon: "🚗", label: "Vehicles", tone: "bg-slate-500/20" },
    { id: "property", icon: "🏠", label: "Property", tone: "bg-violet-500/20" },
    { id: "news", icon: "📰", label: "News", tone: "bg-teal-500/20" },
    { id: "stats", icon: "📊", label: "Stats", tone: "bg-fuchsia-500/20" },
    { id: "settings", icon: "⚙️", label: "Settings", tone: "bg-zinc-500/20" },
  ];

  const unread = ui.messages.filter((m) => m.unread).length;

  return (
    <div className="pointer-events-auto absolute bottom-6 right-6 z-30 w-[340px]">
      <div className="nc-panel nc-in overflow-hidden rounded-[28px] border-2 border-white/10 p-2 shadow-2xl">
        <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold text-slate-400">
          <span>NovaPhone</span>
          <span>
            {hud.clock} · {player.wanted > 0 ? "⚠" : "📶"} 🔋
          </span>
        </div>
        <div className="h-[520px] overflow-y-auto rounded-[20px] bg-gradient-to-b from-slate-900/90 to-slate-950 p-3">
          {app === "home" && (
            <div>
              <div className="mb-3 rounded-2xl bg-gradient-to-br from-sky-600/30 to-indigo-700/20 p-3">
                <div className="text-xs text-slate-300">
                  {player.role === "guest" ? "Playing locally as guest" : "Signed in as"}
                </div>
                <div className="text-lg font-bold text-white">{player.displayName}</div>
                <div className="text-[11px] text-slate-400">
                  {JOB_MAP[player.job]?.name ?? "Unemployed"} · {money(player.money)} cash
                  {player.role === "guest" ? " · local save" : ""}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {apps.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setApp(a.id)}
                    className="flex flex-col items-center gap-1 text-[10px] text-slate-300"
                  >
                    <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${a.tone}`}>
                      {a.icon}
                      {a.id === "messages" && unread ? (
                        <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white">
                          {unread}
                        </span>
                      ) : null}
                    </span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {app !== "home" && (
            <div className="mb-2 flex items-center justify-between">
              <button onClick={() => setApp("home")} className="text-xs font-bold text-sky-400">
                ‹ Home
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{app}</span>
            </div>
          )}

          {app === "messages" && (
            <div className="space-y-2">
              {ui.messages.length === 0 ? (
                <p className="text-xs text-slate-500">No messages yet. Dispatch and employers will text you here.</p>
              ) : (
                ui.messages.map((m) => (
                  <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-sky-300">{m.from}</span>
                      <span>{new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="text-xs text-slate-200">{m.body}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {app === "contacts" && (
            <div className="space-y-2">
              {[
                ["Nova Dispatch", "Emergency coordination", "112"],
                ["Nova Police Service", "Non-emergency line", "110"],
                ["Nova Medical Response", "Ambulance control", "112"],
                ["Nova Fire & Rescue", "Fire control", "112"],
                ["Grip Recovery", "Towing & recovery", "0800 447"],
                ["NovaBank", "Customer service", "0800 626"],
                ["Vantra Auto Centre", "Vehicle sales", "0800 828"],
              ].map(([n, d, num]) => (
                <Row
                  key={n}
                  title={n}
                  subtitle={d}
                  right={<span className="text-[11px] text-sky-300">{num}</span>}
                  onClick={() => notify("Calling…", `${n} — line busy, try radio instead`, "info")}
                />
              ))}
            </div>
          )}

          {app === "map" && (
            <div className="space-y-2">
              <Button full onClick={() => uiStore.set({ panel: "map" })}>
                Open full map
              </Button>
              {ui.markers.slice(0, 14).map((m) => (
                <Row
                  key={m.id}
                  title={m.label}
                  subtitle={`${Math.round(m.x)}, ${Math.round(m.z)}`}
                  right={<span className="text-[11px] text-sky-300">GPS</span>}
                  onClick={() => {
                    e?.setWaypoint(m.x, m.z);
                    uiStore.set({ panel: null });
                  }}
                />
              ))}
            </div>
          )}

          {app === "bank" && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-amber-200">Account balance</div>
                <div className="text-2xl font-black text-white">{money(player.bank)}</div>
                <div className="text-[11px] text-slate-400">Cash on hand {money(player.money)}</div>
              </div>
              <div className="flex gap-2">
                {[100, 250, 1000, 5000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className={`flex-1 rounded-lg border px-1 py-1 text-[11px] ${
                      amount === v ? "border-sky-400 bg-sky-500/20 text-sky-200" : "border-white/10 text-slate-400"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (player.money < amount) return notify("Not enough cash", "", "warn");
                    addMoney(-amount, "Deposit", "cash");
                    addMoney(amount, "Deposit", "bank");
                    notify("Deposited", money(amount), "success");
                  }}
                >
                  Deposit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (player.bank < amount) return notify("Insufficient funds", "", "warn");
                    addMoney(-amount, "Withdrawal", "bank");
                    addMoney(amount, "Withdrawal", "cash");
                    notify("Withdrawn", money(amount), "success");
                  }}
                >
                  Withdraw
                </Button>
              </div>
              <Button
                full
                variant="ghost"
                onClick={() => {
                  const others = ui.otherPlayers.filter((o) => o.id > 0);
                  if (!others.length) return notify("No players online", "Transfers need another live player", "warn");
                  if (player.bank < amount) return notify("Insufficient funds", "", "warn");
                  addMoney(-amount, `Transfer to ${others[0].username}`, "bank");
                  notify("Transfer sent", `${money(amount)} → ${others[0].username}`, "success");
                }}
              >
                Transfer to nearest player
              </Button>
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Transactions</div>
                <div className="space-y-1">
                  {player.transactions.slice(0, 12).map((t, i) => (
                    <div key={i} className="flex justify-between rounded-lg bg-white/[0.03] px-2 py-1 text-[11px]">
                      <span className="text-slate-300">{t.label}</span>
                      <span className={t.amount >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {t.amount >= 0 ? "+" : ""}
                        {money(t.amount)}
                      </span>
                    </div>
                  ))}
                  {player.transactions.length === 0 ? (
                    <div className="text-[11px] text-slate-500">No transactions yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {app === "jobs" && (
            <div className="space-y-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Current employment</div>
                <div className="text-sm font-bold text-white">{JOB_MAP[player.job]?.name ?? "Unemployed"}</div>
                <div className="text-[11px] text-slate-400">
                  {player.job !== "unemployed"
                    ? `${rankName(player.job, player.jobRank)} · ${player.jobXp[player.job] ?? 0} job XP`
                    : "Choose a job below"}
                </div>
              </div>
              <Button
                full
                onClick={() => {
                  e?.gameplay.startJobMission();
                  uiStore.set({ panel: null });
                }}
              >
                Start assignment
              </Button>
              {ui.mission ? (
                <Button full variant="ghost" onClick={() => e?.gameplay.cancelMission()}>
                  Cancel current assignment
                </Button>
              ) : null}
              <Button full variant="ghost" onClick={() => uiStore.set({ panel: "jobs" })}>
                Browse all {JOBS.length} careers
              </Button>
            </div>
          )}

          {app === "emergency" && (
            <div className="space-y-2">
              {ui.dispatch.length === 0 ? (
                <p className="text-xs text-slate-500">No active calls. New incidents appear automatically.</p>
              ) : (
                ui.dispatch.map((d) => (
                  <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="flex items-center justify-between">
                      <Tag tone={d.priority === 1 ? "red" : d.priority === 2 ? "amber" : "slate"}>
                        P{d.priority} {d.department}
                      </Tag>
                      <span className="text-[10px] text-slate-500">{d.status}</span>
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-100">{d.title}</div>
                    <div className="text-[11px] text-slate-400">{d.description}</div>
                    <div className="mt-2 flex gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          e?.setWaypoint(d.x, d.z);
                          void e?.gameplay.updateDispatch(d.id, "en route");
                          e?.gameplay.startJobMission(d);
                          uiStore.set({ panel: null });
                        }}
                      >
                        Accept
                      </Button>
                      <Button variant="subtle" onClick={() => void e?.gameplay.updateDispatch(d.id, "cleared")}>
                        Clear
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {app === "vehicles" && (
            <div className="space-y-2">
              {player.vehicles.length === 0 ? (
                <p className="text-xs text-slate-500">You do not own a vehicle. Visit a dealership marker.</p>
              ) : (
                player.vehicles.map((v) => (
                  <Row
                    key={v.uid}
                    title={VEHICLE_MAP[v.modelId]?.name ?? v.modelId}
                    subtitle={`${v.plate} · ${v.stored ? "In garage" : "Out"} · ⛽${Math.round(v.fuel)}%`}
                    right={<span className="text-[11px] text-sky-300">{v.stored ? "Request" : "Store"}</span>}
                    onClick={() => {
                      if (v.stored) e?.spawnOwnedVehicle(v.uid);
                      else e?.storeVehicle(v.uid);
                    }}
                  />
                ))
              )}
            </div>
          )}

          {app === "property" && (
            <div className="space-y-2">
              {player.properties.length === 0 ? (
                <p className="text-xs text-slate-500">No properties owned. Look for violet markers around the map.</p>
              ) : (
                player.properties.map((p) => (
                  <Row
                    key={p.id}
                    title={p.name}
                    subtitle={`${p.kind} · ${p.map}`}
                    right={<span className="text-[11px] text-sky-300">GPS</span>}
                    onClick={() => {
                      e?.setWaypoint(p.x, p.z);
                      uiStore.set({ panel: null });
                    }}
                  />
                ))
              )}
            </div>
          )}

          {app === "news" && (
            <div className="space-y-2">
              {NEWS.map(([t, b]) => (
                <div key={t} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="text-xs font-bold text-slate-100">{t}</div>
                  <div className="text-[11px] text-slate-400">{b}</div>
                </div>
              ))}
            </div>
          )}

          {app === "stats" && (
            <div className="space-y-2">
              {[
                ["Distance driven", `${(player.stats.distance / 1000).toFixed(1)} km`],
                ["Jobs completed", player.stats.jobsCompleted],
                ["Calls cleared", player.stats.callsCleared],
                ["Crimes committed", player.stats.crimes],
                ["Robberies", player.stats.robberies],
                ["Arrests made", player.stats.arrests],
                ["Times arrested", player.stats.timesArrested],
                ["Money earned", money(player.stats.moneyEarned)],
                ["Money spent", money(player.stats.moneySpent)],
                ["Vehicles owned", player.vehicles.length],
                ["Properties", player.properties.length],
                ["Play time", `${Math.round(player.stats.playTime / 60)} min`],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-bold text-slate-100">{v}</span>
                </div>
              ))}
              <div className="pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Achievements</div>
              <div className="flex flex-wrap gap-1">
                {player.achievements.length === 0 ? (
                  <span className="text-[11px] text-slate-500">None yet</span>
                ) : (
                  player.achievements.map((a) => (
                    <span key={a} className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                      {ACHIEVEMENT_MAP[a]?.icon} {ACHIEVEMENT_MAP[a]?.name ?? a}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {app === "settings" && (
            <div className="space-y-2">
              <Button full variant="ghost" onClick={() => uiStore.set({ panel: "settings" })}>
                Open full settings
              </Button>
              <Row
                title="HUD"
                subtitle="Toggle the heads-up display"
                right={<Tag tone={player.settings.hud ? "green" : "slate"}>{player.settings.hud ? "On" : "Off"}</Tag>}
                onClick={() => updatePlayer((s) => ({ settings: { ...s.settings, hud: !s.settings.hud } }))}
              />
              <Row
                title="Minimap"
                right={<Tag tone={player.settings.minimap ? "green" : "slate"}>{player.settings.minimap ? "On" : "Off"}</Tag>}
                onClick={() => updatePlayer((s) => ({ settings: { ...s.settings, minimap: !s.settings.minimap } }))}
              />
            </div>
          )}
        </div>
        <div className="flex justify-center py-1.5">
          <button
            onClick={() => (app === "home" ? uiStore.set({ panel: null }) : setApp("home"))}
            className="h-1.5 w-24 rounded-full bg-white/25"
          />
        </div>
      </div>
    </div>
  );
}
