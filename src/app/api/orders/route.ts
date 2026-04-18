export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

// 작업 리스트 조회
export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const category = searchParams.get("category");
  const searchField = searchParams.get("searchField");
  const keyword = searchParams.get("keyword");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const mode = searchParams.get("mode") || "list"; // list: 견적서 이동된 것 제외, estimates: 견적서로 이동된 것만

  const supabase = getSupabase();
  let query = supabase
    .from("orders")
    .select("id, order_no, client_name, orderer, contact, title, total_amount, discount, product_type, payment, status, is_estimate, created_by, order_date, created_at", { count: "exact" })
    .eq("company_id", session.company.id)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false });

  // 견적서 이동 여부 필터
  if (mode === "estimates") {
    query = query.eq("is_estimate", true);
  } else {
    query = query.or("is_estimate.is.null,is_estimate.eq.false");
  }

  if (category && category !== "전체") {
    query = query.eq("categories.name", category);
  }
  if (startDate) query = query.gte("order_date", startDate);
  if (endDate) query = query.lte("order_date", endDate);

  if (keyword && searchField) {
    if (searchField === "거래처") query = query.ilike("client_name", `%${keyword}%`);
    else if (searchField === "주문자") query = query.ilike("orderer", `%${keyword}%`);
    else if (searchField === "연락처") query = query.ilike("contact", `%${keyword}%`);
    else if (searchField === "제목") query = query.ilike("title", `%${keyword}%`);
    else query = query.or(`client_name.ilike.%${keyword}%,orderer.ilike.%${keyword}%,title.ilike.%${keyword}%,contact.ilike.%${keyword}%`);
  }

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 빈 제목 주문 필터링 (제목 검색 아닐 때만)
  const rows = (data || []).filter((o: Record<string, unknown>) => {
    const title = (o.title || "").toString().trim();
    if (title === "") return false;
    return true;
  });

  // 작성자 정보 조회
  const createdByIds = [...new Set(rows.map((o: Record<string, unknown>) => o.created_by).filter(Boolean))];
  let usersMap: Record<string, string> = {};
  if (createdByIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, name, user_id").in("id", createdByIds);
    if (users) for (const u of users) usersMap[u.id] = `${u.name}(${u.user_id})`;
  }
  const result = rows.map((o: Record<string, unknown>) => ({ ...o, author: o.created_by ? usersMap[o.created_by as string] || "-" : "-" }));

  return NextResponse.json({ data: result, total: count || 0, page, limit });
}

// 작업 등록
export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const supabase = getSupabase();

  // UUID가 아닌 값이 들어오면 null로 변환
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (body.category_id && !uuidRegex.test(body.category_id)) body.category_id = null;
  if (body.client_id && !uuidRegex.test(body.client_id)) body.client_id = null;
  if (!body.category_id) body.category_id = null;
  if (!body.client_id) body.client_id = null;

  // 주문번호 생성 (마지막 번호 조회 후 +1)
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  const { data: lastOrder } = await supabase
    .from("orders")
    .select("order_no")
    .eq("company_id", session.company.id)
    .like("order_no", `${dateStr}%`)
    .order("order_no", { ascending: false })
    .limit(1)
    .single();

  let nextNum = 1;
  if (lastOrder?.order_no) {
    const parts = lastOrder.order_no.split("-");
    const num = parseInt(parts[parts.length - 1]);
    if (!isNaN(num)) nextNum = num + 1;
  }
  const orderNo = `${dateStr}-${nextNum}`;

  const { data, error } = await supabase
    .from("orders")
    .insert({
      ...body,
      company_id: session.company.id,
      created_by: session.user.id,
      order_no: orderNo,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
