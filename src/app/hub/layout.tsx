import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase-admin";
import Header from "@/components/Header";
import NavBar from "@/components/NavBar";
import HubTabs from "./HubTabs";
import { HubMobileHeader, HubMobileTabs } from "./HubMobileNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 폰 홈 화면에 "업무관리"로 따로 설치할 수 있게 한다.
// 아이콘을 누르면 주소창 없이 /hub 로 바로 열린다.
export const metadata: Metadata = {
  title: "업무관리",
  manifest: "/hub.webmanifest",
  appleWebApp: { capable: true, title: "업무관리", statusBarStyle: "default" },
  icons: { apple: "/hub-apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FEE500",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const supabase = getSupabase();

  // 업무관리 권한 확인 — 화면에서 버튼을 숨기는 것과 별개로 여기서 실제로 막는다
  const { data: hubUser } = await supabase
    .from("users")
    .select("hub_enabled")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!hubUser?.hub_enabled) {
    redirect("/dashboard");
  }

  const { data: settingsData } = await supabase
    .from("system_settings")
    .select("system_name")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PC: B카운트 헤더와 네비바를 그대로 쓴다 */}
      <div className="hidden md:block">
        <Header
          companyName={session.company.company_name}
          userName={session.user.name}
          userId={session.user.user_id}
          userRole={session.user.role}
          systemName={settingsData?.system_name}
          impersonated={session.impersonated}
        />
        <NavBar role={session.user.role} hubEnabled />
      </div>

      {/* 폰: 독립된 앱처럼 보이게 한다 */}
      <HubMobileHeader />

      <main className="px-4 py-4 md:p-6">
        <div className="hidden md:block">
          <HubTabs />
        </div>
        {children}
      </main>

      <HubMobileTabs />
    </div>
  );
}
