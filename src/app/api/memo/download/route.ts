export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

// Dropbox URL과 원본 파일명을 받아 파일을 프록시하여 다운로드
// Content-Disposition 헤더에 UTF-8 인코딩된 파일명을 설정하여 한글 파일명 유지
export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const name = searchParams.get("name") || "download";
  if (!url) return NextResponse.json({ error: "url 필요" }, { status: 400 });

  try {
    // Dropbox에서 파일 가져오기 (raw=1 URL)
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "파일 가져오기 실패" }, { status: 500 });

    const buffer = await res.arrayBuffer();
    // RFC 5987 - UTF-8 인코딩된 파일명 (한글 등 비ASCII 문자 지원)
    const encodedName = encodeURIComponent(name);
    const contentType = res.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "다운로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
