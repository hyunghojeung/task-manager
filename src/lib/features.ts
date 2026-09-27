import { getSupabase } from "@/lib/supabase-admin";

// 업체별로 최고관리자가 켜 주는 기능. 켜지 않은 업체에는 메뉴가 보이지 않고 페이지·API도 막힌다.
// B-imposition(imposition)과 B-PRINT(print)는 따로 파는 상품이라 이용권도 각각이다.
export interface CompanyFeatures { hub: boolean; imposition: boolean; print: boolean; taekbae: boolean; sales: boolean }

export async function getCompanyFeatures(companyId: string): Promise<CompanyFeatures> {
  const { data } = await getSupabase().from("companies").select("feat_hub, feat_imposition, feat_print, feat_taekbae, feat_sales").eq("id", companyId).maybeSingle();
  return { hub: !!data?.feat_hub, imposition: !!data?.feat_imposition, print: !!data?.feat_print, taekbae: !!data?.feat_taekbae, sales: !!data?.feat_sales };
}
