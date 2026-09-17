"use client";

import { useSyncExternalStore } from "react";
import { hudStore, playerStore, uiStore } from "./store";

export function useUi() {
  return useSyncExternalStore(uiStore.subscribe, uiStore.get, uiStore.get);
}

export function usePlayer() {
  return useSyncExternalStore(playerStore.subscribe, playerStore.get, playerStore.get);
}

export function useHud() {
  return useSyncExternalStore(hudStore.subscribe, hudStore.get, hudStore.get);
}

export const money = (n: number) =>
  `€${Math.round(n).toLocaleString("de-DE")}`;

export const clampText = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;
