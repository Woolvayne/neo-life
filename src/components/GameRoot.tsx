"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUi, usePlayer } from "@/game/core/hooks";
import {
  flushSave,
  mirrorLocal,
  notify,
  playerStore,
  readGuest,
  readLocal,
  uiStore,
  updatePlayer,
} from "@/game/core/store";
import { createGuestState, hydrateState, defaultCharacter } from "@/game/core/defaults";
import type { AccountInfo, CharacterAppearance } from "@/game/core/types";
import { Engine } from "@/game/engine/Engine";
import { audio } from "@/game/engine/audio";
import AuthScreen from "./AuthScreen";
import CharacterCreator from "./CharacterCreator";
import HUD from "./HUD";
import Panels from "./Panels";
import Phone from "./Phone";
import MapScreen from "./MapScreen";
import { Button } from "./ui/Kit";

function Boot({ text, pct }: { text: string; pct: number }) {
  return (
    <div className="nc-grid-bg flex h-full w-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.5em] text-sky-300/70">Loading</div>
        <h1 className="mt-1 text-6xl font-black tracking-tight text-white">
          NOVA<span className="text-sky-400">CITY</span>
        </h1>
        <p className="mt-1 text-sm font-medium tracking-[0.3em] text-slate-400">URBAN RESPONSE</p>
      </div>
      <div className="w-[min(420px,80vw)]">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-center text-xs text-slate-400">{text}</div>
      </div>
    </div>
  );
}

const CINEMATIC = [
  { t: "NovaCity", s: "Population 1.4 million · Northern European coast" },
  { t: "A city that never stops", s: "Traffic, trams, sirens and a thousand small emergencies" },
  { t: "Choose your side", s: "Serve the public · build a career · or take what you want" },
  { t: "Central Station", s: "Your story starts here" },
];

