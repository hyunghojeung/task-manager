export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { bearer, hashToken } from "@/lib/program-auth";

export async function POST(request: NextRequest) {
  const t = bearer(request);
  if (t) await getSupabase().from("program_tokens").delete().eq("token_hash", hashToken(t));
  return NextResponse.json({ ok: true });
}
