export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub, normalizeTags } from "@/lib/hub";
import { sanitizePreviews } from "@/lib/link-preview";

const FIELDS = "id, title, content, tags, pinned, share_token, link_previews, updated_at";

// 목록: /api/hub/memos?q=검색어
export async function GET(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").replace(/^#/, "").trim();

  const supabase = getSupabase();
  let query = supabase
    .from("hub_memos")
    .select(FIELDS)
    .eq("user_id", auth.session.user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (q) {
    // 제목·본문 글자 또는 태그로 찾는다
    const like = `%${q.replace(/[%_]/g, "")}%`;
    query = query.or(`title.ilike.${like},content.ilike.${like},tags.cs.{"${q}"}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const memos = data || [];
  if (memos.length === 0) return NextResponse.json({ memos: [] });

  // 각 메모의 첨부 사진을 함께 실어 보낸다
  const { data: photos } = await supabase
    .from("hub_photos")
    .select("id, url, file_name, memo_id")
    .eq("user_id", auth.session.user.id)
    .in("memo_id", memos.map((m) => m.id))
    .order("sort_order")
    .order("created_at");

  const byMemo: Record<string, typeof photos> = {};
  (photos || []).forEach((p) => {
    if (!p.memo_id) return;
    (byMemo[p.memo_id] = byMemo[p.memo_id] || []).push(p);
  });

  return NextResponse.json({
    memos: memos.map((m) => ({ ...m, photos: byMemo[m.id] || [] })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const body = await request.json().catch(() => ({}));
  const content = String(body.content || "");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("hub_memos")
    .insert({
      company_id: auth.session.company.id,
      user_id: auth.session.user.id,
      title: String(body.title || "").slice(0, 255),
      content,
      tags: normalizeTags(body.tags),
      link_previews: sanitizePreviews(body.link_previews, content),
    })
    .select(FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, photos: [] }, { status: 201 });
}
