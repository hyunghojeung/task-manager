export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = getSupabase();
  const { data } = await supabase.from("system_settings").select("*").eq("id", 1).maybeSingle();
  return NextResponse.json(data || { system_name: "Blackcopy.kr", admin_id: "blackcopy2" });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const supabase = getSupabase();
  const { data: existing } = await supabase.from("system_settings").select("id").eq("id", 1).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("system_settings").update({ system_name: body.system_name, admin_id: body.admin_id, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("system_settings").insert({ id: 1, system_name: body.system_name, admin_id: body.admin_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
