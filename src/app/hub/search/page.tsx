import type { Metadata } from "next";
import SearchView from "./SearchView";

export const metadata: Metadata = { title: "업무관리 검색" };

// 통합검색 화면. PC 에서는 탭줄의 검색창이, 폰에서는 이 화면 위의 검색창이 검색어를 넣는다.
export default function HubSearchPage() {
  return <SearchView />;
}
