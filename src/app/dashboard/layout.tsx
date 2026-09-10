import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase-admin";
import Header from "@/components/Header";
import NavBar from "@/components/NavBar";
import NoticeBar from "@/components/NoticeBar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  // 작업전달 공지 조회
  const supabase = getSupabase();
  const { data: notices } = await supabase
    .from("notices")
    .select("id, title, content, created_at, is_completed")
    .eq("company_id", session.company.id)
    .eq("is_completed", false)
    .order("created_at", { ascending: false });

  // 광고 배너 조회
  const { data: bannerData } = await supabase
    .from("advertisements")
    .select("content, link_url, button_text")
    .eq("type", "banner")
    .eq("is_active", true)
    .limit(1)
    .single();

  // 시스템 설정 조회
  const { data: settingsData } = await supabase
    .from("system_settings")
    .select("system_name")
    .eq("id", 1)
    .maybeSingle();

  // 업무관리 사용 권한 (관리자가 사용자별로 지정) — 세션이 아니라 매번 조회해서
  // 관리자가 켜면 재로그인 없이 새로고침만으로 반영되게 한다
  const { data: hubUser } = await supabase
    .from("users")
    .select("hub_enabled")
    .eq("id", session.user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companyName={session.company.company_name}
        userName={session.user.name}
        userId={session.user.user_id}
        userRole={session.user.role}
        bannerText={bannerData?.content}
        bannerLink={bannerData?.link_url}
        bannerButton={bannerData?.button_text}
        systemName={settingsData?.system_name}
        impersonated={session.impersonated}
      />
      <NoticeBar notices={notices || []} />
      <NavBar role={session.user.role} hubEnabled={hubUser?.hub_enabled ?? false} />
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
