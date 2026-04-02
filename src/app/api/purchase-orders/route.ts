export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const supabase = getSupabase();
  const from = (page - 1) * limit;
  const { data, error, count } = await supabase.from("purchase_orders").select("*", { count: "exact" }).eq("company_id", session.company.id).order("po_date", { ascending: false }).range(from, from + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 품목 데이터 별도 조회
  const poIds = (data || []).map((o: Record<string, unknown>) => o.id).filter(Boolean);
  let itemsMap: Record<string, Record<string, string>[]> = {};
  if (poIds.length > 0) {
    const { data: itemsData } = await supabase.from("purchase_order_items").select("*").in("po_id", poIds).order("sort_order");
    if (itemsData) {
      for (const it of itemsData) {
        if (!itemsMap[it.po_id]) itemsMap[it.po_id] = [];
        itemsMap[it.po_id].push(it);
      }
    }
  }
  const result = (data || []).map((o: Record<string, unknown>) => ({ ...o, purchase_order_items: itemsMap[o.id as string] || [] }));
  return NextResponse.json({ data: result, total: count, page, limit });
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const body = await request.json();
  const supabase = getSupabase();
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const { data: existingPos } = await supabase.from("purchase_orders").select("po_no").eq("company_id", session.company.id).like("po_no", `O${dateStr}%`);
  let maxNum = 0;
  if (existingPos) {
    for (const p of existingPos) {
      const parts = p.po_no.split("-");
      const num = parseInt(parts[parts.length - 1]) || 0;
      if (num > maxNum) maxNum = num;
    }
  }
  const poNo = `O${dateStr}-${maxNum + 1}`;
  const { items, ...orderData } = body;
  const { data, error } = await supabase.from("purchase_orders").insert({ ...orderData, company_id: session.company.id, created_by: session.user.id, po_no: poNo }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (items && items.length > 0) {
    const itemRows = items.map((it: Record<string, string>, i: number) => ({
      po_id: data.id,
      product_name: it.product_name || "",
      spec: it.spec || "",
      paper_grain: it.paper_grain || "",
      cut_size: it.cut_size || "",
      quantity: it.quantity || "",
      received: it.received || "",
      sort_order: i + 1
    }));
    const { error: itemError } = await supabase.from("purchase_order_items").insert(itemRows);
    if (itemError) return NextResponse.json({ error: "발주서는 저장됨, 품목 저장 실패: " + itemError.message, data }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
