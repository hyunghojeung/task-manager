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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabase();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.slice(0, 255);
  if (typeof body.content === "string") patch.content = body.content;
  if (Array.isArray(body.tags)) patch.tags = normalizeTags(body.tags);
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
  if ("category_id" in body) patch.category_id = await ownCategory(supabase, auth.session.user.id, body.category_id);

  if ("link_previews" in body) patch.link_previews = sanitizePreviews(body.link_previews);

  const { data, error } = await supabase
    .from("hub_memos")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .select(FIELDS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });

  // 태그가 바뀌면 첨부 사진의 태그도 함께 맞춘다
  if (patch.tags) {
    await supabase
      .from("hub_photos")
      .update({ tags: patch.tags })
      .eq("memo_id", id)
      .eq("user_id", auth.session.user.id);
  }

  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const supabase = getSupabase();
  // hub_photos 는 memo_id 에 ON DELETE CASCADE 가 걸려 있어 함께 지워진다
  const { error } = await supabase
    .from("hub_memos")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
