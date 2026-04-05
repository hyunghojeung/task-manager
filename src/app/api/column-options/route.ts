export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function GET() {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const supabase = getSupabase();
  const { data, error } = await supabase.from("column_options").select("*").eq("company_id", session.company.id).order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { name, sort_order } = await request.json();
  if (!name) return NextResponse.json({ error: "컬럼명 필요" }, { status: 400 });
  const supabase = getSupabase();
  const { data, error } = await supabase.from("column_options").insert({ company_id: session.company.id, name, sort_order: sort_order ?? 0 }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
