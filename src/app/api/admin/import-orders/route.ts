export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

interface CsvRow {
  작성일: string; 순번: string; 주문자: string; 연락처: string;
  거래처코드: string; 거래처명: string; 제품형태: string; 제목: string;
  거래유형: string; 선금: string; 납기일자: string; "세부사양/후가공": string;
  품목코드: string; 품목명: string; 규격: string; 수량: string;
  페이지수: string; 단가: string; 공급가액: string; 부가세: string; 합계금액: string;
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { rows } = await request.json() as { rows: CsvRow[] };
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "데이터가 없습니다" }, { status: 400 });

  const supabase = getSupabase();
  const companyId = session.company.id;

  // sueng 사용자 찾기
  const { data: suengUser } = await supabase.from("users").select("id").eq("company_id", companyId).eq("user_id", "sueng").maybeSingle();
  const createdBy = suengUser?.id || session.user.id;

  // 날짜 변환: 20260401 → 2026-04-01
  function convertDate(s: string) {
    if (!s || s.length !== 8) return new Date().toISOString().slice(0, 10);
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  // 작성일+순번으로 그룹핑
  const groups: Record<string, CsvRow[]> = {};
  for (const row of rows) {
    const key = `${row.작성일}-${row.순번}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  // 기존 거래처 조회
  const { data: existingClients } = await supabase.from("clients").select("id, name").eq("company_id", companyId);
  const clientMap: Record<string, string> = {};
  for (const c of existingClients || []) clientMap[c.name] = c.id;

  // 기존 주문번호 조회
  const { data: existingOrders } = await supabase.from("orders").select("order_no").eq("company_id", companyId);
  const existingOrderNos = new Set((existingOrders || []).map(o => o.order_no));

  const result = { success: 0, skip: 0, errors: [] as string[] };

  for (const [key, groupRows] of Object.entries(groups)) {
    const first = groupRows[0];
    const orderNo = key; // "20260401-1" 형식
    if (existingOrderNos.has(orderNo)) {
      result.skip++;
      continue;
    }

    try {
      // 거래처 자동 등록
      let clientName = first.거래처명 || "";
      if (clientName && !clientMap[clientName]) {
        const { data: newClient } = await supabase.from("clients").insert({
          company_id: companyId,
          name: clientName,
          contact_person: first.주문자 || "",
          phone: first.연락처 || "",
          mobile: first.연락처 || "",
        }).select("id").single();
        if (newClient) clientMap[clientName] = newClient.id;
      }

      // 합계 계산
      let totalSupply = 0, totalVat = 0, totalAmount = 0;
      for (const r of groupRows) {
        totalSupply += parseInt((r.공급가액 || "0").replace(/,/g, "")) || 0;
        totalVat += parseInt((r.부가세 || "0").replace(/,/g, "")) || 0;
        totalAmount += parseInt((r.합계금액 || "0").replace(/,/g, "")) || 0;
      }

      // 주문 등록
      const { data: newOrder, error: orderError } = await supabase.from("orders").insert({
        company_id: companyId,
        created_by: createdBy,
        order_no: orderNo,
        order_date: convertDate(first.작성일),
        client_name: clientName,
        client_id: clientMap[clientName] || null,
        orderer: first.주문자 || "",
        contact: first.연락처 || "",
        product_type: first.제품형태 || "",
        title: first.제목 || "",
        trade_type: first.거래유형 === "11" ? "vat" : "novat",
        payment: first.선금 || "",
        detail_spec: first["세부사양/후가공"] || "",
        total_supply: totalSupply,
        total_vat: totalVat,
        total_amount: totalAmount,
        status: "complete",
      }).select("id").single();

      if (orderError || !newOrder) {
        result.errors.push(`${orderNo}: ${orderError?.message || "주문 등록 실패"}`);
        continue;
      }

      // 품목 등록
      const items = groupRows.map((r, i) => ({
        order_id: newOrder.id,
        sort_order: i,
        data: {
          "품목명": r.품목명 || "",
          "규격": r.규격 || "",
          "부수": r.수량 || "",
          "페이지수": r.페이지수 || "",
          "단가": (r.단가 || "").replace(/,/g, ""),
          "공급가": (r.공급가액 || "").replace(/,/g, ""),
          "부가세": (r.부가세 || "").replace(/,/g, ""),
          "합계": (r.합계금액 || "").replace(/,/g, ""),
        },
      }));
      await supabase.from("order_items").insert(items);

      result.success++;
    } catch (err) {
      result.errors.push(`${orderNo}: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
  }

  return NextResponse.json(result);
}
