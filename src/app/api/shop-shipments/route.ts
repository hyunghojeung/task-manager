export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

// 송장변환 > 쇼핑몰 주문 불러오기
// 쇼핑몰에서 들어온 작업의 배송지를 목록으로 주고, 변환기에 넣은 것은 "내보냄"으로 표시한다.

interface ShipmentRow {
  id: string; order_id: string; recipient: string; zip: string; address1: string; address2: string;
  mobile: string; tel: string; method: string; memo: string; box_count: number; exported_at: string | null;
  orders: { order_no: string; orderer: string; title: string; payment: string; paid_at: string | null; product_type: string; status: string; created_at: string; company_id: string; source: string } | null;
}

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(request.url);
  const includeUnpaid = searchParams.get("unpaid") === "1";
  const includeExported = searchParams.get("exported") === "1";

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("shipments")
    .select("id, order_id, recipient, zip, address1, address2, mobile, tel, method, memo, box_count, exported_at, orders!inner(order_no, orderer, title, payment, paid_at, product_type, status, created_at, company_id, source)")
    .eq("orders.company_id", session.company.id)
    .eq("orders.source", "shop")
    .neq("method", "직접수령");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data || []) as unknown as ShipmentRow[])
    .filter((s) => s.orders)
    .filter((s) => includeUnpaid || s.orders!.paid_at)
    .filter((s) => includeExported || !s.exported_at)
    .sort((a, b) => (b.orders!.created_at || "").localeCompare(a.orders!.created_at || ""))
    .map((s) => ({
      shipment_id: s.id, order_id: s.order_id, order_no: s.orders!.order_no, orderer: s.orders!.orderer, title: s.orders!.title,
      payment: s.orders!.payment, paid: !!s.orders!.paid_at, product_type: s.orders!.product_type, status: s.orders!.status,
      recipient: s.recipient, zip: s.zip, address1: s.address1, address2: s.address2, mobile: s.mobile, tel: s.tel,
      method: s.method, memo: s.memo, box_count: s.box_count || 1, exported_at: s.exported_at,
    }));

  return NextResponse.json({ data: rows });
}

// 변환기에 넣은 주문을 "내보냄"으로 표시
export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { shipment_ids } = await request.json() as { shipment_ids: string[] };
  if (!Array.isArray(shipment_ids) || shipment_ids.length === 0) return NextResponse.json({ error: "선택된 주문이 없습니다" }, { status: 400 });

  const supabase = getSupabase();
  // 다른 업체 것이 섞이지 않게 업체로 한 번 거른다
  const { data: mine } = await supabase
    .from("shipments").select("id, orders!inner(company_id)")
    .in("id", shipment_ids).eq("orders.company_id", session.company.id);
  const ids = (mine || []).map((r) => r.id);
  if (ids.length) await supabase.from("shipments").update({ exported_at: new Date().toISOString() }).in("id", ids);

  return NextResponse.json({ success: true, count: ids.length });
}
