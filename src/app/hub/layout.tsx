import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase-admin";
import Header from "@/components/Header";
import NavBar from "@/components/NavBar";
import HubTabs from "./HubTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      <Header
        companyName={session.company.company_name}
        userName={session.user.name}
        userId={session.user.user_id}
        userRole={session.user.role}
        systemName={settingsData?.system_name}
        impersonated={session.impersonated}
      />
      <NavBar role={session.user.role} hubEnabled />
      <main className="p-4 md:p-6">
        <HubTabs />
        {children}
      </main>
    </div>
  );
}
