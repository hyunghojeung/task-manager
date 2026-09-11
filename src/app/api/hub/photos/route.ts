export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub, normalizeTags } from "@/lib/hub";

// 사진 목록
//   /api/hub/photos              전체 (갤러리 + 메모 첨부)
//   /api/hub/photos?album=ID     그 앨범만
//   /api/hub/photos?q=태그       태그로 검색
//   /api/hub/photos?source=gallery  갤러리에 올린 것만 (메모 첨부 제외)
export async function GET(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const album = searchParams.get("album");
  const source = searchParams.get("source");
  const q = (searchParams.get("q") || "").replace(/^#/, "").trim();

  const supabase = getSupabase();
  let query = supabase
    .from("hub_photos")
    .select("id, url, file_name, caption, tags, album_id, memo_id, created_at")
    .eq("user_id", auth.session.user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (album) query = query.eq("album_id", album);
  // 갤러리 검색은 갤러리에 올린 사진만 본다. 메모에 붙인 사진은 개인메모에서 찾는다.
  if (source === "gallery") query = query.is("memo_id", null);
  if (q) query = query.contains("tags", [q]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photos = data || [];

  // 어디서 온 사진인지 이름을 붙여 준다
  const albumIds = [...new Set(photos.map((p) => p.album_id).filter(Boolean))] as string[];
  const memoIds = [...new Set(photos.map((p) => p.memo_id).filter(Boolean))] as string[];

  const names: Record<string, string> = {};
  if (albumIds.length) {
    const { data: as } = await supabase.from("hub_albums").select("id, name").in("id", albumIds);
    (as || []).forEach((a) => (names["a" + a.id] = a.name));
  }
  if (memoIds.length) {
    const { data: ms } = await supabase.from("hub_memos").select("id, title").in("id", memoIds);
    (ms || []).forEach((m) => (names["m" + m.id] = m.title || "제목 없는 메모"));
  }

  return NextResponse.json({
    photos: photos.map((p) => ({
      ...p,
      source: p.memo_id ? "memo" : "album",
      source_name: p.memo_id ? names["m" + p.memo_id] || "메모" : names["a" + (p.album_id || "")] || "앨범 없음",
    })),
  });
}

// 업로드가 끝난 사진을 앨범이나 메모에 붙인다.
// 파일 자체는 기존 /api/memo/upload 가 Dropbox 에 올리고 주소만 넘어온다.
export async function POST(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const body = await request.json().catch(() => ({}));
  const url = String(body.url || "");
  const memoId = body.memo_id ? String(body.memo_id) : null;
  const albumId = body.album_id ? String(body.album_id) : null;
  if (!url.startsWith("https://")) {
    return NextResponse.json({ error: "사진 주소가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = getSupabase();

  let tags: string[] = [];
  if (memoId) {
    // 메모 첨부: 본인 메모인지 확인하고 그 메모의 태그를 물려준다
    const { data: memo } = await supabase
      .from("hub_memos")
      .select("id, tags")
      .eq("id", memoId)
      .eq("user_id", auth.session.user.id)
      .maybeSingle();
    if (!memo) return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
    tags = Array.isArray(memo.tags) ? memo.tags : [];
  } else {
    // 갤러리 업로드: 올릴 때 입력한 태그를 쓴다
    tags = normalizeTags(body.tags);
    if (albumId) {
      const { data: album } = await supabase
        .from("hub_albums")
        .select("id")
        .eq("id", albumId)
        .eq("user_id", auth.session.user.id)
        .maybeSingle();
      if (!album) return NextResponse.json({ error: "앨범을 찾을 수 없습니다." }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("hub_photos")
    .insert({
      company_id: auth.session.company.id,
      user_id: auth.session.user.id,
      memo_id: memoId,
      album_id: albumId,
      url,
      file_name: body.file_name ? String(body.file_name).slice(0, 255) : null,
      file_size: typeof body.file_size === "number" ? body.file_size : null,
      tags,
    })
    .select("id, url, file_name, memo_id, album_id, tags")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
