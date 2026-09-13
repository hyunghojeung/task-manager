export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub } from "@/lib/hub";
import { isSafeUrl } from "@/lib/link-preview";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * 링크 카드의 대표 이미지를 우리 서버가 대신 받아 전달한다.
 * 네이버·유튜브처럼 다른 사이트에서 이미지를 직접 가져가는 걸 막는 곳도
 * 카톡처럼 보이게 하기 위해서다.
 *
 *   /api/hub/link-image?u=이미지주소            로그인한 업무관리 사용자
 *   /api/hub/link-image?u=이미지주소&t=공유토큰  공유받은 사람 (그 메모의 카드 이미지만)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const u = (searchParams.get("u") || "").trim();
  const t = (searchParams.get("t") || "").trim();
  if (!/^https?:\/\//i.test(u) || u.length > 2000) {
    return NextResponse.json({ error: "주소가 올바르지 않습니다." }, { status: 400 });
  }

  if (t) {
    // 공유 링크로 온 요청: 그 메모의 카드에 실제로 쓰인 이미지인지 확인한다
    if (!/^[a-z0-9]{8,32}$/.test(t)) return new NextResponse(null, { status: 403 });
    const supabase = getSupabase();
    const { data: memo } = await supabase.from("hub_memos").select("link_previews").eq("share_token", t).maybeSingle();
    const ok = Array.isArray(memo?.link_previews) && memo!.link_previews.some((p: { image?: string }) => p?.image === u);
    if (!ok) return new NextResponse(null, { status: 403 });
  } else {
    const auth = await requireHub();
    if (!auth.ok) return auth.res;
  }

  const target = await isSafeUrl(u);
  if (!target) return new NextResponse(null, { status: 400 });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(target.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        // 이미지가 실린 사이트에서 온 것처럼 보이게 한다
        Referer: `${target.protocol}//${target.hostname}/`,
      },
    });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) return new NextResponse(null, { status: 404 });

    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return new NextResponse(null, { status: 413 });

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return new NextResponse(null, { status: 413 });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
