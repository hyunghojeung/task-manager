import type { Metadata } from "next";
import ToolFrame from "./ToolFrame";
import ShopOrdersBar from "./ShopOrdersBar";

export const metadata: Metadata = { title: "송장변환" };

// 송장변환기는 public/tools/taekbae.html 한 파일짜리 도구다.
// 다른 메뉴처럼 헤더·메뉴 아래에 보이도록 이 페이지에 끼워 넣는다.
// 그 위에 "쇼핑몰 주문 불러오기" 띠를 얹는다 — 변환기 자체는 바꾸지 않는다.
export default function TaekbaePage() {
  return (
    <div className="-m-4 md:-m-6">
      <ShopOrdersBar frameId="taekbae-frame" />
      <div className="m-4 md:m-6">
        <ToolFrame src="/tools/taekbae.html" title="택배 송장 변환기" id="taekbae-frame" />
      </div>
    </div>
  );
}
