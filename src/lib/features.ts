import { getSupabase } from "@/lib/supabase-admin";

// 업체별로 최고관리자가 켜 주는 기능. 켜지 않은 업체에는 메뉴가 보이지 않고 페이지·API도 막힌다.
export interface CompanyFeatures { hub: boolean; imposition: boolean; taekbae: boolean; sales: boolean }

export async function getCompanyFeatures(companyId: string): Promise<CompanyFeatures> {
  const { data } = await getSupabase().from("companies").select("feat_hub, feat_imposition, feat_taekbae, feat_sales").eq("id", companyId).maybeSingle();
  return { hub: !!data?.feat_hub, imposition: !!data?.feat_imposition, taekbae: !!data?.feat_taekbae, sales: !!data?.feat_sales };
}
