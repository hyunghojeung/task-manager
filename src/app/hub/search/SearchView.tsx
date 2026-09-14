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
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("popstate", read);
    };
  }, []);

  function change(v: string) {
    setQ(v);
    const url = v.trim() ? `/hub/search?q=${encodeURIComponent(v.trim())}` : "/hub/search";
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="w-full flex flex-col gap-3 pb-28 md:pb-6">
      {/* 검색창 — 일정·개인메모·갤러리 탭과 같은 자리·모양 */}
      <SearchBox value={q} onChange={change} autoFocus />
      <SearchResults q={q} />
    </div>
  );
}
