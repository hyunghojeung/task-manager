import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabase();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = [];
  for (const company of companies || []) {
    const { count: userCount } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("company_id", company.id);
    const { count: orderCount } = await supabase.from("orders").select("*", { count: "exact", head: true }).eq("company_id", company.id);
    const { count: memoCount } = await supabase.from("memos").select("*", { count: "exact", head: true }).eq("company_id", company.id);
    const { count: poCount } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("company_id", company.id);
    result.push({ ...company, user_count: userCount || 0, order_count: orderCount || 0, memo_count: memoCount || 0, po_count: poCount || 0 });
  }

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
