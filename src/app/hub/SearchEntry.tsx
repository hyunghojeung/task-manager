"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBox from "./SearchBox";

// 통합검색 입구 — 일정 탭 맨 위(개인메모·갤러리 검색창과 같은 자리·모양)에 놓인다.
// 치면 잠시 뒤 검색 화면(/hub/search)으로 넘어가고, 거기서도 같은 자리에 같은 검색창이 이어진다.
export default function SearchEntry() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function change(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    const t = v.trim();
    if (!t) return;
    timer.current = setTimeout(() => router.push(`/hub/search?q=${encodeURIComponent(t)}`), 300);
  }

  return <SearchBox value={q} onChange={change} />;
}
