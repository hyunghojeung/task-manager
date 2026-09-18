export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";
import { getCompanyFeatures } from "@/lib/features";

const BUCKET = "downloads";
// Storage에 올린 것이 없을 때의 예비 파일 (저장소에 함께 들어 있는 초기 배포본)
const FALLBACK: Record<string, string> = { imposition: "/downloads/BcountImposition.zip" };

// 내려받기: 로그인한 사용자에게 10분짜리 서명 URL로 보낸다
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { key } = await params;
  if (key === "imposition" && !(await getCompanyFeatures(session.company.id)).imposition) {
    return NextResponse.json({ error: "이 업체는 임포지션 기능을 사용할 수 없습니다." }, { status: 403 });
  }
  const supabase = getSupabase();
  const { data } = await supabase.from("program_releases").select("storage_path, file_name").eq("key", key).maybeSingle();
  if (data?.storage_path) {
    const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(data.storage_path, 60 * 10, { download: data.file_name });
    if (!error && signed?.signedUrl) return NextResponse.redirect(signed.signedUrl, 302);
  }
  // 프록시 뒤(Railway)에서는 request.url 이 내부 주소(localhost:8080)라 절대 URL을 만들면 안 된다 → 상대 경로로 보낸다
  if (FALLBACK[key]) return new NextResponse(null, { status: 302, headers: { Location: FALLBACK[key] } });
  return NextResponse.json({ error: "아직 올라온 프로그램이 없습니다." }, { status: 404 });
}
