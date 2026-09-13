export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub } from "@/lib/hub";

// 카테고리 목록 — 각 카테고리의 메모 수와 미분류 수를 함께 준다
export async function GET() {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const supabase = getSupabase();
  const { data: cats, error } = await supabase
    .from("hub_memo_categories")
    .select("id, name, sort_order")
    .eq("user_id", auth.session.user.id)
    .order("sort_order")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: memos } = await supabase
    .from("hub_memos")
    .select("category_id")
    .eq("user_id", auth.session.user.id);

  const counts: Record<string, number> = {};
  let none = 0;
  (memos || []).forEach((m) => {
    if (m.category_id) counts[m.category_id] = (counts[m.category_id] || 0) + 1;
    else none += 1;
  });

  return NextResponse.json({
    categories: (cats || []).map((c) => ({ ...c, count: counts[c.id] || 0 })),
    none,
    total: (memos || []).length,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 50);
  if (!name) return NextResponse.json({ error: "카테고리 이름을 입력하세요." }, { status: 400 });

  const supabase = getSupabase();
  const { data: exist } = await supabase
    .from("hub_memo_categories")
    .select("id, name, sort_order")
    .eq("user_id", auth.session.user.id)
    .eq("name", name)
    .maybeSingle();
  if (exist) return NextResponse.json({ ...exist, count: 0 });

  const { count } = await supabase
    .from("hub_memo_categories")
    .select("*", { count: "exact", head: true })
    .eq("user_id", auth.session.user.id);

  const { data, error } = await supabase
    .from("hub_memo_categories")
    .insert({ company_id: auth.session.company.id, user_id: auth.session.user.id, name, sort_order: count || 0 })
    .select("id, name, sort_order")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, count: 0 }, { status: 201 });
}
