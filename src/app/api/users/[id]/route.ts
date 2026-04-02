import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session || session.user.role !== "admin") return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", session.company.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session || session.user.role !== "admin") return unauthorized();
  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase.from("users").delete().eq("id", id).eq("company_id", session.company.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
