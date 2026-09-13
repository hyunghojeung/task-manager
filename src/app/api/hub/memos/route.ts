export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub, normalizeTags } from "@/lib/hub";
import { sanitizePreviews } from "@/lib/link-preview";

/** 본인 카테고리만 붙일 수 있게 확인한다. 아니면 미분류로 둔다 */
async function ownCategory(supabase: ReturnType<typeof getSupabase>, userId: string, v: unknown): Promise<string | null> {
  if (typeof v !== "string" || !v) return null;
  const { data } = await supabase.from("hub_memo_categories").select("id").eq("id", v).eq("user_id", userId).maybeSingle();
  return data ? data.id : null;
}

const FIELDS = "id, title, content, tags, pinned, share_token, link_previews, category_id, updated_at";

// 목록: /api/hub/memos?q=검색어
export async function GET(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").replace(/^#/, "").trim();
  // category=ID 그 카테고리만, category=none 미분류만, 없으면 전체
  const category = (searchParams.get("category") || "").trim();

  const supabase = getSupabase();
  let query = supabase
    .from("hub_memos")
    .select(FIELDS)
    .eq("user_id", auth.session.user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (category === "none") query = query.is("category_id", null);
  else if (category) query = query.eq("category_id", category);

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
  const categoryId = await ownCategory(supabase, auth.session.user.id, body.category_id);
  const { data, error } = await supabase
    .from("hub_memos")
    .insert({
      company_id: auth.session.company.id,
      user_id: auth.session.user.id,
      title: String(body.title || "").slice(0, 255),
      content,
      tags: normalizeTags(body.tags),
      link_previews: sanitizePreviews(body.link_previews),
      category_id: categoryId,
    })
    .select(FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, photos: [] }, { status: 201 });
}
