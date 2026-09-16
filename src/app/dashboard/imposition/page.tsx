import type { Metadata } from "next";
import ToolFrame from "../taekbae/ToolFrame";

export const metadata: Metadata = { title: "Bcount 임포지션" };

// 조판(임포지션) 화면 — public/tools/imposition.html 한 파일짜리 화면을
// 송장변환처럼 헤더·메뉴 아래에 끼워 넣는다. 실제 PDF 처리는 로컬 프로그램(개발 예정)이 한다.
// 프로그램 다운로드 버튼은 화면 안 제목 바에 있다.
export default function ImpositionPage() {
  return <ToolFrame src="/tools/imposition.html" title="Bcount 임포지션" id="imposition-frame" />;
}
