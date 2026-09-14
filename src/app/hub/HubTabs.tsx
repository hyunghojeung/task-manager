"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SearchBox from "./SearchBox";

const TABS = [
  { href: "/hub", label: "일정" },
  { href: "/hub/gallery", label: "갤러리" },
  { href: "/hub/memo", label: "개인메모" },
];

export default function HubTabs() {
  const pathname = usePathname();
  const router = useRouter();

  // 탭줄 오른쪽 통합검색 — 어느 탭에서든 치면 /hub/search 로 가서 그 자리에 결과가 나온다
  const onSearch = pathname === "/hub/search";
  const [q, setQ] = useState("");
  const [backTo, setBackTo] = useState("/hub");   // 검색어를 지우면 돌아갈 탭
  const [seenPath, setSeenPath] = useState(pathname);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 다른 탭으로 옮겨가면 검색창을 비우고 그 탭을 기억한다
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (!onSearch) { setQ(""); setBackTo(pathname); }
  }

  // 검색 화면이 주소의 ?q= 를 읽으면 알려준다 (주소로 바로 들어온 경우 검색창을 채운다)
  useEffect(() => {
    const sync = () => setQ(new URLSearchParams(window.location.search).get("q") || "");
    window.addEventListener("hub-search", sync);
    return () => window.removeEventListener("hub-search", sync);
  }, []);

  function change(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const t = v.trim();
      if (!t) {
        if (onSearch) router.push(backTo || "/hub");
        return;
      }
      const url = `/hub/search?q=${encodeURIComponent(t)}`;
      if (onSearch) {
        window.history.replaceState(null, "", url);
        window.dispatchEvent(new Event("hub-search"));
      } else {
        router.push(url);
      }
    }, 250);
  }

  return (
    <div className="flex items-center gap-1.5 border-b border-gray-200 pb-2 mb-4 overflow-x-auto print:hidden">
      <h2 className="text-base md:text-lg font-bold text-gray-900 pr-3 whitespace-nowrap">업무관리</h2>
      {TABS.map((t) => {
        const active = pathname === t.href || (t.href !== "/hub" && pathname.startsWith(t.href));
        return (
          <a
            key={t.href}
            href={t.href}
            className={`px-3.5 py-1.5 rounded text-xs md:text-sm whitespace-nowrap transition ${
              active
                ? "bg-[#FEE500] text-[#191919] font-bold"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </a>
        );
      })}
      <div className="ml-auto w-[340px] shrink-0">
        <SearchBox value={q} onChange={change} compact />
      </div>
    </div>
  );
}
