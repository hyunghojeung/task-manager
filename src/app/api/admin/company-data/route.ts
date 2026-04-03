export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const type = searchParams.get("type");
  if (!companyId || !type) return NextResponse.json({ error: "companyId, type 필요" }, { status: 400 });

  const supabase = getSupabase();

  // 회사 정보 조회
  const { data: company } = await supabase.from("companies").select("id, company_id, company_name").eq("company_id", companyId).single();
  if (!company) return NextResponse.json({ error: "회사를 찾을 수 없습니다" }, { status: 404 });

  let data: unknown[] = [];

  if (type === "orders") {
    const { data: orders } = await supabase.from("orders").select("id, order_no, client_name, title, total_amount, status, created_at").eq("company_id", company.id).order("created_at", { ascending: false }).limit(100);
    data = orders || [];
  } else if (type === "memos") {
    const { data: memos } = await supabase.from("memos").select("id, title, content, created_at, created_by").eq("company_id", company.id).order("created_at", { ascending: false }).limit(100);
    // 작성자 정보 조회
    const createdByIds = (memos || []).map((m: Record<string, unknown>) => m.created_by).filter(Boolean);
    let usersMap: Record<string, string> = {};
    if (createdByIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name, user_id").in("id", createdByIds);
      if (users) for (const u of users) usersMap[u.id] = `${u.name}(${u.user_id})`;
    }
    data = (memos || []).map((m: Record<string, unknown>) => ({ ...m, author: m.created_by ? usersMap[m.created_by as string] || "-" : "-" }));
  } else if (type === "purchase-orders") {
    const { data: pos } = await supabase.from("purchase_orders").select("id, po_no, po_date, supplier_name, orderer, request_note, created_at").eq("company_id", company.id).order("po_date", { ascending: false }).limit(100);
    data = pos || [];
  }

  return NextResponse.json({ company, data });
}
