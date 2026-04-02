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
    const { data: itemsData } = await supabase.from("purchase_order_items").select("*").in("purchase_order_id", poIds).order("sort_order");
    if (itemsData) {
      for (const it of itemsData) {
        if (!itemsMap[it.purchase_order_id]) itemsMap[it.purchase_order_id] = [];
        itemsMap[it.purchase_order_id].push(it);
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
  const { data: lastPo } = await supabase.from("purchase_orders").select("po_no").eq("company_id", session.company.id).like("po_no", `O${dateStr}%`).order("po_no", { ascending: false }).limit(1).single();
  let nextNum = 1;
  if (lastPo?.po_no) {
    const parts = lastPo.po_no.split("-");
    nextNum = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  const poNo = `O${dateStr}-${nextNum}`;
  const { items, ...orderData } = body;
  const { data, error } = await supabase.from("purchase_orders").insert({ ...orderData, company_id: session.company.id, created_by: session.user.id, po_no: poNo }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (items && items.length > 0) {
    const itemRows = items.map((it: Record<string, string>, i: number) => ({
      purchase_order_id: data.id,
      product_name: it.product_name || "",
      spec: it.spec || "",
      paper_grain: it.paper_grain || "",
      cut_size: it.cut_size || "",
      quantity: it.quantity || "",
      received: it.received || "",
      sort_order: i + 1
    }));
    await supabase.from("purchase_order_items").insert(itemRows);
  }
  return NextResponse.json(data, { status: 201 });
}
