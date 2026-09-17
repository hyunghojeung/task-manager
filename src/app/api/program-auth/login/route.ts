export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { hashToken, newToken } from "@/lib/program-auth";

function escapeLike(s: string) { return s.replace(/[\%_]/g, (c) => "\\" + c); }

// 프로그램 첫 로그인: 웹 로그인과 같은 검사 → 프로그램용 토큰 발급
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "").trim();
  const userId = String(body.userId || "").trim();
  const password = String(body.password || "");
  const device = String(body.device || "").slice(0, 120);
  if (!companyId || !userId || !password) return NextResponse.json({ error: "업체ID, 아이디, 비밀번호를 모두 입력해주세요." }, { status: 400 });

  const supabase = getSupabase();
  const { data: companies } = await supabase.from("companies").select("id, company_id, company_name").ilike("company_id", escapeLike(companyId)).eq("status", "active");
  const company = (companies || []).find((c) => c.company_id.toLowerCase() === companyId.toLowerCase());
  if (!company) return NextResponse.json({ error: "존재하지 않는 업체이거나 비활성 상태입니다." }, { status: 401 });

  const { data: user } = await supabase.from("users").select("id, user_id, name, role").eq("company_id", company.id).eq("user_id", userId).eq("password", password).maybeSingle();
  if (!user) return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });

  const token = newToken();
  const { error } = await supabase.from("program_tokens").insert({ token_hash: hashToken(token), user_id: user.id, company_id: company.id, program: "imposition", device });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token, user: { user_id: user.user_id, name: user.name, role: user.role }, company: { company_name: company.company_name } });
}
