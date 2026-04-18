export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

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
  const session = await getApiSession();
  if (!session) return unauthorized();
  // pwindow 업체만 허용
  if (session.company.company_id !== "pwindow") {
    return NextResponse.json({ error: "첨부파일 기능과 게시판 본문의 이미지 복사붙혀넣기 기능은 현재 준비중입니다" }, { status: 403 });
  }

  const supabase = getSupabase();
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

    // 한글 파일명 유지 (Dropbox는 Unicode 파일명 지원)
    const timestamp = Date.now();
    const origName = file.name || "file.bin";
    // 파일명에 사용할 수 없는 문자만 제거 (한글은 유지)
    const cleanName = origName.replace(/[\/\\:*?"<>|]/g, "_");
    // 타임스탬프 접두어로 중복 방지
    const safeName = `${timestamp}_${cleanName}`;
    const uploadPath = `/bcount-momo/${safeName}`;
    const fileBuffer = await file.arrayBuffer();

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

    const shareRes = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ path: uploadData.path_display, settings: { requested_visibility: "public" } }),
    });
    const shareData = await shareRes.json();

    let shareUrl = "";
    if (shareData.url) {
      shareUrl = shareData.url.replace("dl=0", "raw=1").replace("?dl=0", "?raw=1");
    } else if (shareData.error?.[".tag"] === "shared_link_already_exists") {
      const listRes = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path: uploadData.path_display, direct_only: true }),
      });
      const listData = await listRes.json();
      if (listData.links?.[0]?.url) {
        shareUrl = listData.links[0].url.replace("dl=0", "raw=1").replace("?dl=0", "?raw=1");
      }
    }

    if (!shareUrl) {
      return NextResponse.json({ error: "공유 링크 생성 실패", dropbox_error: shareData, path: uploadData.path_display }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: shareUrl, path: uploadData.path_display, file_name: file.name, file_size: file.size });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "업로드 실패" }, { status: 500 });
  }
}
