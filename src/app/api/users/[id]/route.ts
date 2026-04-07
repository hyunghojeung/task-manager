import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session || session.user.role !== "admin") return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();

  // 자기 자신의 role을 user로 변경 방지
  if (body.role === "user" && id === session.user.id) {
    return NextResponse.json({ error: "자기 자신의 관리자 권한은 변경할 수 없습니다." }, { status: 400 });
  }

  // 회사의 마지막 admin을 user로 변경 방지
  if (body.role === "user") {
    const { count } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("company_id", session.company.id).eq("role", "admin");
    if ((count || 0) <= 1) {
      return NextResponse.json({ error: "관리자가 최소 1명은 있어야 합니다." }, { status: 400 });
    }
  }

  const { data, error } = await supabase.from("users").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", session.company.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session || session.user.role !== "admin") return unauthorized();
  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase.from("users").delete().eq("id", id).eq("company_id", session.company.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
