import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCompanyFeatures } from "@/lib/features";
import ToolFrame from "../taekbae/ToolFrame";

export const metadata: Metadata = { title: "B-PRINT" };

// B-PRINT 화면 — public/tools/bprint.html 한 파일짜리 미리보기 화면을
// B-imposition 과 같은 방식으로 헤더·메뉴 아래에 끼워 넣는다.
// 실제 PDF 작업은 제목줄 버튼으로 내려받은 윈도우 프로그램이 한다.
// B-imposition 과 따로 파는 상품이라 feat_print 를 켠 업체만 들어온다.
export default async function BPrintPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const f = await getCompanyFeatures(session.company.id);
  if (!f.print) redirect("/dashboard");
  return <ToolFrame src="/tools/bprint.html" title="B-PRINT" id="bprint-frame" />;
}
