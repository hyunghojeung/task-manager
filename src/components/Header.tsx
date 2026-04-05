"use client";

import { useRouter } from "next/navigation";

interface HeaderProps {
  companyName?: string;
  userName?: string;
  userId?: string;
  userRole?: string;
  bannerText?: string;
  bannerLink?: string;
  bannerButton?: string;
  systemName?: string;
  impersonated?: boolean;
}

export default function Header({ companyName, userName, userId, userRole, bannerText, bannerLink, bannerButton, systemName, impersonated }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="sticky top-0 z-50 print:hidden">
      {impersonated && (
        <div className="bg-red-600 text-white px-4 py-1.5 text-center text-xs font-bold flex items-center justify-center gap-3">
          <span>⚠️ 수퍼관리자 모드: {companyName} 업체로 접속 중</span>
          <a href="/super-admin/dashboard" className="underline hover:text-red-100">수퍼관리자로 돌아가기</a>
        </div>
      )}
      {/* 메인 헤더 */}
      <div className="bg-slate-800 text-white px-4 md:px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg md:text-xl font-bold flex items-center gap-3">
          <a href="/dashboard" className="text-white no-underline">{systemName || "Bcount ERP"}</a>
          {companyName && (
            <span className="text-xs md:text-sm text-blue-400">{companyName}</span>
          )}
        </h1>
        <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm">
          {userName && <span>{userName}님 ({userId})</span>}
          {userRole === "admin" && (
            <a href="/admin" className="text-slate-400 hover:text-white transition">관리자</a>
          )}
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition">
            로그아웃
          </button>
          <a href="/dashboard/board" className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] md:text-xs whitespace-nowrap transition">프로그램 문의</a>
        </div>
      </div>

      {/* 홍보 배너 */}
      <div
        className={`bg-gradient-to-r from-slate-800 via-blue-600 to-sky-500 px-4 md:px-6 py-2.5 flex justify-between items-center${bannerLink ? " cursor-pointer" : ""}`}
        onClick={() => { if (bannerLink) window.open(bannerLink, "_blank"); }}
      >
        <span className="text-white text-xs md:text-sm font-bold">
          {bannerText || "인쇄/출력 작업기록, 견적서, 거래명세서, 발주서까지 올인원 업무관리"}
        </span>
        <div className="flex items-center gap-2">
          <span className="bg-amber-400 text-slate-900 px-3 py-0.5 rounded-full text-xs font-bold">{bannerButton || "FREE"}</span>
          <span className="text-slate-400 text-xs">AD</span>
        </div>
      </div>
    </div>
  );
}
