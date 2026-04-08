import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { createCompany } from "@/lib/create-company";

export const dynamic = "force-dynamic";

// 간단한 IP 기반 등록 제한 (시간당 3회)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  if (limit) {
    if (now < limit.resetAt) {
      if (limit.count >= 3) {
        return NextResponse.json({ error: "등록 요청이 너무 많습니다. 1시간 후 다시 시도해주세요." }, { status: 429 });
      }
      limit.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 3600000 });
    }
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600000 });
  }

  try {
    const body = await request.json();
    const { company_id, company_name, password, business_number, representative, phone, email, adminName, adminUserId, adminPassword } = body;

    // 필수 필드 검증
    if (!company_id || !company_name || !password || !business_number || !representative || !phone || !email || !adminName || !adminUserId || !adminPassword) {
      return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 });
    }

    // 업체 ID 형식 검증
    if (!/^[a-z0-9_]{3,30}$/.test(company_id)) {
      return NextResponse.json({ error: "업체 ID는 영문 소문자, 숫자, _ 만 사용 가능합니다. (3~30자)" }, { status: 400 });
    }

    // 비밀번호 길이 검증
    if (password.length < 4) {
      return NextResponse.json({ error: "비밀번호는 4자 이상 입력해주세요." }, { status: 400 });
    }

    // 중복 체크
    const supabase = getSupabase();
    const { data: existing } = await supabase.from("companies").select("id").eq("company_id", company_id).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 업체 ID입니다." }, { status: 409 });
    }

    // 업체 생성
    const result = await createCompany(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, company_id, company_name }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
