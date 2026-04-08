export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

const defaults = {
  system_name: "Blackcopy.kr",
  admin_id: "blackcopy2",
  og_title: "Blackcopy.kr | 인쇄전용 ERP Bcount",
  og_description: "인쇄/출력 작업기록, 견적서, 거래명세서, 발주서까지 올인원 업무관리",
  og_url: "https://blackcopy.kr",
  og_site_name: "Blackcopy.kr",
};

export async function GET() {
  const supabase = getSupabase();
  const { data } = await supabase.from("system_settings").select("*").eq("id", 1).maybeSingle();
  return NextResponse.json({ ...defaults, ...data });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const supabase = getSupabase();
  const { data: existing } = await supabase.from("system_settings").select("id").eq("id", 1).maybeSingle();
  const fields = {
    system_name: body.system_name,
    admin_id: body.admin_id,
    og_title: body.og_title,
    og_description: body.og_description,
    og_url: body.og_url,
    og_site_name: body.og_site_name,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await supabase.from("system_settings").update(fields).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("system_settings").insert({ id: 1, ...fields });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
