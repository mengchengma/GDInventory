import { NextRequest, NextResponse } from "next/server";
import { checkKioskPin } from "@/lib/auth";

// Verifies the staff exit PIN for the customer lock on /members. Kept behind
// the normal session gate by middleware, so only a logged-in tablet can call it.
export async function POST(req: NextRequest) {
  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!checkKioskPin(String(body.pin ?? ""))) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
