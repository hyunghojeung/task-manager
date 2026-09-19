import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCompanyFeatures } from "@/lib/features";
import ToolFrame from "../taekbae/ToolFrame";

export const metadata: Metadata = { title: "B-imposition" };

// 조판(임포지션) 화면 — public/tools/imposition.html 한 파일짜리 화면을
// 송장변환처럼 헤더·메뉴 아래에 끼워 넣는다. 실제 PDF 처리는 로컬 프로그램이 한다.
// 최고관리자가 켜 준 업체만 들어올 수 있다.
export default async function ImpositionPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const f = await getCompanyFeatures(session.company.id);
  if (!f.imposition) redirect("/dashboard");
  return <ToolFrame src="/tools/imposition.html" title="B-imposition" id="imposition-frame" />;
}
