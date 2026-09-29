"use client";

import { usePathname } from "next/navigation";

// 고른 탭은 그 화면의 색으로 채운다 — 어느 화면을 보고 있는지 한눈에 알 수 있게
const TABS = [
  { href: "/hub", label: "일정", on: "bg-[#FEE500] text-[#191919]" },
  { href: "/hub/gallery", label: "갤러리", on: "bg-[#2F5FD0] text-white" },
  { href: "/hub/memo", label: "메모", on: "bg-[#2F855A] text-white" },
];

export default function HubTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2 border-b-2 border-gray-200 pb-2.5 mb-4 overflow-x-auto print:hidden">
      <h2 className="text-lg md:text-xl font-bold text-gray-900 pr-3 whitespace-nowrap">업무관리</h2>
      {TABS.map((t) => {
        const active = pathname === t.href || (t.href !== "/hub" && pathname.startsWith(t.href));
        return (
          <a
            key={t.href}
            href={t.href}
            className={`px-4 md:px-5 py-2 md:py-2.5 rounded-lg text-sm md:text-[15px] font-bold whitespace-nowrap transition ${
              active ? t.on : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </a>
        );
      })}
    </div>
  );
}
