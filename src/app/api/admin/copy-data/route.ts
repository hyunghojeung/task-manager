export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";


export async function POST(request: NextRequest) {
  const { sourceCompanyId, tables } = await request.json();
  if (!sourceCompanyId) return NextResponse.json({ error: "sourceCompanyId 필요" }, { status: 400 });

  const supabase = getSupabase();
  const results: Record<string, string> = {};

  // 모든 회사 조회
  const { data: companies } = await supabase.from("companies").select("id, company_name, company_id").neq("id", sourceCompanyId);
  if (!companies || companies.length === 0) return NextResponse.json({ error: "복사 대상 회사 없음" }, { status: 400 });

  const targetIds = companies.map(c => c.id);
  const tablesToCopy = tables || ["suppliers", "purchase_orders"];

  for (const table of tablesToCopy) {
    // 원본 데이터 조회
    const { data: sourceData } = await supabase.from(table).select("*").eq("company_id", sourceCompanyId);
    if (!sourceData || sourceData.length === 0) {
      results[table] = "원본 데이터 없음";
      continue;
    }

    let copiedCount = 0;
    for (const targetId of targetIds) {
      // 대상 회사에 이미 데이터가 있는지 확인
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("company_id", targetId);

      if ((count || 0) > 0) {
        results[`${table}_${targetId}`] = "이미 데이터 있음, 스킵";
        continue;
      }

      for (const row of sourceData) {
        const { id, created_at, updated_at, ...rest } = row;
        const newRow = { ...rest, company_id: targetId };

        const { data: inserted, error } = await supabase.from(table).insert(newRow).select().single();

        // purchase_orders의 경우 items도 복사
        if (table === "purchase_orders" && inserted && !error) {
          const { data: items } = await supabase.from("purchase_order_items").select("*").eq("po_id", id);
          if (items && items.length > 0) {
            const newItems = items.map(({ created_at: _ca, ...itemRest }) => ({
              ...itemRest,
              po_id: inserted.id
            }));
            await supabase.from("purchase_order_items").insert(newItems);
          }
        }
        copiedCount++;
      }
    }
    results[table] = `${copiedCount}건 복사 완료`;
  }

  return NextResponse.json({ success: true, results, targetCompanies: companies.map(c => c.company_name) });
}
