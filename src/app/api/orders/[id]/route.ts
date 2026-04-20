import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

// 작업 상세 조회
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), attachments(*)")
    .eq("id", id)
    .eq("company_id", session.company.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// 작업 수정
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const body = await request.json();

  // UUID 검증: 명시적으로 포함된 필드만 처리 (undefined는 건드리지 않음)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ("category_id" in body) {
    if (body.category_id && !uuidRegex.test(body.category_id)) body.category_id = null;
    else if (!body.category_id) body.category_id = null;
  }
  if ("client_id" in body) {
    if (body.client_id && !uuidRegex.test(body.client_id)) body.client_id = null;
    else if (!body.client_id) body.client_id = null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", session.company.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// 작업 삭제
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const supabase = getSupabase();
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
