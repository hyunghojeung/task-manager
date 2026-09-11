export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireHub } from "@/lib/hub";
import { fetchLinkPreview } from "@/lib/link-preview";

// 메모에 적은 주소의 미리보기(제목·설명·대표이미지)를 읽어온다
export async function GET(request: NextRequest) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const url = (searchParams.get("url") || "").trim();
  if (!/^https?:\/\//i.test(url) || url.length > 2000) {
    return NextResponse.json({ error: "주소가 올바르지 않습니다." }, { status: 400 });
  }

  const preview = await fetchLinkPreview(url);
  return NextResponse.json({ preview });
}
