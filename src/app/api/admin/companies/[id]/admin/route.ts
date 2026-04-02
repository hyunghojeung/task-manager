import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("name, user_id, password")
    .eq("company_id", id)
    .eq("role", "admin")
    .limit(1)
    .single();

  if (error || !data) return NextResponse.json({ name: "", user_id: "", password: "" });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();

  const updateData: Record<string, string> = {};
  if (body.name) updateData.name = body.name;
  if (body.user_id) updateData.user_id = body.user_id;
  if (body.password) updateData.password = body.password;

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("company_id", id)
    .eq("role", "admin");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
