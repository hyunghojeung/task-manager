import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabase();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const companyIds = (companies || []).map(c => c.id);
  if (companyIds.length === 0) return NextResponse.json([]);

  // 모든 카운트를 병렬로 한 번에 조회
  const [usersRes, ordersRes, memosRes, posRes] = await Promise.all([
    supabase.from("users").select("company_id", { count: "exact" }).in("company_id", companyIds),
    supabase.from("orders").select("company_id", { count: "exact" }).in("company_id", companyIds),
    supabase.from("memos").select("company_id", { count: "exact" }).in("company_id", companyIds),
    supabase.from("purchase_orders").select("company_id", { count: "exact" }).in("company_id", companyIds),
  ]);

  // company_id별 카운트 맵 생성
  function countByCompany(rows: { company_id: string }[] | null) {
    const map: Record<string, number> = {};
    for (const r of rows || []) {
      map[r.company_id] = (map[r.company_id] || 0) + 1;
    }
    return map;
  }

  const userMap = countByCompany(usersRes.data as { company_id: string }[] | null);
  const orderMap = countByCompany(ordersRes.data as { company_id: string }[] | null);
  const memoMap = countByCompany(memosRes.data as { company_id: string }[] | null);
  const poMap = countByCompany(posRes.data as { company_id: string }[] | null);

  const result = (companies || []).map(c => ({
    ...c,
    user_count: userMap[c.id] || 0,
    order_count: orderMap[c.id] || 0,
    memo_count: memoMap[c.id] || 0,
    po_count: poMap[c.id] || 0,
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
