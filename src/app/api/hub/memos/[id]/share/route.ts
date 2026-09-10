export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub } from "@/lib/hub";

function makeToken() {
  const s = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 16; i++) out += s.charAt(Math.floor(Math.random() * s.length));
  return out;
}

// 공유 켜기 — 추측할 수 없는 주소를 만들어 준다
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const supabase = getSupabase();

  const { data: memo } = await supabase
    .from("hub_memos")
    .select("id, share_token")
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .maybeSingle();
  if (!memo) return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
  if (memo.share_token) return NextResponse.json({ share_token: memo.share_token });

  const { data, error } = await supabase
    .from("hub_memos")
    .update({ share_token: makeToken() })
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .select("share_token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// 공유 중지 — 주소를 지운다. 다시 켜면 새 주소가 나오므로 예전 링크는 계속 막힌다.
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("hub_memos")
    .update({ share_token: null })
    .eq("id", id)
    .eq("user_id", auth.session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
