export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

async function getDropboxAccessToken(refreshToken: string, appKey: string, appSecret: string): Promise<string> {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: appKey, client_secret: appSecret }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Dropbox 토큰 갱신 실패");
  return data.access_token;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  // pwindow 회사의 Dropbox 설정 사용
  const { data: company } = await supabase
    .from("companies")
    .select("dropbox_app_key, dropbox_app_secret, dropbox_access_token")
    .eq("company_id", "pwindow")
    .single();

  if (!company?.dropbox_app_key || !company?.dropbox_app_secret || !company?.dropbox_access_token) {
    return NextResponse.json({ error: "Dropbox 설정이 완료되지 않았습니다." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

    const accessToken = await getDropboxAccessToken(company.dropbox_access_token, company.dropbox_app_key, company.dropbox_app_secret);

    const timestamp = Date.now();
    const safeName = `img_${timestamp}_${Math.random().toString(36).slice(2, 8)}.png`;
    const uploadPath = `/bcount_board-images/${safeName}`;
    const fileBuffer = await file.arrayBuffer();

    // Dropbox-API-Arg 헤더에서 비ASCII 문자 이스케이프
    const argJson = JSON.stringify({ path: uploadPath, mode: "add", autorename: true, mute: false });
    let argHeader = "";
    for (let i = 0; i < argJson.length; i++) {
      const code = argJson.charCodeAt(i);
      argHeader += code < 128 ? argJson[i] : "\\u" + code.toString(16).padStart(4, "0");
    }

    const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": argHeader,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error_summary || "Dropbox 업로드 실패");

    // 공유 링크 생성
    let shareUrl = "";
    try {
      const shareRes = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path: uploadData.path_display }),
      });
      const shareData = await shareRes.json();
      // dl=0 → dl=1로 변경하여 직접 이미지 URL로 사용
      shareUrl = (shareData.url || "").replace("dl=0", "raw=1");
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, url: shareUrl, path: uploadData.path_display });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "업로드 실패" }, { status: 500 });
  }
}
