import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";


export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();

  const { error } = await supabase
    .from("companies")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();
  // 관련 데이터 모두 삭제 (cascade)
  await supabase.from("order_items").delete().in("order_id", (await supabase.from("orders").select("id").eq("company_id", id)).data?.map(o => o.id) || []);
  await supabase.from("attachments").delete().in("order_id", (await supabase.from("orders").select("id").eq("company_id", id)).data?.map(o => o.id) || []);
  await supabase.from("orders").delete().eq("company_id", id);
  await supabase.from("purchase_order_items").delete().in("po_id", (await supabase.from("purchase_orders").select("id").eq("company_id", id)).data?.map(o => o.id) || []);
  await supabase.from("purchase_orders").delete().eq("company_id", id);
  await supabase.from("memos").delete().eq("company_id", id);
  await supabase.from("notices").delete().eq("company_id", id);
  await supabase.from("categories").delete().eq("company_id", id);
  await supabase.from("clients").delete().eq("company_id", id);
  await supabase.from("suppliers").delete().eq("company_id", id);
  await supabase.from("form_templates").delete().eq("company_id", id);
  await supabase.from("column_options").delete().eq("company_id", id);
  await supabase.from("users").delete().eq("company_id", id);
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
