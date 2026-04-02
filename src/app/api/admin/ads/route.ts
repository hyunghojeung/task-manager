export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data } = await supabase.from("advertisements").select("*").eq("type", "banner").eq("is_active", true).limit(1).single();
  return NextResponse.json(data || { content: "", link_url: "", button_text: "" });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const supabase = getSupabase();
  const { data: existing } = await supabase.from("advertisements").select("id").eq("type", "banner").limit(1).single();
  if (existing) {
    await supabase.from("advertisements").update({ ...body, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("advertisements").insert({ ...body, type: "banner", is_active: true });
  }
  return NextResponse.json({ success: true });
}
