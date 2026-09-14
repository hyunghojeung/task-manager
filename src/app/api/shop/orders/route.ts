export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { findIntegrationByKey, registerShopOrder, validatePayload, type ShopOrderPayload } from "@/lib/shop-order";

// 쇼핑몰 → Bcount: 주문 접수
// POST /api/shop/orders   Authorization: Bearer <업체 API 키>
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const integ = await findIntegrationByKey(supabase, request.headers.get("authorization"));
  if (!integ) return NextResponse.json({ error: "API 키가 올바르지 않습니다" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON 본문이 아닙니다" }, { status: 400 }); }
  const bad = validatePayload(body);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const p = body as ShopOrderPayload;

  const r = await registerShopOrder(supabase, integ, p);
  const now = new Date().toISOString();

  if (r.error) {
    await supabase.from("shop_events").insert({ company_id: integ.company_id, external_order_id: p.external_order_id, kind: "error", result: r.error });
    return NextResponse.json({ error: r.error }, { status: 500 });
  }

  await supabase.from("shop_events").insert({
    company_id: integ.company_id, external_order_id: p.external_order_id,
    kind: r.duplicate ? "duplicate" : "order",
    result: r.duplicate ? `이미 등록됨 → 작업 ${r.order_no}` : `201 → 작업 ${r.order_no} 등록`,
  });
  await supabase.from("company_integrations").update({ last_received_at: now }).eq("id", integ.id);

  return NextResponse.json({ order_no: r.order_no, duplicate: r.duplicate }, { status: r.duplicate ? 200 : 201 });
}
