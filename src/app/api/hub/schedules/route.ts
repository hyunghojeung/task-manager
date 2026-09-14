export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub, normalizeColor } from "@/lib/hub";
import { sanitizePreviews } from "@/lib/link-preview";

// 한 달치 조회: /api/hub/schedules?from=2026-09-01&to=2026-09-30
// 미완료 전체:  /api/hub/schedules?open=1   (날짜와 상관없이 완료 안 된 것 모두)
export async function GET(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const supabase = getSupabase();

  if (searchParams.get("open")) {
    const { data, error } = await supabase
      .from("hub_schedules")
      .select("id, on_date, title, content, color, done, bold, link_previews")
      .eq("user_id", auth.session.user.id)
      .eq("done", false)
      .order("on_date")
      .order("sort_order")
      .order("created_at")
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = data || [];
    let holidays: { on_date: string; name: string }[] = [];
    if (list.length) {
      const { data: h } = await supabase
        .from("hub_holidays")
        .select("on_date, name")
        .gte("on_date", list[0].on_date)
        .lte("on_date", list[list.length - 1].on_date);
      holidays = h || [];
    }
    return NextResponse.json({ schedules: list, holidays });
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "조회 기간이 필요합니다." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("hub_schedules")
    .select("id, on_date, title, content, color, done, bold, link_previews")
    .eq("user_id", auth.session.user.id)
    .gte("on_date", from)
    .lte("on_date", to)
    .order("on_date")
    .order("done") // 완료한 것은 그날 목록 맨 아래로
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
      bold: body.bold === true,
      link_previews: sanitizePreviews(body.link_previews),
    })
    .select("id, on_date, title, content, color, done, bold, link_previews")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
