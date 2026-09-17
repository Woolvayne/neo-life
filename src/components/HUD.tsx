"use client";

import { useEffect, useRef, useState } from "react";
import { useHud, usePlayer, useUi, money } from "@/game/core/hooks";
import { uiStore, updatePlayer, notify } from "@/game/core/store";
import { JOB_MAP, rankName } from "@/game/data/jobs";
import { WANTED_LABELS } from "@/game/data/catalog";
import { levelFromXp } from "@/game/core/defaults";
import { Engine } from "@/game/engine/Engine";
import { Bar, Button } from "./ui/Kit";

function Minimap() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const hud = useHud();
  const ui = useUi();

  useEffect(() => {
    const cvs = ref.current;
    const e = Engine.instance;
    if (!cvs || !e) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const size = cvs.width;
    const scale = 0.32; // meters -> px
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#0a0f17";
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const px = hud.x;
    const pz = hud.z;
    const toScreen = (x: number, z: number) => [cx + (x - px) * scale, cy + (z - pz) * scale];

    // roads
    ctx.strokeStyle = "#28313d";
    ctx.lineWidth = 3;
    const lines = e.world?.roadLines ?? [];
    for (const l of lines) {
      const [sx] = toScreen(l, 0);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, size);
      ctx.stroke();
      const [, sy] = toScreen(0, l);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(size, sy);
      ctx.stroke();
    }

    // markers
    const colors: Record<string, string> = {
      police: "#3b82f6",
      hospital: "#22c55e",
      fire: "#ef4444",
      bank: "#eab308",
      shop: "#14b8a6",
      atm: "#22d3ee",
      garage: "#94a3b8",
      job: "#60a5fa",
      fuel: "#facc15",
      dealership: "#38bdf8",
      property: "#a78bfa",
      travel: "#f472b6",
      jewelry: "#c084fc",
      clothing: "#ec4899",
      weapon: "#f97316",
    };
    for (const m of ui.markers) {
      const [sx, sy] = toScreen(m.x, m.z);
      if (sx < -4 || sy < -4 || sx > size + 4 || sy > size + 4) continue;
      ctx.fillStyle = colors[m.kind] ?? "#94a3b8";
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }

    // dispatch
    for (const d of ui.dispatch) {
      const [sx, sy] = toScreen(d.x, d.z);
      ctx.beginPath();
      ctx.fillStyle = d.priority === 1 ? "#f87171" : "#fbbf24";
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // blips
    for (const b of e.getBlips()) {
      const [sx, sy] = toScreen(b.x, b.z);
      if (sx < 0 || sy < 0 || sx > size || sy > size) continue;
      if (b.kind === "traffic") {
        ctx.fillStyle = "#64748b";
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      } else if (b.kind === "policeai" || b.kind === "police") {
        ctx.fillStyle = "#60a5fa";
        ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
      } else if (b.kind === "player") {
        ctx.fillStyle = "#34d399";
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === "owned") {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
    }

    // waypoint
    if (e.waypoint) {
      const [sx, sy] = toScreen(e.waypoint.x, e.waypoint.z);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // player arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-hud.heading + Math.PI);
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  return (
    <div className="nc-glass relative overflow-hidden rounded-xl p-1">
      <canvas ref={ref} width={190} height={190} className="rounded-lg" />
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-slate-300">
        {hud.clock} · {hud.weather}
      </div>
    </div>
  );
}

function Notifications() {
  const ui = useUi();
  const tone: Record<string, string> = {
    info: "border-sky-400/40 bg-sky-500/10",
    success: "border-emerald-400/40 bg-emerald-500/10",
    warn: "border-amber-400/40 bg-amber-500/10",
    danger: "border-rose-400/40 bg-rose-500/10",
    dispatch: "border-violet-400/40 bg-violet-500/10",
  };
  return (
    <div className="pointer-events-none flex w-72 flex-col gap-2">
      {ui.notifications.map((n) => (
        <div key={n.id} className={`nc-slide rounded-xl border px-3 py-2 backdrop-blur ${tone[n.tone]}`}>
          <div className="text-xs font-bold text-slate-100">{n.title}</div>
          {n.body ? <div className="text-[11px] leading-snug text-slate-300">{n.body}</div> : null}
        </div>
      ))}
    </div>
  );
}

const TUTORIAL = [
  { title: "Movement", body: "Use W A S D to walk. Hold SHIFT to sprint, SPACE to jump. Click the world once to capture the mouse for camera look." },
  { title: "Camera", body: "Move the mouse to look around, scroll to zoom. Press ESC to release the cursor and open the pause menu." },
  { title: "Interaction", body: "Approach any glowing marker and press E. Shops, ATMs, garages, stations and properties are all interactive." },
  { title: "Vehicles", body: "Press F next to a vehicle to get in or out. L toggles lights, H horn, Q siren on emergency vehicles." },
  { title: "Map & GPS", body: "Press M for the full map. Click anywhere on it to set a GPS waypoint, or search for a location." },
  { title: "Phone", body: "Press P for your phone: banking, jobs, vehicles, properties, messages, dispatch and settings." },
  { title: "Jobs & money", body: "Press J or visit a job centre to sign on. Start assignments from the phone, complete them and get paid into your bank." },
  { title: "Emergency services", body: "Join Police, Fire or Medical, then accept live dispatch calls from the right-hand feed or the phone." },
  { title: "The other side", body: "Robberies, burglaries and vehicle theft are available from shop and property menus. Police will respond to your wanted level." },
];

function Tutorial() {
  const ui = useUi();
  const player = usePlayer();
  if (!player || player.tutorialDone) return null;
  const step = TUTORIAL[ui.tutorialStep];
  if (!step) return null;
  return (
    <div className="pointer-events-auto absolute bottom-28 left-1/2 w-[min(560px,92vw)] -translate-x-1/2">
      <div className="nc-panel nc-in rounded-2xl p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-300">
            Tutorial {ui.tutorialStep + 1}/{TUTORIAL.length}
          </span>
          <button
            className="text-[11px] text-slate-400 hover:text-slate-200"
            onClick={() => updatePlayer(() => ({ tutorialDone: true }))}
          >
            Skip tutorial
          </button>
        </div>
        <h3 className="text-lg font-bold text-white">{step.title}</h3>
        <p className="mt-1 text-sm text-slate-300">{step.body}</p>
        <div className="mt-3 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => uiStore.set({ tutorialStep: Math.max(0, ui.tutorialStep - 1) })}
          >
            Back
          </Button>
          <Button
            onClick={() => {
              if (ui.tutorialStep >= TUTORIAL.length - 1) {
                updatePlayer(() => ({ tutorialDone: true }));
                notify("Tutorial complete", "NovaCity is yours to explore.", "success");
              } else {
                uiStore.set({ tutorialStep: ui.tutorialStep + 1 });
              }
            }}
          >
            {ui.tutorialStep >= TUTORIAL.length - 1 ? "Start playing" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function HUD() {
  const hud = useHud();
  const ui = useUi();
  const player = usePlayer();
  const [showKeys, setShowKeys] = useState(false);
  if (!player || !player.settings.hud) return null;

  const job = JOB_MAP[player.job];
  const lv = levelFromXp(player.xp);
  const wantedStars = "★".repeat(player.wanted) + "☆".repeat(5 - player.wanted);
  const e = Engine.instance;
  const weapons = e?.gameplay?.weaponSlots() ?? [];
  const equipped = e?.gameplay?.currentWeapon();
  const scale = player.settings.uiScale;

  return (
    <div
      className="pointer-events-none absolute inset-0 select-none"
      style={{ fontSize: `${player.settings.textSize}rem`, zoom: scale }}
    >
      {/* top left */}
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        <div className="nc-glass rounded-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-black">
              {player.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold leading-tight text-slate-50">
                {player.displayName}
                {player.role === "guest" ? (
                  <span className="rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-300">
                    Guest
                  </span>
                ) : null}
              </div>
              <div className="text-[11px] leading-tight text-slate-400">
                {job ? `${job.icon} ${job.name} · ${rankName(player.job, player.jobRank)}` : "Unemployed civilian"}
                {player.role === "guest" ? " · local save" : ""}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-bold text-sky-300">LV {lv.level}</span>
            <Bar value={lv.into} max={lv.need} className="w-28" />
          </div>
        </div>
        {ui.interiorName ? (
          <div className="nc-glass rounded-xl px-3 py-1.5 text-[11px] font-semibold text-sky-200">
            Inside: {ui.interiorName}
          </div>
        ) : null}
      </div>

      {/* top right */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <div className="nc-glass flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Cash</div>
            <div className="text-sm font-bold text-emerald-300">{money(player.money)}</div>
          </div>
          <div className="h-7 w-px bg-white/10" />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Bank</div>
            <div className="text-sm font-bold text-sky-300">{money(player.bank)}</div>
          </div>
        </div>
        <div
          className={`nc-glass rounded-xl px-3 py-1.5 text-right ${player.wanted > 0 ? "border-rose-400/40" : ""}`}
        >
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Wanted</div>
          <div className={`text-sm font-bold ${player.wanted > 0 ? "text-rose-400" : "text-slate-500"}`}>
            <span className={player.wanted > 0 ? "nc-pulse" : ""}>{wantedStars}</span>
          </div>
          <div className="text-[10px] text-slate-400">{WANTED_LABELS[player.wanted]}</div>
        </div>
        <div className="nc-glass rounded-xl px-2.5 py-1 text-[10px] text-slate-400">
          {hud.fps} FPS · {ui.otherPlayers.length} online · {hud.peds} peds
          {ui.saving ? <span className="ml-1 text-amber-300">· saving…</span> : null}
        </div>
      </div>

      {/* right column: dispatch + mission */}
      <div className="absolute right-4 top-40 flex w-72 flex-col gap-2">
        <Notifications />
        {ui.mission ? (
          <div className="nc-glass rounded-xl border-amber-400/30 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Active assignment</div>
            <div className="text-xs font-semibold text-slate-100">{ui.mission.title}</div>
            <div className="mt-1 text-[11px] text-slate-300">
              → {ui.mission.steps[ui.mission.index]?.label ?? "Complete"}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              Reward {money(ui.mission.pay)} · {ui.mission.xp} XP
            </div>
          </div>
        ) : null}
        {ui.dispatch.slice(0, 3).map((d) => (
          <div key={d.id} className="nc-glass rounded-xl px-3 py-2">
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  d.priority === 1 ? "text-rose-300" : d.priority === 2 ? "text-amber-300" : "text-slate-400"
                }`}
              >
                P{d.priority} · {d.department}
              </span>
              <span className="text-[10px] text-slate-500">{d.status}</span>
            </div>
            <div className="text-xs font-semibold text-slate-100">{d.title}</div>
            <div className="text-[10px] text-slate-400">
              {Math.round(d.x)}, {Math.round(d.z)}
            </div>
          </div>
        ))}
      </div>

      {/* bottom left: vitals */}
      <div className="absolute bottom-4 left-4 w-64">
        <div className="nc-glass space-y-1.5 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="w-10 text-[10px] font-bold text-rose-300">HP</span>
            <Bar value={hud.health} color="bg-rose-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 text-[10px] font-bold text-sky-300">ARM</span>
            <Bar value={hud.armor} color="bg-sky-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 text-[10px] font-bold text-emerald-300">STA</span>
            <Bar value={hud.stamina} color="bg-emerald-400" />
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {weapons.length === 0 ? (
              <span className="text-[10px] text-slate-500">No equipment — visit an equipment store</span>
            ) : (
              weapons.map((w, i) => (
                <span
                  key={w.id}
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                    equipped?.id === w.id
                      ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                      : "border-white/10 text-slate-400"
                  }`}
                >
                  {i + 1} {w.name.split(" ")[0]}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* bottom center: prompt + vehicle */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        {hud.nearby ? (
          <div className="nc-glass mb-2 rounded-xl px-4 py-2 text-sm font-semibold text-sky-200">{hud.nearby}</div>
        ) : null}
        {hud.inVehicle ? (
          <div className="nc-glass flex items-center gap-4 rounded-xl px-4 py-2">
            <div>
              <div className="text-2xl font-black leading-none text-slate-50">{Math.round(hud.speed)}</div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400">km/h</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-left">
              <div className="text-[11px] font-bold text-slate-200">{hud.vehicleName}</div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>Gear {hud.gear}</span>
                <span className={hud.fuel < 15 ? "text-rose-400" : ""}>⛽ {Math.round(hud.fuel)}%</span>
                <span className={hud.condition < 40 ? "text-amber-400" : ""}>🔧 {Math.round(hud.condition)}%</span>
                {hud.lights ? <span className="text-amber-300">💡</span> : null}
                {hud.siren ? <span className="text-sky-300">🚨</span> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* bottom right: minimap + quick keys */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
        {player.settings.minimap ? <Minimap /> : null}
        <div className="pointer-events-auto flex gap-1">
          {[
            ["M", "map"],
            ["P", "phone"],
            ["J", "jobs"],
            ["K", "mdt"],
          ].map(([k, panel]) => (
            <button
              key={k}
              onClick={() => uiStore.set({ panel: ui.panel === panel ? null : (panel as never) })}
              className="nc-glass rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white"
            >
              {k}
            </button>
          ))}
          <button
            onClick={() => setShowKeys((s) => !s)}
            className="nc-glass rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white"
          >
            ?
          </button>
        </div>
        {showKeys ? (
          <div className="nc-glass pointer-events-auto w-64 rounded-xl p-3 text-[11px] text-slate-300">
            <div className="mb-1 font-bold text-slate-100">Controls</div>
            {[
              ["WASD", "Move / drive"],
              ["Shift", "Sprint"],
              ["Space", "Jump"],
              ["E", "Interact / hold action"],
              ["F", "Enter / exit vehicle"],
              ["L / H / Q", "Lights / horn / siren"],
              ["1-5 / R", "Equipment / reload"],
              ["Y", "Surrender to police"],
              ["M / P / J / K", "Map / phone / jobs / MDT"],
              ["Esc", "Pause menu"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-0.5">
                <span className="font-mono text-sky-300">{k}</span>
                <span className="text-slate-400">{v}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {hud.pursuit ? (
        <div className="absolute left-1/2 top-20 -translate-x-1/2">
          <div className="nc-glass nc-pulse rounded-xl border-rose-400/50 px-4 py-1.5 text-sm font-bold text-rose-300">
            ⚠ POLICE PURSUIT — press Y to surrender
          </div>
        </div>
      ) : null}

      <Tutorial />
    </div>
  );
}