export default function GameRoot() {
  const ui = useUi();
  const player = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [cineIdx, setCineIdx] = useState(0);
  const [booted, setBooted] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onLock = () => setLocked(document.pointerLockElement === canvasRef.current);
    document.addEventListener("pointerlockchange", onLock);
    return () => document.removeEventListener("pointerlockchange", onLock);
  }, []);

  const beginGuest = useCallback(() => {
    const guest = createGuestState(readGuest());
    playerStore.replace(guest);
    mirrorLocal(guest);
    uiStore.set({
      account: null,
      phase: guest.characterDone ? "loading" : "character",
      loadingPct: 20,
      loadingText: "Preparing local guest world",
    });
    setBooted(true);
  }, []);

  /* ---------------- initial session probe ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      uiStore.set({ loadingText: "Connecting to NovaCity services", loadingPct: 18 });
      const guestRequested = new URLSearchParams(window.location.search).get("guest") === "1";
      try {
        const res = await fetch("/api/state");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.account) {
            const state = hydrateState(data.account, data.profile ?? {});
            playerStore.replace(state);
            mirrorLocal(state);
            uiStore.set({
              account: data.account as AccountInfo,
              phase: state.characterDone ? "loading" : "character",
              loadingPct: 55,
            });
            setBooted(true);
            return;
          }
        }
        if (cancelled) return;
        if (guestRequested) {
          beginGuest();
        } else {
          // Server is online, but no account session exists: show the optional choices.
          uiStore.set({ phase: "auth" });
          setBooted(true);
        }
        return;
      } catch {
        // A real connection failure may use the last account save as an offline fallback.
      }
      if (cancelled) return;
      if (guestRequested) {
        beginGuest();
        return;
      }
      const local = readLocal();
      if (local) {
        playerStore.replace(local);
        uiStore.set({
          account: {
            id: local.accountId,
            email: "",
            username: local.username,
            role: local.role,
            createdAt: local.createdAt,
          },
          phase: local.characterDone ? "loading" : "character",
        });
        notify("Offline mode", "Server unreachable — using your local account save", "warn");
      } else {
        uiStore.set({ phase: "auth" });
      }
      setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [beginGuest]);

  /* ---------------- autosave on unload ---------------- */
  useEffect(() => {
    const handler = () => {
      const p = playerStore.get();
      if (p) mirrorLocal(p);
    };
    window.addEventListener("beforeunload", handler);
    const iv = window.setInterval(() => void flushSave(), 20000);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.clearInterval(iv);
    };
  }, []);

  /* ---------------- engine boot ---------------- */
  const bootEngine = useCallback(async () => {
    const canvas = canvasRef.current;
    const p = playerStore.get();
    if (!canvas || !p || engineRef.current) return;
    uiStore.set({ loadingText: "Generating NovaCity districts", loadingPct: 35 });
    await new Promise((r) => setTimeout(r, 60));
    const engine = new Engine(canvas);
    engineRef.current = engine;
    await engine.loadMap(p.currentMap);
    uiStore.set({ loadingText: "Spawning traffic and pedestrians", loadingPct: 78 });
    await new Promise((r) => setTimeout(r, 60));
    engine.start();
    audio.init();
    audio.setVolumes(p.settings.master, p.settings.sfx, p.settings.ambient);
    uiStore.set({ loadingPct: 100, loadingText: "Entering the world" });
    await new Promise((r) => setTimeout(r, 200));
    uiStore.set({ phase: "playing" });
    notify("Welcome to NovaCity", "Press P for your phone, M for the map.", "success", 8000);
  }, []);

  useEffect(() => {
    if (ui.phase === "loading" && booted) void bootEngine();
  }, [ui.phase, booted, bootEngine]);

  /* release the mouse whenever a UI surface opens so panels stay clickable */
  useEffect(() => {
    if (ui.panel) engineRef.current?.exitLock();
  }, [ui.panel]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  /* ---------------- cinematic ---------------- */
  useEffect(() => {
    if (ui.phase !== "intro") return;
    setCineIdx(0);
    const iv = window.setInterval(() => {
      setCineIdx((i) => {
        if (i >= CINEMATIC.length - 1) {
          window.clearInterval(iv);
          uiStore.set({ phase: "loading" });
          return i;
        }
        return i + 1;
      });
    }, 2600);
    return () => window.clearInterval(iv);
  }, [ui.phase]);

  const onAuthed = async (account: AccountInfo) => {
    const res = await fetch("/api/state");
    const data = res.ok ? await res.json() : { profile: {} };
    const state = hydrateState(account, data.profile ?? {});
    playerStore.replace(state);
    mirrorLocal(state);
    uiStore.set({ account, phase: state.characterDone ? "loading" : "character" });
  };

  const onCharacterConfirm = (appearance: CharacterAppearance) => {
    updatePlayer(() => ({ character: appearance, characterDone: true }));
    void flushSave();
    engineRef.current?.rebuildCharacter(appearance);
    uiStore.set({ phase: playerStore.get()?.tutorialDone ? "loading" : "intro" });
  };

  const playing = ui.phase === "playing";

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#05070c]">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${playing ? "" : "pointer-events-none opacity-0"}`}
        onClick={() => engineRef.current?.requestLock()}
      />

      {playing ? (
        <>
          <HUD />
          {ui.panel === "phone" ? <Phone /> : null}
          {ui.panel === "map" ? <MapScreen /> : null}
          <Panels />
          {!locked && !ui.panel ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="nc-glass rounded-2xl px-6 py-4 text-center">
                <div className="text-lg font-bold text-white">Click to play</div>
                <div className="text-xs text-slate-400">Captures your mouse for camera control · ESC to release</div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {ui.phase === "boot" || ui.phase === "loading" ? (
        <div className="absolute inset-0 z-30">
          <Boot text={ui.loadingText} pct={ui.loadingPct} />
        </div>
      ) : null}

      {ui.phase === "auth" ? (
        <div className="absolute inset-0 z-30">
          <AuthScreen onAuthed={(a) => void onAuthed(a)} onGuest={beginGuest} />
        </div>
      ) : null}

      {ui.phase === "character" ? (
        <div className="absolute inset-0 z-30">
          <CharacterCreator
            initial={player?.character ?? defaultCharacter()}
            onConfirm={onCharacterConfirm}
          />
        </div>
      ) : null}

      {ui.phase === "intro" ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
          <div className="nc-grid-bg absolute inset-0 opacity-70" />
          <div key={cineIdx} className="nc-in relative text-center">
            <h2 className="text-5xl font-black tracking-tight text-white">{CINEMATIC[cineIdx].t}</h2>
            <p className="mt-2 text-sm tracking-[0.25em] text-slate-400">{CINEMATIC[cineIdx].s}</p>
          </div>
          <div className="absolute bottom-10 flex gap-3">
            {CINEMATIC.map((_, i) => (
              <span key={i} className={`h-1 w-10 rounded-full ${i <= cineIdx ? "bg-sky-400" : "bg-white/15"}`} />
            ))}
          </div>
          <div className="absolute bottom-20">
            <Button variant="ghost" onClick={() => uiStore.set({ phase: "loading" })}>
              Skip intro →
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
