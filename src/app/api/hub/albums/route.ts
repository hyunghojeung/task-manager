export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub } from "@/lib/hub";

// 앨범 목록 — 장수와 대표 사진을 함께 계산해서 돌려준다
export async function GET() {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const supabase = getSupabase();
  const { data: albums, error } = await supabase
    .from("hub_albums")
    .select("id, name, created_at")
    .eq("user_id", auth.session.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: photos } = await supabase
    .from("hub_photos")
    .select("id, url, album_id, tags, created_at")
    .eq("user_id", auth.session.user.id)
    .not("album_id", "is", null)
    .order("created_at", { ascending: false });

  const list = (albums || []).map((a) => {
    const mine = (photos || []).filter((p) => p.album_id === a.id);
    const tags: string[] = [];
    mine.forEach((p) => (p.tags || []).forEach((t: string) => { if (!tags.includes(t)) tags.push(t); }));
    return { ...a, count: mine.length, cover: mine[0]?.url || null, tags: tags.slice(0, 6) };
  });

  return NextResponse.json({ albums: list });
}

export async function POST(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 100);
  if (!name) return NextResponse.json({ error: "앨범 이름을 입력하세요." }, { status: 400 });

  const supabase = getSupabase();
  // 같은 이름이 이미 있으면 그것을 쓴다
  const { data: exist } = await supabase
    .from("hub_albums")
    .select("id, name")
    .eq("user_id", auth.session.user.id)
    .eq("name", name)
    .maybeSingle();
  if (exist) return NextResponse.json(exist);

  const { data, error } = await supabase
    .from("hub_albums")
    .insert({ company_id: auth.session.company.id, user_id: auth.session.user.id, name })
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
