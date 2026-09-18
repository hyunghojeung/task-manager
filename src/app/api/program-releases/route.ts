export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

// 프로그램 배포 (Bcount 임포지션 exe 등)
// 파일은 Storage 비공개 버킷 'downloads' 에 두고, 내려받을 때 서명 URL을 발급한다 (로그인한 사용자만).
const BUCKET = "downloads";
const MAX_SIZE = 200 * 1024 * 1024;
const KEYS = ["imposition"] as const;

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

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const key = String(form.get("key") || "");
  const version = String(form.get("version") || "").trim();
  const note = String(form.get("note") || "").trim();
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  if (!KEYS.includes(key as typeof KEYS[number])) return NextResponse.json({ error: "잘못된 프로그램 종류입니다." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "파일은 200MB 이하만 올릴 수 있습니다." }, { status: 400 });
  if (!/\.(exe|zip|msi)$/i.test(file.name)) return NextResponse.json({ error: "exe, zip, msi 파일만 올릴 수 있습니다." }, { status: 400 });

  const supabase = getSupabase();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${key}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: "application/octet-stream", upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const row = { key, file_name: safeName, version, size_bytes: file.size, storage_path: path, note, uploaded_by: session.user.name || session.user.user_id || "", updated_at: new Date().toISOString() };
  const { error: dbErr } = await supabase.from("program_releases").upsert(row, { onConflict: "key" });
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ success: true, release: row });
}
