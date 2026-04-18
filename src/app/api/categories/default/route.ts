import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function PUT(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const supabase = getSupabase();
  // 모든 카테고리의 is_default를 false로 초기화
  await supabase.from("categories").update({ is_default: false }).eq("company_id", session.company.id);
  // 지정한 카테고리만 true로 설정
  const { error } = await supabase.from("categories").update({ is_default: true }).eq("id", id).eq("company_id", session.company.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
