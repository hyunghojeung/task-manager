import type { Metadata } from "next";
import ToolFrame from "../taekbae/ToolFrame";
import DownloadButton from "./DownloadButton";

export const metadata: Metadata = { title: "Bcount 임포지션" };

// 조판(임포지션) 화면 — public/tools/imposition.html 한 파일짜리 화면을
// 송장변환처럼 헤더·메뉴 아래에 끼워 넣는다. 실제 PDF 처리는 로컬 프로그램(개발 예정)이 한다.
// 화면 위에는 프로그램 다운로드 버튼 하나만 둔다.
export default function ImpositionPage() {
  return (
    <div className="-m-4 md:-m-6">
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 print:hidden">
        <DownloadButton />
      </div>
      <div className="m-4 md:m-6">
        <ToolFrame src="/tools/imposition.html" title="Bcount 임포지션" id="imposition-frame" />
      </div>
    </div>
  );
}
