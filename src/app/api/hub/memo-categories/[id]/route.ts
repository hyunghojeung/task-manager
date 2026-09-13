export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub } from "@/lib/hub";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 50);
  if (!name) return NextResponse.json({ error: "카테고리 이름을 입력하세요." }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("hub_memo_categories")
    .update({ name })
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .select("id, name, sort_order")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(data);
}

// 카테고리만 지운다. 그 안의 메모는 미분류가 된다 (FK ON DELETE SET NULL)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("hub_memo_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
