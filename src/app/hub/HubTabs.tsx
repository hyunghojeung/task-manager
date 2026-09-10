"use client";

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/hub", label: "일정" },
  { href: "/hub/gallery", label: "갤러리" },
  { href: "/hub/memo", label: "개인메모" },
];

export default function HubTabs() {
  const pathname = usePathname();

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
    </div>
  );
}
