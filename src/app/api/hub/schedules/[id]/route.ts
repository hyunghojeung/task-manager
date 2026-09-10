export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub, normalizeColor } from "@/lib/hub";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const body = await request.json();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 255) || "새 항목";
  if ("content" in body) patch.content = body.content ? String(body.content) : null;
  if ("color" in body) patch.color = normalizeColor(body.color);
  if (typeof body.done === "boolean") patch.done = body.done;

  const supabase = getSupabase();
  // user_id 조건으로 본인 것만 수정되게 한다
  const { data, error } = await supabase
    .from("hub_schedules")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .select("id, on_date, title, content, color, done")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("hub_schedules")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
