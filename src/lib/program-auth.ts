import { createHash, randomBytes } from "crypto";
import { getSupabase } from "@/lib/supabase-admin";

// 로컬 프로그램(Bcount 임포지션)의 사용자 확인.
// 프로그램은 처음 한 번 업체ID·아이디·비밀번호로 로그인해 토큰을 받고, 이후 실행할 때마다 토큰으로 확인한다.
// 토큰은 해시로만 저장한다. Bcount 회원이 아니게 되면(사용자 삭제, 업체 비활성) 즉시 못 쓴다.

export function newToken() {
  return "bpt_" + randomBytes(30).toString("base64url").slice(0, 40);
}

export function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export interface ProgramUser { user_id: string; name: string; role: string; company_name: string; company_id: string }

export async function verifyToken(token: string): Promise<ProgramUser | null> {
  if (!token || !token.startsWith("bpt_")) return null;
  const supabase = getSupabase();
  const { data: row } = await supabase.from("program_tokens").select("token_hash, user_id, company_id").eq("token_hash", hashToken(token)).maybeSingle();
  if (!row) return null;
  const { data: user } = await supabase.from("users").select("id, user_id, name, role, company_id").eq("id", row.user_id).maybeSingle();
  if (!user || user.company_id !== row.company_id) return null;
  const { data: company } = await supabase.from("companies").select("id, company_name, status").eq("id", row.company_id).maybeSingle();
  if (!company || company.status !== "active") return null;
  await supabase.from("program_tokens").update({ last_seen_at: new Date().toISOString() }).eq("token_hash", row.token_hash);
  return { user_id: user.user_id, name: user.name, role: user.role, company_name: company.company_name, company_id: company.id };
}

export function bearer(request: Request): string {
  const h = request.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}
