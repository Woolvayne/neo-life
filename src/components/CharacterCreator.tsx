"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "./ui/Kit";
import {
  CLOTH_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
  STYLE_PRESETS,
  defaultCharacter,
} from "@/game/core/defaults";
import type { CharacterAppearance } from "@/game/core/types";
import { createCharacter } from "@/game/engine/meshes";
import { audio } from "@/game/engine/audio";

type Section = "body" | "clothing" | "style";

function Swatches({
  colors,
  value,
  onPick,
}: {
  colors: string[];
  value: string;
  onPick: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => {
            audio.ui();
            onPick(c);
          }}
          style={{ background: c }}
          className={`h-7 w-7 rounded-lg border-2 transition ${
            value === c ? "border-sky-400 scale-110" : "border-white/15 hover:border-white/40"
          }`}
        />
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span className="text-slate-500">{Math.round(((value - min) / (max - min)) * 100)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-500"
      />
    </div>
  );
}

export default function CharacterCreator({
  initial,
  onConfirm,
  onBack,
}: {
  initial: CharacterAppearance;
  onConfirm: (a: CharacterAppearance) => void;
  onBack?: () => void;
}) {
  const [appearance, setAppearance] = useState<CharacterAppearance>(initial ?? defaultCharacter());
  const [section, setSection] = useState<Section>("body");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const spinRef = useRef(0.6);
  const draggingRef = useRef(false);

  const set = (patch: Partial<CharacterAppearance>) =>
    setAppearance((a) => ({ ...a, ...patch }));

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 50);
    camera.position.set(0, 1.5, 4.4);
    camera.lookAt(0, 1.0, 0);

    scene.add(new THREE.AmbientLight(0x8aa0c0, 0.5));
    const key = new THREE.DirectionalLight(0xfff1de, 2.3);
    key.position.set(3, 6, 5);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.9);
    fill.position.set(-3, 1.5, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x60a5fa, 1.6);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 0.12, 40),
      new THREE.MeshStandardMaterial({ color: "#131a25", roughness: 0.4, metalness: 0.6 }),
    );
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.02, 8, 60),
      new THREE.MeshBasicMaterial({ color: "#38bdf8" }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (rigRef.current && !draggingRef.current) spinRef.current += 0.005;
      if (rigRef.current) rigRef.current.rotation.y = spinRef.current;
      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      if (!mount) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let lastX = 0;
    const down = (e: PointerEvent) => {
      draggingRef.current = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      spinRef.current += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const up = () => {
      draggingRef.current = false;
    };
    mount.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rigRef.current) {
      scene.remove(rigRef.current);
      rigRef.current.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    const rig = createCharacter(appearance, 1.15);
    rig.root.traverse((o) => {
      o.castShadow = true;
    });
    scene.add(rig.root);
    rigRef.current = rig.root;
  }, [appearance]);

  const randomize = () => {
    const styles = Object.keys(STYLE_PRESETS);
    const style = styles[Math.floor(Math.random() * styles.length)];
    const preset = STYLE_PRESETS[style];
    setAppearance({
      height: Math.random(),
      build: Math.random(),
      skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
      face: Math.floor(Math.random() * 4),
      hair: Math.floor(Math.random() * 6),
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      eyeColor: EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)],
      shirt: preset.shirt,
      jacket: preset.jacket,
      pants: preset.pants,
      shoes: preset.shoes,
      hat: Math.floor(Math.random() * 4),
      accessory: Math.floor(Math.random() * 4),
      style,
    });
    audio.blip(720, 0.07, "triangle", 0.08);
  };

  const styleKeys = useMemo(() => Object.keys(STYLE_PRESETS), []);

  return (
    <div className="nc-grid-bg flex h-full w-full flex-col overflow-hidden lg:flex-row">
      <div className="relative flex-1">
        <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
        <div className="pointer-events-none absolute left-6 top-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-sky-300/80">Character Creator</div>
          <h1 className="text-3xl font-black text-white">Build your citizen</h1>
          <p className="mt-1 text-xs text-slate-400">Drag the model to rotate · changes preview live</p>
        </div>
      </div>

      <div className="nc-panel flex w-full flex-col lg:w-[440px]">
        <div className="flex gap-1 border-b border-white/10 p-3">
          {(["body", "clothing", "style"] as Section[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                audio.ui();
                setSection(s);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                section === s ? "bg-sky-500/20 text-sky-300" : "text-slate-400 hover:bg-white/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {section === "body" && (
            <>
              <Slider label="Height" value={appearance.height} onChange={(v) => set({ height: v })} />
              <Slider label="Body type" value={appearance.build} onChange={(v) => set({ build: v })} />
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Skin tone</div>
                <Swatches colors={SKIN_TONES} value={appearance.skin} onPick={(c) => set({ skin: c })} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Face</div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((f) => (
                    <Button key={f} variant={appearance.face === f ? "primary" : "ghost"} onClick={() => set({ face: f })}>
                      {f + 1}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hair style</div>
                <div className="flex flex-wrap gap-2">
                  {["Bald", "Buzz", "Side part", "Medium", "Long", "Spiky"].map((h, i) => (
                    <Button key={h} variant={appearance.hair === i ? "primary" : "ghost"} onClick={() => set({ hair: i })}>
                      {h}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hair colour</div>
                <Swatches colors={HAIR_COLORS} value={appearance.hairColor} onPick={(c) => set({ hairColor: c })} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Eye colour</div>
                <Swatches colors={EYE_COLORS} value={appearance.eyeColor} onPick={(c) => set({ eyeColor: c })} />
              </div>
            </>
          )}

          {section === "clothing" && (
            <>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Shirt</div>
                <Swatches colors={CLOTH_COLORS} value={appearance.shirt} onPick={(c) => set({ shirt: c })} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Jacket</div>
                <Swatches colors={CLOTH_COLORS} value={appearance.jacket} onPick={(c) => set({ jacket: c })} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pants</div>
                <Swatches colors={CLOTH_COLORS} value={appearance.pants} onPick={(c) => set({ pants: c })} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Shoes</div>
                <Swatches colors={CLOTH_COLORS} value={appearance.shoes} onPick={(c) => set({ shoes: c })} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Headwear</div>
                <div className="flex flex-wrap gap-2">
                  {["None", "Cap", "Helmet", "Beanie"].map((h, i) => (
                    <Button key={h} variant={appearance.hat === i ? "primary" : "ghost"} onClick={() => set({ hat: i })}>
                      {h}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accessories</div>
                <div className="flex flex-wrap gap-2">
                  {["None", "Glasses", "Hi-vis vest", "Backpack"].map((h, i) => (
                    <Button
                      key={h}
                      variant={appearance.accessory === i ? "primary" : "ghost"}
                      onClick={() => set({ accessory: i })}
                    >
                      {h}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === "style" && (
            <div className="grid grid-cols-2 gap-2">
              {styleKeys.map((k) => {
                const preset = STYLE_PRESETS[k];
                return (
                  <button
                    key={k}
                    onClick={() => {
                      audio.ui();
                      set({
                        style: k,
                        shirt: preset.shirt,
                        jacket: preset.jacket,
                        pants: preset.pants,
                        shoes: preset.shoes,
                        hat: k === "construction" ? 2 : k === "police" ? 1 : appearance.hat,
                        accessory: k === "construction" ? 2 : appearance.accessory,
                      });
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      appearance.style === k
                        ? "border-sky-400/60 bg-sky-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className="mb-2 flex gap-1">
                      {[preset.shirt, preset.jacket, preset.pants, preset.shoes].map((c, i) => (
                        <span key={i} style={{ background: c }} className="h-4 w-4 rounded" />
                      ))}
                    </div>
                    <div className="text-sm font-semibold text-slate-100">{preset.label}</div>
                    <div className="text-[11px] text-slate-400">Outfit preset</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-4">
          <Button variant="ghost" onClick={randomize}>
            🎲 Randomize
          </Button>
          <Button variant="ghost" onClick={() => setAppearance(defaultCharacter())}>
            ↺ Reset
          </Button>
          {onBack ? (
            <Button variant="subtle" onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => onConfirm(appearance)}>Save & Confirm →</Button>
        </div>
      </div>
    </div>
  );
}
