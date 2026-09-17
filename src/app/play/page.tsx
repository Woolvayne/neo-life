import type { Metadata } from "next";
import GameRoot from "@/components/GameRoot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Play | NovaCity: Urban Response",
  description: "Enter the original browser-based NovaCity open world.",
};

export default function PlayPage() {
  return <GameRoot />;
}
