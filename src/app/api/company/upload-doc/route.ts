export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
const ALLOWED_KINDS = ["bankbook", "biz_reg"] as const;
const BUCKET = "company-docs";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  if (session.user.role !== "admin") return NextResponse.json({ error: "관리자만 업로드할 수 있습니다." }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const kind = String(formData.get("kind") || "");
  const slot = parseInt(String(formData.get("slot") || "0"));

  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  if (!ALLOWED_KINDS.includes(kind as typeof ALLOWED_KINDS[number])) {
    return NextResponse.json({ error: "잘못된 파일 종류입니다." }, { status: 400 });
  }
  if (slot < 1 || slot > 3) return NextResponse.json({ error: "잘못된 슬롯 번호입니다." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "파일은 20MB 이하만 가능합니다." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "PNG, JPG, PDF만 업로드 가능합니다." }, { status: 400 });

  const supabase = getSupabase();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${session.company.id}/${kind}/${slot}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  // 서명 URL 대신, DB에는 경로만 저장하고 다운로드 시 서명 URL 발급하는 방식이 안전하지만
  // 여기서는 관리 편의를 위해 서명 URL을 길게(1년) 발급해 저장
  const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !signed?.signedUrl) return NextResponse.json({ error: signErr?.message || "URL 생성 실패" }, { status: 500 });

  // companies 테이블에 URL 저장
  const column = kind === "bankbook" ? `bankbook_url_${slot}` : `biz_reg_url_${slot}`;
  const { error: updErr } = await supabase.from("companies").update({ [column]: signed.signedUrl }).eq("id", session.company.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl, path, column });
}

// 파일 삭제
export async function DELETE(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  if (session.user.role !== "admin") return NextResponse.json({ error: "관리자만 삭제할 수 있습니다." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") || "";
  const slot = parseInt(searchParams.get("slot") || "0");

  if (!ALLOWED_KINDS.includes(kind as typeof ALLOWED_KINDS[number])) {
    return NextResponse.json({ error: "잘못된 파일 종류입니다." }, { status: 400 });
  }
  if (slot < 1 || slot > 3) return NextResponse.json({ error: "잘못된 슬롯 번호입니다." }, { status: 400 });

  const supabase = getSupabase();
  const prefix = `${session.company.id}/${kind}/`;
  const { data: list } = await supabase.storage.from(BUCKET).list(`${session.company.id}/${kind}`);
  if (list) {
    const toDelete = list.filter(f => f.name.startsWith(`${slot}.`)).map(f => `${prefix}${f.name}`);
    if (toDelete.length > 0) await supabase.storage.from(BUCKET).remove(toDelete);
  }

  const column = kind === "bankbook" ? `bankbook_url_${slot}` : `biz_reg_url_${slot}`;
  await supabase.from("companies").update({ [column]: null }).eq("id", session.company.id);

  return NextResponse.json({ ok: true });
}
