export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

// 매출 집계 조회 (필터 조건 전체 대상)
// 반환: totals(건수/공급가액/부가세/할인/순매출) + byCategory + byClient(TOP10) + byTax + byMonth
export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "매출 집계는 수퍼관리자만 조회할 수 있습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const clientName = searchParams.get("clientName");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const includeEstimate = searchParams.get("includeEstimate") === "1";

  const supabase = getSupabase();

  // 카테고리 목록 (매출 집계용)
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("company_id", session.company.id);

  const categoryMap: Record<string, string> = {};
  (categories || []).forEach(c => { categoryMap[c.id] = c.name; });

  let query = supabase
    .from("orders")
    .select("id, order_no, client_name, title, total_amount, total_supply, total_vat, discount, status, category_id, is_estimate, tax_invoice, order_date, created_at")
    .eq("company_id", session.company.id);

  if (!includeEstimate) {
    // is_estimate=null OR is_estimate=false만 (견적서로 이동된 것 제외)
    // Supabase에서는 명시적으로 하기 어려우니 결과에서 필터
  }

  if (category && category !== "전체") {
    const { data: catData } = await supabase.from("categories").select("id").eq("company_id", session.company.id).eq("name", category).maybeSingle();
    if (catData) query = query.eq("category_id", catData.id);
    else return NextResponse.json({ totals: emptyTotals(), byCategory: [], byClient: [], byTax: [], byMonth: [] });
  }
  if (clientName) query = query.ilike("client_name", `%${clientName}%`);
  if (startDate) query = query.gte("order_date", startDate);
  if (endDate) query = query.lte("order_date", endDate);

  // 대량 데이터 대비 페이징 없이 필요한 컬럼만 조회 (최대 5만건)
  query = query.limit(50000);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 빈 제목 + 견적서 제외 (includeEstimate=false일 때)
  const rows = (data || []).filter((o: Record<string, unknown>) => {
    const title = (o.title || "").toString().trim();
    if (title === "") return false;
    if (!includeEstimate && o.is_estimate === true) return false;
    return true;
  });

  // 총계
  const totals = { count: 0, supply: 0, vat: 0, discount: 0, net: 0, progress: 0, complete: 0 };
  for (const o of rows) {
    const total = Number(o.total_amount || 0);
    const disc = Number(o.discount || 0);
    const supply = Number(o.total_supply || 0) || Math.round(total / 1.1);
    const vat = Number(o.total_vat || 0) || (total - supply);
    totals.count += 1;
    totals.supply += supply;
    totals.vat += vat;
    totals.discount += disc;
    totals.net += total - disc;
    if (o.status === "progress") totals.progress += 1;
    else if (o.status === "complete") totals.complete += 1;
  }

  // 카테고리별
  const catAgg: Record<string, { name: string; count: number; supply: number; vat: number; discount: number; net: number }> = {};
  for (const o of rows) {
    const catId = (o.category_id as string) || "__none__";
    const catName = categoryMap[catId] || "(카테고리 없음)";
    if (!catAgg[catId]) catAgg[catId] = { name: catName, count: 0, supply: 0, vat: 0, discount: 0, net: 0 };
    const total = Number(o.total_amount || 0);
    const disc = Number(o.discount || 0);
    const supply = Math.round(total / 1.1);
    const vat = total - supply;
    catAgg[catId].count += 1;
    catAgg[catId].supply += supply;
    catAgg[catId].vat += vat;
    catAgg[catId].discount += disc;
    catAgg[catId].net += total - disc;
  }
  const byCategory = Object.values(catAgg).sort((a, b) => b.net - a.net);

  // 거래처별 TOP 10
  const clientAgg: Record<string, { name: string; count: number; net: number }> = {};
  for (const o of rows) {
    const name = ((o.client_name as string) || "-").trim() || "-";
    if (!clientAgg[name]) clientAgg[name] = { name, count: 0, net: 0 };
    clientAgg[name].count += 1;
    clientAgg[name].net += Number(o.total_amount || 0) - Number(o.discount || 0);
  }
  const clientsSorted = Object.values(clientAgg).sort((a, b) => b.net - a.net);
  const byClient = clientsSorted.slice(0, 10);
  const clientRestCount = clientsSorted.length - 10;
  const clientRestNet = clientsSorted.slice(10).reduce((s, c) => s + c.net, 0);
  const clientRestOrderCount = clientsSorted.slice(10).reduce((s, c) => s + c.count, 0);

  // 세금계산서 상태별 (문자열 시작 부분으로 분류)
  const taxAgg: Record<string, { label: string; count: number; net: number }> = {
    "발송_세금계산서": { label: "세금계산서 발송완료", count: 0, net: 0 },
    "발송_거래명세서": { label: "거래명세서 발송완료", count: 0, net: 0 },
    "작성요망": { label: "세금계산서 작성요망", count: 0, net: 0 },
    "나라빌_요망": { label: "나라빌청구요망", count: 0, net: 0 },
    "나라빌_완료": { label: "나라빌청구완료", count: 0, net: 0 },
    "미지정": { label: "미지정", count: 0, net: 0 },
  };
  for (const o of rows) {
    const t = ((o.tax_invoice as string) || "").trim();
    const net = Number(o.total_amount || 0) - Number(o.discount || 0);
    let key = "미지정";
    if (t.includes("세금계산서 발송완료")) key = "발송_세금계산서";
    else if (t.includes("거래명세서 발송완료")) key = "발송_거래명세서";
    else if (t === "세금계산서 작성요망") key = "작성요망";
    else if (t.includes("나라빌청구완료")) key = "나라빌_완료";
    else if (t.includes("나라빌청구요망")) key = "나라빌_요망";
    taxAgg[key].count += 1;
    taxAgg[key].net += net;
  }
  const byTax = Object.values(taxAgg);

  // 월별 (최근 12개월)
  const monthAgg: Record<string, { month: string; count: number; net: number }> = {};
  for (const o of rows) {
    const d = new Date((o.order_date as string) || (o.created_at as string));
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthAgg[key]) monthAgg[key] = { month: key, count: 0, net: 0 };
    monthAgg[key].count += 1;
    monthAgg[key].net += Number(o.total_amount || 0) - Number(o.discount || 0);
  }
  const byMonth = Object.values(monthAgg).sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    totals,
    byCategory,
    byClient,
    clientRest: { count: clientRestCount, orderCount: clientRestOrderCount, net: clientRestNet },
    byTax,
    byMonth,
    categoryList: (categories || []).map(c => c.name),
  });
}

function emptyTotals() {
  return { count: 0, supply: 0, vat: 0, discount: 0, net: 0, progress: 0, complete: 0 };
}
