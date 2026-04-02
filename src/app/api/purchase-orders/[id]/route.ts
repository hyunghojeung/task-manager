import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("purchase_orders").select("*, purchase_order_items(*)").eq("id", id).eq("company_id", session.company.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  const updateData: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.supplier_name !== undefined) updateData.supplier_name = body.supplier_name;
  if (body.orderer !== undefined) updateData.orderer = body.orderer;
  if (body.contact !== undefined) updateData.contact = body.contact;
  if (body.request_note !== undefined) updateData.request_note = body.request_note;
  if (body.po_date !== undefined) updateData.po_date = body.po_date;

  const { error } = await supabase.from("purchase_orders").update(updateData).eq("id", id).eq("company_id", session.company.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.items) {
    await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);
    if (body.items.length > 0) {
      const itemRows = body.items.map((it: Record<string, string>, i: number) => ({
        purchase_order_id: id,
        product_name: it.product_name || "",
        spec: it.spec || "",
        paper_grain: it.paper_grain || "",
        cut_size: it.cut_size || "",
        quantity: it.quantity || "",
        received: it.received || "",
        sort_order: i + 1
      }));
      const { error: itemError } = await supabase.from("purchase_order_items").insert(itemRows);
      if (itemError) return NextResponse.json({ error: "품목 저장 실패: " + itemError.message }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id).eq("company_id", session.company.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
