export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function PUT(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await request.json();
  const supabase = getSupabase();
  // 기존 기본값 모두 해제
  await supabase.from("form_templates").update({ is_default: false }).eq("company_id", session.company.id);
  // 선택된 양식만 기본값으로 설정
  if (id) {
    const { error } = await supabase.from("form_templates").update({ is_default: true }).eq("id", id).eq("company_id", session.company.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
