export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub, normalizeColor } from "@/lib/hub";

// 한 달치 조회: /api/hub/schedules?from=2026-09-01&to=2026-09-30
export async function GET(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "조회 기간이 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("hub_schedules")
    .select("id, on_date, title, content, color, done")
    .eq("user_id", auth.session.user.id)
    .gte("on_date", from)
    .lte("on_date", to)
    .order("on_date")
    .order("sort_order")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: holidays } = await supabase
    .from("hub_holidays")
    .select("on_date, name")
    .gte("on_date", from)
    .lte("on_date", to);

  return NextResponse.json({ schedules: data || [], holidays: holidays || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const body = await request.json();
  const onDate = String(body.on_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(onDate)) {
    return NextResponse.json({ error: "날짜가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("hub_schedules")
    .insert({
      company_id: auth.session.company.id,
      user_id: auth.session.user.id,
      on_date: onDate,
      title: String(body.title || "").trim().slice(0, 255) || "새 항목",
      content: body.content ? String(body.content) : null,
      color: normalizeColor(body.color),
    })
    .select("id, on_date, title, content, color, done")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
