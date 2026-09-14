"use client";

import { useEffect, useState } from "react";
import SearchResults from "./SearchResults";
import SearchBox from "../SearchBox";

// 검색어는 주소(?q=)에 둔다 — PC 탭줄 검색창과 폰 검색창이 같은 값을 본다.
export default function SearchView() {
  const [q, setQ] = useState("");

  useEffect(() => {
    const read = () => setQ(new URLSearchParams(window.location.search).get("q") || "");
    read();
    window.dispatchEvent(new Event("hub-search"));   // PC 탭줄 검색창도 같은 검색어를 보여주게
    window.addEventListener("popstate", read);
    window.addEventListener("hub-search", read);   // PC 탭줄 검색창이 주소를 바꾸면 알려준다
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("hub-search", read);
    };
  }, []);

  function change(v: string) {
    setQ(v);
    const url = v.trim() ? `/hub/search?q=${encodeURIComponent(v.trim())}` : "/hub/search";
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="w-full flex flex-col gap-3 pb-28 md:pb-6">
      {/* 폰: 화면 위 검색창. PC 는 탭줄의 검색창을 쓴다 */}
      <div className="md:hidden">
        <SearchBox value={q} onChange={change} autoFocus />
      </div>
      <SearchResults q={q} />
    </div>
  );
}
