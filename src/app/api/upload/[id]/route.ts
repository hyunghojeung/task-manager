import { NextRequest, NextResponse } from "next/server";
import { getApiSession, unauthorized } from "@/lib/api-helpers";
import { getSupabase } from "@/lib/supabase-admin";

async function getDropboxAccessToken(refreshToken: string, appKey: string, appSecret: string): Promise<string> {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Dropbox 토큰 갱신 실패");
  return data.access_token;
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const supabase = getSupabase();

  const { data: att } = await supabase.from("attachments").select("dropbox_path").eq("id", id).single();
  if (!att) return NextResponse.json({ error: "첨부파일을 찾을 수 없습니다." }, { status: 404 });

  const { data: company } = await supabase
    .from("companies")
    .select("dropbox_app_key, dropbox_app_secret, dropbox_access_token")
    .eq("id", session.company.id)
    .single();

  // Dropbox에서 삭제 시도 (실패해도 DB 레코드는 삭제)
  if (company?.dropbox_app_key && company?.dropbox_app_secret && company?.dropbox_access_token && att.dropbox_path) {
    try {
      const accessToken = await getDropboxAccessToken(company.dropbox_access_token, company.dropbox_app_key, company.dropbox_app_secret);
      await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path: att.dropbox_path }),
      });
    } catch { /* ignore */ }
  }

  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
