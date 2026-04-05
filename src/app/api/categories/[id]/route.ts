import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  const { data, error } = await supabase.from("categories").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", session.company.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const supabase = getSupabase();
  // 해당 카테고리를 사용하는 orders의 category_id를 null로 변경
  await supabase.from("orders").update({ category_id: null }).eq("category_id", id).eq("company_id", session.company.id);
  const { error } = await supabase.from("categories").delete().eq("id", id).eq("company_id", session.company.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
