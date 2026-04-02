import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// 업체 목록 조회
export async function GET() {
  const supabase = getSupabase();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 각 업체의 사용자 수 조회
  const result = [];
  for (const company of companies || []) {
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company.id);
    result.push({ ...company, user_count: count || 0 });
  }

  return NextResponse.json(result);
}

// 업체 등록
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = getSupabase();

  const { adminName, adminUserId, adminPassword, ...companyData } = body;

  // 업체 등록
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert(companyData)
    .select()
    .single();

  if (companyError) return NextResponse.json({ error: companyError.message }, { status: 500 });

  // 관리자 사용자 등록
  if (adminUserId && adminName) {
    const { error: userError } = await supabase.from("users").insert({
      company_id: company.id,
      user_id: adminUserId,
      name: adminName,
      password: adminPassword || "@admin1234",
      role: "admin",
    });
    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  // 기본 카테고리 등록
  await supabase.from("categories").insert([
    { company_id: company.id, name: "일반", sort_order: 1 },
  ]);

  return NextResponse.json(company, { status: 201 });
}
