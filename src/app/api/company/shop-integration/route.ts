export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";
import { isAdminRole } from "@/types/database";
import { generateApiKey, hashApiKey } from "@/lib/shop-order";

// 관리자 > 쇼핑몰연동: 설정 조회 / 키 발급·재발급 / 설정 저장

export async function GET() {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const supabase = getSupabase();
  const companyId = session.company.id;

  const { data: integ } = await supabase
    .from("company_integrations")
    .select("id, api_key_hint, shop_url, category_name, template_name, last_received_at, created_at")
    .eq("company_id", companyId).eq("kind", "shop").maybeSingle();

  const { data: events } = await supabase
    .from("shop_events").select("created_at, external_order_id, kind, result")
    .eq("company_id", companyId).order("created_at", { ascending: false }).limit(30);

  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from("shop_events").select("id", { count: "exact", head: true })
    .eq("company_id", companyId).eq("kind", "order").gte("created_at", since.toISOString());

  const { data: categories } = await supabase.from("categories").select("name").eq("company_id", companyId).order("sort_order");
  const { data: templates } = await supabase.from("form_templates").select("name").eq("company_id", companyId).order("sort_order");

  return NextResponse.json({
    integration: integ || null,
    events: events || [],
    todayCount: todayCount || 0,
    categories: (categories || []).map((c) => c.name),
    templates: (templates || []).map((t) => t.name),
  });
}

// 키 발급(처음) / 재발급 — 평문 키는 이 응답에서 한 번만 준다
export async function POST() {
  const session = await getApiSession();
  if (!session) return unauthorized();
  if (!isAdminRole(session.user.role)) return NextResponse.json({ error: "관리자만 발급할 수 있습니다." }, { status: 403 });
  const supabase = getSupabase();
  const companyId = session.company.id;

  const key = generateApiKey();
  const row = { api_key_hash: hashApiKey(key), api_key_hint: key.slice(0, 12), updated_at: new Date().toISOString() };

  const { data: existing } = await supabase.from("company_integrations").select("id").eq("company_id", companyId).eq("kind", "shop").maybeSingle();
  const q = existing
    ? supabase.from("company_integrations").update(row).eq("id", existing.id)
    : supabase.from("company_integrations").insert({ company_id: companyId, kind: "shop", ...row });
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ api_key: key, api_key_hint: row.api_key_hint, regenerated: !!existing });
}

// 설정 저장 (쇼핑몰 주소, 카테고리, 표양식)
export async function PUT(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  if (!isAdminRole(session.user.role)) return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });
  const body = await request.json();
  const supabase = getSupabase();

  const patch = {
    shop_url: String(body.shop_url || "").trim() || null,
    category_name: String(body.category_name || "").trim() || null,
    template_name: String(body.template_name || "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("company_integrations").select("id").eq("company_id", session.company.id).eq("kind", "shop").maybeSingle();
  if (!existing) return NextResponse.json({ error: "먼저 API 키를 발급하세요." }, { status: 400 });
  const { error } = await supabase.from("company_integrations").update(patch).eq("id", existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
