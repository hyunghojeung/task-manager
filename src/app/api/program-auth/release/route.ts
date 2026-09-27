export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { bearer, verifyToken } from "@/lib/program-auth";
import { saveRelease } from "@/lib/program-release";
import { getSupabase } from "@/lib/supabase-admin";

// 빌드 스크립트가 프로그램 토큰(관리자 계정)으로 배포 파일을 올린다 — git 저장소에 zip 을 넣지 않기 위해.
export async function POST(request: NextRequest) {
  const u = await verifyToken(bearer(request));
  if (!u) return NextResponse.json({ error: "다시 로그인해주세요." }, { status: 401 });
  if (u.role !== "admin" && u.role !== "super_admin") return NextResponse.json({ error: "관리자만 올릴 수 있습니다." }, { status: 403 });
  const r = await saveRelease(await request.formData(), u.name || u.user_id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, release: r.release });
}

// 프로그램이 "새 버전 있나요?" 하고 묻는다 — 프로그램 토큰으로 확인하고, 있으면 10분짜리 내려받기 주소를 준다.
export async function GET(request: NextRequest) {
  const u = await verifyToken(bearer(request));
  if (!u) return NextResponse.json({ error: "다시 로그인해주세요." }, { status: 401 });
  const key = u.product === "bprint" ? "bprint" : "imposition";   // 토큰의 제품만 볼 수 있다
  const supabase = getSupabase();
  const { data } = await supabase.from("program_releases")
    .select("key, file_name, version, size_bytes, note, storage_path, updated_at").eq("key", key).maybeSingle();
  if (!data?.storage_path) return NextResponse.json({ error: "올라온 배포본이 없습니다." }, { status: 404 });
  const ver = String(data.version || "").trim().replace(/[^\w.\-]+/g, "");
  const dlName = ver ? data.file_name.replace(/(\.[A-Za-z0-9]+)$/, `_v${ver}$1`) : data.file_name;
  const { data: signed } = await supabase.storage.from("downloads").createSignedUrl(data.storage_path, 60 * 10, { download: dlName });
  return NextResponse.json({
    key: data.key, version: data.version, file_name: data.file_name, size_bytes: data.size_bytes,
    note: data.note, updated_at: data.updated_at, url: signed?.signedUrl || "",
  });
}
