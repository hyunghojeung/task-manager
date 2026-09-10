export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub } from "@/lib/hub";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 100);
  if (!name) return NextResponse.json({ error: "앨범 이름을 입력하세요." }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("hub_albums")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .select("id, name")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "앨범을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(data);
}

// 앨범만 지운다. 사진은 남고 소속만 풀린다.
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("hub_albums")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
