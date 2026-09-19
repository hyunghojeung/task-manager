import { getSupabase } from "@/lib/supabase-admin";

// 프로그램 배포 파일 올리기 — 관리자 화면(세션)과 빌드 스크립트(프로그램 토큰) 둘 다 이 함수를 쓴다.
export const RELEASE_BUCKET = "downloads";
export const RELEASE_MAX_SIZE = 200 * 1024 * 1024;
export const RELEASE_KEYS = ["imposition"] as const;

export async function saveRelease(form: FormData, uploadedBy: string): Promise<{ ok: true; release: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  const file = form.get("file") as File | null;
  const key = String(form.get("key") || "");
  const version = String(form.get("version") || "").trim();
  const note = String(form.get("note") || "").trim();
  if (!file) return { ok: false, error: "파일이 없습니다.", status: 400 };
  if (!RELEASE_KEYS.includes(key as typeof RELEASE_KEYS[number])) return { ok: false, error: "잘못된 프로그램 종류입니다.", status: 400 };
  if (file.size > RELEASE_MAX_SIZE) return { ok: false, error: "파일은 200MB 이하만 올릴 수 있습니다.", status: 400 };
  if (!/\.(exe|zip|msi)$/i.test(file.name)) return { ok: false, error: "exe, zip, msi 파일만 올릴 수 있습니다.", status: 400 };

  const supabase = getSupabase();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${key}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from(RELEASE_BUCKET).upload(path, buffer, { contentType: "application/octet-stream", upsert: true });
  if (upErr) return { ok: false, error: upErr.message, status: 500 };

  const row = { key, file_name: safeName, version, size_bytes: file.size, storage_path: path, note, uploaded_by: uploadedBy, updated_at: new Date().toISOString() };
  const { error: dbErr } = await supabase.from("program_releases").upsert(row, { onConflict: "key" });
  if (dbErr) return { ok: false, error: dbErr.message, status: 500 };
  return { ok: true, release: row };
}
