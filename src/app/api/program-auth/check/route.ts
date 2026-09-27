export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { bearer, verifyToken, productOf } from "@/lib/program-auth";

// 프로그램 실행·저장 때마다: 토큰이 아직 유효한 Bcount 회원인지
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const product = body && body.product ? productOf(body.product) : undefined;   // 없으면 토큰에 적힌 제품으로 검사
  const u = await verifyToken(bearer(request), product);
  if (!u) return NextResponse.json({ ok: false, error: "다시 로그인해주세요." }, { status: 401 });
  return NextResponse.json({ ok: true, product: u.product, user: { user_id: u.user_id, name: u.name, role: u.role }, company: { company_name: u.company_name } });
}
