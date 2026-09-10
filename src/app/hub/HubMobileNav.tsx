"use client";

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/hub", label: "일정", path: "M4 5.5h16v15H4zM4 10h16M8.5 3v4M15.5 3v4" },
  { href: "/hub/gallery", label: "갤러리", path: "M4 5h16v14H4zM4 15l4.5-4.5 4 4L16 11l4 4" },
  { href: "/hub/memo", label: "개인메모", path: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5" },
];

function activeOf(pathname: string) {
  return TABS.find((t) => (t.href === "/hub" ? pathname === "/hub" : pathname.startsWith(t.href)));
}

/** 폰에서만 보이는 앱 머리말 — B카운트 헤더 대신 */
export function HubMobileHeader() {
  const pathname = usePathname();
  const cur = activeOf(pathname);

  return (
    <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 pt-3 pb-2.5 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-gray-900">{cur?.label || "업무관리"}</span>
        <span className="text-xs text-gray-400">업무관리</span>
      </div>
      <a
        href="/dashboard"
        className="text-xs text-gray-500 border border-gray-300 rounded px-2.5 py-1 whitespace-nowrap"
      >
        B카운트 ›
      </a>
    </div>
  );
}

/** 폰에서만 보이는 하단 탭바 */
export function HubMobileTabs() {
  const pathname = usePathname();
  const cur = activeOf(pathname);

  return (
    <nav
      className="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((t) => {
        const on = cur?.href === t.href;
        return (
          <a
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px] ${
              on ? "text-[#191919] font-bold" : "text-gray-400"
            }`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d={t.path} />
            </svg>
            <span>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
