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
      <NavBar />
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
