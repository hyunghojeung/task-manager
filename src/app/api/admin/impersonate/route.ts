export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const { companyId } = await request.json();
  if (!companyId) return NextResponse.json({ error: "companyId 필요" }, { status: 400 });

  const supabase = getSupabase();
  const { data: company } = await supabase.from("companies").select("*").eq("company_id", companyId).single();
  if (!company) return NextResponse.json({ error: "회사를 찾을 수 없습니다" }, { status: 404 });

  // 해당 회사의 admin 사용자 조회 (없으면 아무 사용자)
  const { data: adminUser } = await supabase.from("users").select("*").eq("company_id", company.id).eq("role", "admin").limit(1).maybeSingle();
  const { data: anyUser } = adminUser ? { data: adminUser } : await supabase.from("users").select("*").eq("company_id", company.id).limit(1).maybeSingle();
  const user = adminUser || anyUser;

  if (!user) return NextResponse.json({ error: "회사에 사용자가 없습니다" }, { status: 404 });

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
      role: "admin", // 수퍼관리자는 항상 admin 권한
    },
    impersonated: true,
  });

  const cookieStore = await cookies();
  cookieStore.set("session", sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
