export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { bearer, verifyToken } from "@/lib/program-auth";
import { saveRelease } from "@/lib/program-release";

// 빌드 스크립트가 프로그램 토큰(관리자 계정)으로 배포 파일을 올린다 — git 저장소에 zip 을 넣지 않기 위해.
export async function POST(request: NextRequest) {
  const u = await verifyToken(bearer(request));
  if (!u) return NextResponse.json({ error: "다시 로그인해주세요." }, { status: 401 });
  if (u.role !== "admin" && u.role !== "super_admin") return NextResponse.json({ error: "관리자만 올릴 수 있습니다." }, { status: 403 });
  const r = await saveRelease(await request.formData(), u.name || u.user_id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, release: r.release });
}
