import { NextResponse } from "next/server";
import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "@/db";
import { presence } from "@/db/schema";
import { currentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * /multiplayer — heartbeat endpoint.
 * Any client POSTs its transform ~4x/second and receives every other player
 * that reported within the last 12 seconds on the same map. Swapping this for
 * a websocket/geckos transport later only requires replacing this route.
 */
export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const row = {
    accountId: account.id,
    username: String(b.username ?? account.username).slice(0, 24),
    map: String(b.map ?? "novacity"),
    x: Number(b.x) || 0,
    z: Number(b.z) || 0,
    heading: Number(b.heading) || 0,
    job: String(b.job ?? "unemployed"),
    wanted: Math.max(0, Math.min(5, Math.round(Number(b.wanted) || 0))),
    inVehicle: String(b.inVehicle ?? ""),
    updatedAt: new Date(),
  };
  await db
    .insert(presence)
    .values(row)
    .onConflictDoUpdate({ target: presence.accountId, set: row });

  const cutoff = new Date(Date.now() - 12000);
  const others = await db
    .select()
    .from(presence)
    .where(
      and(
        eq(presence.map, row.map),
        ne(presence.accountId, account.id),
        gt(presence.updatedAt, cutoff),
      ),
    )
    .limit(40);

  return NextResponse.json({
    players: others.map((p) => ({
      id: p.accountId,
      username: p.username,
      x: p.x,
      z: p.z,
      heading: p.heading,
      job: p.job,
      wanted: p.wanted,
      inVehicle: p.inVehicle,
    })),
    serverTime: Date.now(),
  });
}
