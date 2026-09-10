export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub, extractTags } from "@/lib/hub";

// 업로드가 끝난 사진을 메모에 붙인다.
// 파일 자체는 기존 /api/memo/upload 가 Dropbox 에 올리고 주소만 넘어온다.
export async function POST(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const body = await request.json().catch(() => ({}));
  const url = String(body.url || "");
  const memoId = body.memo_id ? String(body.memo_id) : null;
  if (!url.startsWith("https://")) {
    return NextResponse.json({ error: "사진 주소가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = getSupabase();

  // 본인 메모인지 확인하고, 그 메모의 태그를 물려준다
  let tags: string[] = [];
  if (memoId) {
    const { data: memo } = await supabase
      .from("hub_memos")
      .select("id, content")
      .eq("id", memoId)
      .eq("user_id", auth.session.user.id)
      .maybeSingle();
    if (!memo) return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
    tags = extractTags(memo.content || "");
  }

  const { data, error } = await supabase
    .from("hub_photos")
    .insert({
      company_id: auth.session.company.id,
      user_id: auth.session.user.id,
      memo_id: memoId,
      url,
      file_name: body.file_name ? String(body.file_name).slice(0, 255) : null,
      file_size: typeof body.file_size === "number" ? body.file_size : null,
      tags,
    })
    .select("id, url, file_name, memo_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
