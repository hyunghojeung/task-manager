import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// pwindow의 양식을 모든 기존 업체에 복사 (이미 있는 양식은 건너뜀)
export async function POST() {
  const supabase = getSupabase();

  // pwindow 업체 찾기
  const { data: pwindowCompany } = await supabase.from("companies").select("id").eq("company_id", "pwindow").maybeSingle();
  if (!pwindowCompany) return NextResponse.json({ error: "pwindow 업체를 찾을 수 없습니다." }, { status: 404 });

  // pwindow의 모든 양식 가져오기
  const { data: pwindowTemplates } = await supabase.from("form_templates").select("name, columns, formulas, is_default, sort_order").eq("company_id", pwindowCompany.id).order("sort_order");
  if (!pwindowTemplates || pwindowTemplates.length === 0) return NextResponse.json({ error: "pwindow에 양식이 없습니다." }, { status: 404 });

  // 모든 업체 가져오기 (pwindow 제외)
  const { data: companies } = await supabase.from("companies").select("id, company_id").neq("id", pwindowCompany.id);
  if (!companies || companies.length === 0) return NextResponse.json({ message: "복사할 업체가 없습니다.", copied: 0 });

  let totalCopied = 0;

  for (const company of companies) {
    // 해당 업체의 기존 양식 이름 조회
    const { data: existing } = await supabase.from("form_templates").select("name").eq("company_id", company.id);
    const existingNames = new Set((existing || []).map(e => e.name));

    // 없는 양식만 복사
    const toInsert = pwindowTemplates
      .filter(t => !existingNames.has(t.name))
      .map((t, i) => ({
        company_id: company.id,
        name: t.name,
        columns: t.columns,
        formulas: t.formulas,
        is_default: existingNames.size === 0 && i === 0,
        sort_order: t.sort_order ?? i,
      }));

    if (toInsert.length > 0) {
      await supabase.from("form_templates").insert(toInsert);
      totalCopied += toInsert.length;
    }
  }

  return NextResponse.json({ message: `${companies.length}개 업체에 총 ${totalCopied}개 양식 복사 완료`, copied: totalCopied });
}
