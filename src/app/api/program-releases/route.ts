export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";
import { saveRelease } from "@/lib/program-release";

// 프로그램 배포 (Bcount 임포지션 exe 등)
// 파일은 Storage 비공개 버킷 'downloads' 에 두고, 내려받을 때 서명 URL을 발급한다 (로그인한 사용자만).

function fallbackInfo(): { version: string; date?: string; file?: string; size_bytes?: number; notes?: string } | null {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "public", "downloads", "version.json"), "utf-8"));
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const supabase = getSupabase();
  const { data, error } = await supabase.from("program_releases").select("key, file_name, version, size_bytes, note, uploaded_by, updated_at").order("key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data || [];
  // 관리자가 올린 파일이 없으면 저장소에 든 예비 배포본(public/downloads/version.json)의 버전을 보여 준다
  if (!rows.some((r) => r.key === "imposition")) {
    const fb = fallbackInfo();
    if (fb) rows.push({ key: "imposition", file_name: fb.file || "BcountImposition.zip", version: fb.version, size_bytes: fb.size_bytes || 0, note: fb.notes || "", uploaded_by: "저장소 예비 배포본", updated_at: fb.date ? fb.date + "T00:00:00+09:00" : "" });
  }
  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  if (session.user.role !== "admin" && session.user.role !== "super_admin") return NextResponse.json({ error: "관리자만 올릴 수 있습니다." }, { status: 403 });
  const r = await saveRelease(await request.formData(), session.user.name || session.user.user_id || "");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, release: r.release });
}
