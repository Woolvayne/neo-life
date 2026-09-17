"use client";

import { useEffect, useRef, useState } from "react";
import { useHud, usePlayer, useUi } from "@/game/core/hooks";
import { uiStore, notify } from "@/game/core/store";
import { Engine } from "@/game/engine/Engine";
import { MAPS } from "@/game/world/maps";
import { Button, Modal, Tag } from "./ui/Kit";

const MARKER_COLORS: Record<string, string> = {
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

const FILTERS = [
  ["all", "All"],
  ["police", "Police"],
  ["hospital", "Hospitals"],
  ["fire", "Fire"],
  ["shop", "Shops"],
  ["atm", "ATMs"],
  ["garage", "Garages"],
  ["job", "Jobs"],
  ["property", "Property"],
  ["fuel", "Fuel"],
];

export default function MapScreen() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ui = useUi();
  const hud = useHud();
  const player = usePlayer();
  const [zoom, setZoom] = useState(0.42);
  const [pan, setPan] = useState({ x: 0, z: 0 });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const drag = useRef<{ x: number; y: number } | null>(null);

  const e = Engine.instance;

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs || !e?.world) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const W = cvs.width;
    const H = cvs.height;
    ctx.fillStyle = "#070b11";
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2 - pan.x * zoom;
    const cy = H / 2 - pan.z * zoom;
    const S = (x: number, z: number): [number, number] => [cx + x * zoom, cy + z * zoom];

    // districts
    for (const d of e.map.districts) {
      const [x0, y0] = S(d.cx - d.rx, d.cz - d.rz);
      ctx.fillStyle = "rgba(56,120,200,0.07)";
      ctx.fillRect(x0, y0, d.rx * 2 * zoom, d.rz * 2 * zoom);
      ctx.strokeStyle = "rgba(120,170,230,0.16)";
      ctx.strokeRect(x0, y0, d.rx * 2 * zoom, d.rz * 2 * zoom);
      ctx.fillStyle = "rgba(160,200,240,0.5)";
      ctx.font = "11px system-ui";
      ctx.fillText(d.name, x0 + 8, y0 + 16);
    }

    // water
    for (const w of e.map.water ?? []) {
      const [x0, y0] = S(w.x - w.w / 2, w.z - w.h / 2);
      ctx.fillStyle = "rgba(30,80,130,0.55)";
      ctx.fillRect(x0, y0, w.w * zoom, w.h * zoom);
    }

    // roads
    ctx.strokeStyle = "#222b36";
    ctx.lineWidth = Math.max(1, 5 * zoom);
    for (const l of e.world.roadLines) {
      const [sx] = S(l, 0);
      const [x0, y0] = S(-e.map.half, -e.map.half);
      const [x1, y1] = S(e.map.half, e.map.half);
      ctx.beginPath();
      ctx.moveTo(sx, y0);
      ctx.lineTo(sx, y1);
      ctx.stroke();
      const [, sy] = S(0, l);
      ctx.beginPath();
      ctx.moveTo(x0, sy);
      ctx.lineTo(x1, sy);
      ctx.stroke();
    }

    // markers
    for (const m of ui.markers) {
      if (filter !== "all" && m.kind !== filter) continue;
      const [sx, sy] = S(m.x, m.z);
      ctx.fillStyle = MARKER_COLORS[m.kind] ?? "#94a3b8";
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (zoom > 0.5) {
        ctx.fillStyle = "rgba(220,235,255,0.75)";
        ctx.font = "10px system-ui";
        ctx.fillText(m.label, sx + 7, sy + 3);
      }
    }

    // dispatch events
    for (const d of ui.dispatch) {
      const [sx, sy] = S(d.x, d.z);
      ctx.strokeStyle = d.priority === 1 ? "#f87171" : "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // live entities
    for (const b of e.getBlips()) {
      const [sx, sy] = S(b.x, b.z);
      if (b.kind === "traffic") continue;
      ctx.fillStyle =
        b.kind === "player"
          ? "#34d399"
          : b.kind === "policeai" || b.kind === "police"
            ? "#60a5fa"
            : b.kind === "owned"
              ? "#f8fafc"
              : "#64748b";
      ctx.beginPath();
      ctx.arc(sx, sy, b.kind === "player" ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (b.label && zoom > 0.35) {
        ctx.fillStyle = "rgba(190,240,215,0.8)";
        ctx.font = "10px system-ui";
        ctx.fillText(b.label, sx + 7, sy - 5);
      }
    }

    // waypoint
    if (e.waypoint) {
      const [sx, sy] = S(e.waypoint.x, e.waypoint.z);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 14, sy);
      ctx.lineTo(sx + 14, sy);
      ctx.moveTo(sx, sy - 14);
      ctx.lineTo(sx, sy + 14);
      ctx.stroke();
      // route line
      const [px, py] = S(hud.x, hud.z);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(56,189,248,0.55)";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // player
    const [px, py] = S(hud.x, hud.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-hud.heading + Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  if (!e || !player) return null;

  const dist = e.waypoint
    ? Math.hypot(e.waypoint.x - hud.x, e.waypoint.z - hud.z)
    : 0;
  const bearing = e.waypoint
    ? ((Math.atan2(e.waypoint.x - hud.x, e.waypoint.z - hud.z) * 180) / Math.PI + 360) % 360
    : 0;
  const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(bearing / 45) % 8];

  const results = search
    ? ui.markers.filter((m) => m.label.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  return (
    <Modal title="NovaCity Navigation" subtitle={e.map.name} icon="🗺️" wide onClose={() => uiStore.set({ panel: null })}>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <canvas
            ref={ref}
            width={900}
            height={620}
            className="w-full cursor-move rounded-xl border border-white/10"
            onPointerDown={(ev) => {
              drag.current = { x: ev.clientX, y: ev.clientY };
            }}
            onPointerMove={(ev) => {
              if (!drag.current) return;
              const dx = ev.clientX - drag.current.x;
              const dy = ev.clientY - drag.current.y;
              drag.current = { x: ev.clientX, y: ev.clientY };
              setPan((p) => ({ x: p.x - dx / zoom, z: p.z - dy / zoom }));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onDoubleClick={(ev) => {
              const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
              const scaleX = 900 / rect.width;
              const scaleY = 620 / rect.height;
              const mx = (ev.clientX - rect.left) * scaleX;
              const my = (ev.clientY - rect.top) * scaleY;
              const wx = (mx - 900 / 2 + pan.x * zoom) / zoom;
              const wz = (my - 620 / 2 + pan.z * zoom) / zoom;
              e.setWaypoint(wx, wz);
            }}
            onWheel={(ev) => setZoom((z) => Math.max(0.12, Math.min(1.6, z - ev.deltaY * 0.0006)))}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setZoom((z) => Math.min(1.6, z + 0.12))}>
              ＋
            </Button>
            <Button variant="ghost" onClick={() => setZoom((z) => Math.max(0.12, z - 0.12))}>
              －
            </Button>
            <Button variant="ghost" onClick={() => setPan({ x: hud.x, z: hud.z })}>
              Centre on me
            </Button>
            <Button variant="ghost" onClick={() => e.clearWaypoint()}>
              Clear waypoint
            </Button>
            <span className="text-xs text-slate-400">Double-click the map to set a GPS waypoint · drag to pan · scroll to zoom</span>
          </div>
        </div>

        <div className="space-y-3">
          <input
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            placeholder="Search locations…"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-sky-400/60"
          />
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                e.setWaypoint(r.x, r.z);
                setPan({ x: r.x, z: r.z });
              }}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs hover:bg-white/[0.08]"
            >
              {r.label}
            </button>
          ))}

          <div className="flex flex-wrap gap-1">
            {FILTERS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${
                  filter === k ? "border-sky-400/60 bg-sky-500/20 text-sky-200" : "border-white/10 text-slate-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {e.waypoint ? (
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-sky-300">Active route</div>
              <div className="text-lg font-black text-white">{(dist / 1000).toFixed(2)} km</div>
              <div className="text-xs text-slate-300">
                Head {compass} · ETA {Math.max(1, Math.round(dist / 180))} min by car
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Regions</div>
            <div className="space-y-1">
              {MAPS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.id === player.currentMap) {
                      notify("Already here", m.name, "info");
                      return;
                    }
                    void e.travelTo(m.id);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    m.id === player.currentMap
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{m.name}</span>
                    {m.id === player.currentMap ? <Tag tone="green">Here</Tag> : <Tag tone="blue">Travel</Tag>}
                  </div>
                  <div className="text-[10px] text-slate-400">{m.tagline}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
