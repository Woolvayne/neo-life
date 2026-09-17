import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import {
  hashPassword,
  createSession,
  ensureProfile,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const dob = String(body.dob ?? "");
    const accepted = Boolean(body.accepted);

    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email))
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username))
      return NextResponse.json(
        { error: "Username must be 3-16 characters (letters, numbers, underscore)." },
        { status: 400 },
      );
    if (password.length < 6)
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    if (!dob) return NextResponse.json({ error: "Date of birth is required." }, { status: 400 });
    if (!accepted)
      return NextResponse.json({ error: "You must accept the Terms of Service." }, { status: 400 });

    const existing = await db
      .select({ id: accounts.id, email: accounts.email, username: accounts.username })
      .from(accounts)
      .where(or(eq(accounts.email, email), eq(accounts.username, username)))
      .limit(1);
    if (existing.length) {
      const clash = existing[0].email === email ? "email" : "username";
      return NextResponse.json({ error: `That ${clash} is already registered.` }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const isFirst = (await db.select({ id: accounts.id }).from(accounts).limit(1)).length === 0;
    const inserted = await db
      .insert(accounts)
      .values({ email, username, passwordHash, dob, role: isFirst ? "admin" : "player" })
      .returning();
    const acc = inserted[0];
    await ensureProfile(acc.id, username);
    await createSession(acc.id, true);

    return NextResponse.json({
      account: {
        id: acc.id,
        email: acc.email,
        username: acc.username,
        role: acc.role,
        createdAt: acc.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("register failed", err);
    return NextResponse.json({ error: "Registration failed. Try again." }, { status: 500 });
  }
}
