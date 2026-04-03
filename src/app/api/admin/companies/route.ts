import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabase();
  const [companiesRes, countsRes] = await Promise.all([
    supabase.from("companies").select("*").order("created_at", { ascending: false }),
    supabase.rpc("get_company_counts"),
  ]);

  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 });

  const countMap: Record<string, { user_count: number; order_count: number; memo_count: number; po_count: number }> = {};
  for (const r of countsRes.data || []) {
    countMap[r.company_id] = { user_count: r.user_count || 0, order_count: r.order_count || 0, memo_count: r.memo_count || 0, po_count: r.po_count || 0 };
  }

  const result = (companiesRes.data || []).map(c => ({
    ...c,
    ...(countMap[c.id] || { user_count: 0, order_count: 0, memo_count: 0, po_count: 0 }),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabase();

    const { adminName, adminUserId, adminPassword, ...companyData } = body;

    // 업체코드 자동생성 (COM00001, COM00002, ...)
    const { data: lastCompany } = await supabase
      .from("companies")
      .select("company_code")
      .like("company_code", "COM%")
      .order("company_code", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastCompany?.company_code) {
      const num = parseInt(lastCompany.company_code.replace("COM", ""));
      if (!isNaN(num)) nextNum = num + 1;
    }
    const autoCode = `COM${String(nextNum).padStart(5, "0")}`;

    // 업체 등록
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        company_code: autoCode,
        company_id: companyData.company_id,
        company_name: companyData.company_name,
        business_number: companyData.business_number || null,
        representative: companyData.representative || null,
        phone: companyData.phone || null,
        fax: companyData.fax || null,
        email: companyData.email || null,
        address: companyData.address || null,
        business_type: companyData.business_type || null,
        business_category: companyData.business_category || null,
        password: companyData.password ,
        status: "active",
      })
      .select("*")
      .single();

    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 500 });
    }

    if (!company) {
      return NextResponse.json({ error: "업체 등록에 실패했습니다." }, { status: 500 });
    }

    // 관리자 사용자 등록
    if (adminUserId && adminName) {
      await supabase.from("users").insert({
        company_id: company.id,
        user_id: adminUserId,
        name: adminName,
        password: adminPassword || companyData.password ,
        role: "admin",
      });
    }

    // 기본 카테고리 등록
    await supabase.from("categories").insert([
      { company_id: company.id, name: "일반", sort_order: 1 },
    ]);

    return NextResponse.json({ success: true, company }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
