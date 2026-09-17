import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await currentAccount();
  return NextResponse.json({ account });
}
