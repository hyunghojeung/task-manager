"use client";

import { usePathname } from "next/navigation";

export default function SalesTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/sales", label: "매출리스트", badge: "기본" },
    { href: "/dashboard/sales/summary", label: "매출집계", badge: "분석" },
  ];
  return (
    <nav className="flex gap-1 mb-3 border-b-2 border-[#3b4b5b] pl-1 print:hidden">
      {tabs.map(t => {
        const active = pathname === t.href;
        return (
          <a
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-semibold rounded-t border border-b-0 -mb-[1px] inline-flex items-center gap-2 ${
              active
                ? "bg-[#3b4b5b] text-white border-[#3b4b5b]"
                : "bg-gray-100 text-gray-600 hover:bg-white hover:text-gray-800 border-gray-300"
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${active ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"}`}>{t.badge}</span>
          </a>
        );
      })}
    </nav>
  );
}
