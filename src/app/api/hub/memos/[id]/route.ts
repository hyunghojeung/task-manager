export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub, normalizeTags } from "@/lib/hub";
import { sanitizePreviews } from "@/lib/link-preview";

const FIELDS = "id, title, content, tags, pinned, share_token, link_previews, updated_at";

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
