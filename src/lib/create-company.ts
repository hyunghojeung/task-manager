import { getSupabase } from "@/lib/supabase-admin";

interface CreateCompanyParams {
  company_id: string;
  company_name: string;
  password: string;
  business_number?: string;
  representative?: string;
  phone?: string;
  fax?: string;
  email?: string;
  address?: string;
  business_type?: string;
  business_category?: string;
  adminName: string;
  adminUserId: string;
  adminPassword?: string;
}

export async function createCompany(params: CreateCompanyParams): Promise<{ success: true; company: Record<string, unknown> } | { success: false; error: string; status: number }> {
  const supabase = getSupabase();
  const { adminName, adminUserId, adminPassword, ...companyData } = params;

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
      password: companyData.password,
      status: "active",
    })
    .select("*")
    .single();

  if (companyError) {
    if (companyError.message.includes("duplicate") || companyError.message.includes("unique")) {
      return { success: false, error: "이미 사용 중인 업체 ID입니다.", status: 409 };
    }
    return { success: false, error: companyError.message, status: 500 };
  }

  if (!company) {
    return { success: false, error: "업체 등록에 실패했습니다.", status: 500 };
  }

  // 관리자 사용자 등록
  if (adminUserId && adminName) {
    await supabase.from("users").insert({
      company_id: company.id,
      user_id: adminUserId,
      name: adminName,
      password: adminPassword || companyData.password,
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

  // pwindow의 양식 중 지정된 3개(부가세포함, 부가세별도, 현금가격양식)만 복사
  const TARGET_TEMPLATES = ["부가세포함", "부가세별도", "현금가격양식"];
  const { data: pwindowCompany } = await supabase.from("companies").select("id").eq("company_id", "pwindow").maybeSingle();
  if (pwindowCompany) {
    const { data: pwindowTemplates } = await supabase.from("form_templates").select("name, columns, formulas, sort_order").eq("company_id", pwindowCompany.id).in("name", TARGET_TEMPLATES);
    if (pwindowTemplates && pwindowTemplates.length > 0) {
      // 지정된 순서대로 정렬
      const sorted = TARGET_TEMPLATES
        .map(name => pwindowTemplates.find(t => t.name === name))
        .filter((t): t is NonNullable<typeof t> => !!t);
      await supabase.from("form_templates").insert(
        sorted.map((t, i) => ({
          company_id: company.id,
          name: t.name,
          columns: t.columns,
          formulas: t.formulas,
          is_default: i === 0,
          sort_order: i,
        }))
      );
    }
  }

  return { success: true, company };
}
