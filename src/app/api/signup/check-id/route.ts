import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-z0-9_]{3,30}$/.test(id)) {
    return NextResponse.json({ available: false, error: "영문 소문자, 숫자, _ 만 사용 가능 (3~30자)" });
  }
  const supabase = getSupabase();
  const { data } = await supabase.from("companies").select("id").eq("company_id", id).maybeSingle();
  return NextResponse.json({ available: !data });
}
