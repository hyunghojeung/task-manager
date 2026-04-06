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

    // 관리자 user id 찾기
    const adminId = adminUserId ? (await supabase.from("users").select("id").eq("company_id", company.id).eq("user_id", adminUserId).maybeSingle())?.data?.id : null;

    // 테스트 메모 3개 등록
    await supabase.from("memos").insert([
      { company_id: company.id, title: "TEST 첫 번째 업무 메모", content: "테스트용 메모입니다. 자유롭게 수정/삭제하세요.", created_by: adminId },
      { company_id: company.id, title: "TEST 작업 일정 안내", content: "테스트용 메모입니다. 업무 관련 메모를 작성하세요.", created_by: adminId },
      { company_id: company.id, title: "TEST 공지사항", content: "테스트용 메모입니다. 팀 공유 메모로 활용하세요.", created_by: adminId },
    ]);

    // 테스트 발주서 3개 등록
    await supabase.from("purchase_orders").insert([
      { company_id: company.id, po_no: "TEST-001", po_date: new Date().toISOString().slice(0, 10), supplier_name: "TEST 발주처A", orderer: adminName || "관리자", created_by: adminId },
      { company_id: company.id, po_no: "TEST-002", po_date: new Date().toISOString().slice(0, 10), supplier_name: "TEST 발주처B", orderer: adminName || "관리자", created_by: adminId },
      { company_id: company.id, po_no: "TEST-003", po_date: new Date().toISOString().slice(0, 10), supplier_name: "TEST 발주처C", orderer: adminName || "관리자", created_by: adminId },
    ]);

    // 테스트 주문서 3개 등록
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    await supabase.from("orders").insert([
      { company_id: company.id, order_no: `${today}-T1`, order_date: new Date().toISOString().slice(0, 10), client_name: "TEST 거래처A", title: "TEST 샘플 작업 1", orderer: adminName || "관리자", status: "progress", created_by: adminId },
      { company_id: company.id, order_no: `${today}-T2`, order_date: new Date().toISOString().slice(0, 10), client_name: "TEST 거래처B", title: "TEST 샘플 작업 2", orderer: adminName || "관리자", status: "progress", created_by: adminId },
      { company_id: company.id, order_no: `${today}-T3`, order_date: new Date().toISOString().slice(0, 10), client_name: "TEST 거래처C", title: "TEST 샘플 작업 3", orderer: adminName || "관리자", status: "complete", created_by: adminId },
    ]);

    // pwindow의 예전Ecount양식을 기본 폼 양식으로 복사
    const { data: pwindowCompany } = await supabase.from("companies").select("id").eq("company_id", "pwindow").maybeSingle();
    if (pwindowCompany) {
      const { data: ecountTemplate } = await supabase.from("form_templates").select("name, columns, formulas").eq("company_id", pwindowCompany.id).ilike("name", "%Ecount%").maybeSingle();
      if (ecountTemplate) {
        await supabase.from("form_templates").insert({
          company_id: company.id,
          name: ecountTemplate.name,
          columns: ecountTemplate.columns,
          formulas: ecountTemplate.formulas,
          is_default: true,
          sort_order: 0,
        });
      }
    }

    return NextResponse.json({ success: true, company }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
