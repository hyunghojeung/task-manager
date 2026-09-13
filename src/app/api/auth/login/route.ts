import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase-admin";

/** LIKE 패턴 문자를 글자 그대로 찾게 한다 */
function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // 폰 키보드가 첫 글자를 대문자로 바꾸거나 뒤에 공백을 붙이는 일이 잦다.
  // 아이디는 대소문자·앞뒤 공백을 가리지 않고 찾는다 (비밀번호는 그대로).
  const companyId = String(body.companyId || "").trim();
  const userId = String(body.userId || "").trim();
  const password = body.password;

  if (!companyId || !userId || !password) {
    return NextResponse.json(
      { error: "모든 필드를 입력해주세요." },
      { status: 400 }
    );
  }

  // 1. 업체 조회
  const { data: companies, error: companyError } = await getSupabase()
    .from("companies")
    .select("*")
    .ilike("company_id", escapeLike(companyId))
    .eq("status", "active");
  const company = (companies || []).find((c) => c.company_id.toLowerCase() === companyId.toLowerCase());

  if (companyError || !company) {
    // 원인 추적용 — 무엇이 들어왔는지 (비밀번호는 남기지 않는다)
    console.warn(`[login] 업체 없음: "${companyId}" (길이 ${companyId.length}) / 사용자 "${userId}"`);
    return NextResponse.json(
      { error: "존재하지 않는 업체이거나 비활성 상태입니다." },
      { status: 401 }
    );
  }

  // 2. 사용자 조회
  const { data: user, error: userError } = await getSupabase()
    .from("users")
    .select("*")
    .eq("company_id", company.id)
    .eq("user_id", userId)
    .eq("password", password)
    .single();

  if (userError || !user) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  // 3. 세션 쿠키 설정
  const sessionData = JSON.stringify({
    company: {
      id: company.id,
      company_id: company.company_id,
      company_name: company.company_name,
      business_number: company.business_number,
      representative: company.representative,
      phone: company.phone,
      fax: company.fax,
      email: company.email,
      address: company.address,
      business_type: company.business_type,
      business_category: company.business_category,
    },
    user: {
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      role: user.role,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("session", sessionData, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24시간
    path: "/",
  });

  // 업무관리 권한 여부 — 로그인 후 어디로 보낼지 화면에서 정한다
  return NextResponse.json({ success: true, hub_enabled: !!user.hub_enabled });
}
