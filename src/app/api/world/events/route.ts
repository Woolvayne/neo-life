import { NextResponse } from "next/server";
import { and, eq, gt, desc } from "drizzle-orm";
import { db } from "@/db";
import { worldEvents } from "@/db/schema";
import { currentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** /dispatch — shared emergency call board. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const map = searchParams.get("map") ?? "novacity";
  const cutoff = new Date(Date.now() - 1000 * 60 * 12);
  const rows = await db
    .select()
    .from(worldEvents)
    .where(and(eq(worldEvents.map, map), gt(worldEvents.createdAt, cutoff)))
    .orderBy(desc(worldEvents.createdAt))
    .limit(30);
  return NextResponse.json({
    events: rows.map((r) => ({
      id: r.id,
      map: r.map,
      type: r.type,
      title: r.title,
      description: r.description,
      priority: r.priority,
      department: r.department,
      x: r.x,
      z: r.z,
      status: r.status,
      assigned: r.assigned as string[],
      createdAt: r.createdAt.getTime(),
    })),
  });
}

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === "update" && typeof b.id === "number") {
    await db
      .update(worldEvents)
      .set({
        status: String(b.status ?? "open"),
        assigned: Array.isArray(b.assigned) ? b.assigned : [account.username],
      })
      .where(eq(worldEvents.id, b.id));
    return NextResponse.json({ ok: true });
  }

  const inserted = await db
    .insert(worldEvents)
    .values({
      map: String(b.map ?? "novacity"),
      type: String(b.type ?? "incident"),
      title: String(b.title ?? "Incident").slice(0, 80),
      description: String(b.description ?? "").slice(0, 240),
      priority: Math.max(1, Math.min(3, Math.round(Number(b.priority) || 2))),
      department: String(b.department ?? "police"),
      x: Number(b.x) || 0,
      z: Number(b.z) || 0,
      status: "open",
      assigned: [],
    })
    .returning();
  const r = inserted[0];
  return NextResponse.json({
    event: {
      id: r.id,
      map: r.map,
      type: r.type,
      title: r.title,
      description: r.description,
      priority: r.priority,
      department: r.department,
      x: r.x,
      z: r.z,
      status: r.status,
      assigned: [] as string[],
      createdAt: r.createdAt.getTime(),
    },
  });
}
