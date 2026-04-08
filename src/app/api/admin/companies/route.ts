import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { createCompany } from "@/lib/create-company";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabase();
  const [companiesRes, countsRes] = await Promise.all([
    supabase.from("companies").select("*").order("created_at", { ascending: false }),
    supabase.rpc("get_company_counts"),
  ]);

  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 });

  const countMap: Record<string, { user_count: number; order_count: number; memo_count: number; po_count: number }> = {};
  for (const r of countsRes.data || []) {
    countMap[r.company_id] = { user_count: r.user_count || 0, order_count: r.order_count || 0, memo_count: r.memo_count || 0, po_count: r.po_count || 0 };
  }

  const result = (companiesRes.data || []).map(c => ({
    ...c,
    ...(countMap[c.id] || { user_count: 0, order_count: 0, memo_count: 0, po_count: 0 }),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createCompany(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, company: result.company }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
