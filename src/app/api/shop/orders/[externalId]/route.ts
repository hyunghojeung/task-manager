export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { findIntegrationByKey, paidLine, paidMemo } from "@/lib/shop-order";

// 쇼핑몰 → Bcount: 입금 확인
// PATCH /api/shop/orders/:externalId   { payment: { status: "paid", paid_at?, depositor? } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ externalId: string }> }) {
  const supabase = getSupabase();
  const integ = await findIntegrationByKey(supabase, request.headers.get("authorization"));
  if (!integ) return NextResponse.json({ error: "API 키가 올바르지 않습니다" }, { status: 401 });

  const { externalId } = await params;
  let body: { payment?: { status?: string; paid_at?: string; depositor?: string } } = {};
  try { body = await request.json(); } catch { /* 본문 없이 와도 입금 확인으로 본다 */ }
  if (body.payment && body.payment.status && body.payment.status !== "paid") {
    return NextResponse.json({ error: "payment.status 는 paid 만 받습니다" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders").select("id, order_no, paid_at, detail_spec")
    .eq("company_id", integ.company_id).eq("external_order_id", externalId).maybeSingle();
  if (!order) return NextResponse.json({ error: "해당 쇼핑몰 주문이 없습니다" }, { status: 404 });

  const paidAt = body.payment?.paid_at || new Date().toISOString();
  if (!order.paid_at) {
    await supabase.from("orders").update({
      paid_at: paidAt,
      payment: paidMemo(paidAt),
      detail_spec: (order.detail_spec || "") + paidLine(paidAt, body.payment?.depositor),
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
  }

  await supabase.from("shop_events").insert({
    company_id: integ.company_id, external_order_id: externalId, kind: "paid",
    result: order.paid_at ? `이미 입금 처리됨 (작업 ${order.order_no})` : `200 → 작업 ${order.order_no} MEMO '입금완료'`,
  });
  await supabase.from("company_integrations").update({ last_received_at: new Date().toISOString() }).eq("id", integ.id);

  return NextResponse.json({ order_no: order.order_no, paid: true });
}
