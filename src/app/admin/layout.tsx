import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase-admin";
import Header from "@/components/Header";
import NavBar from "@/components/NavBar";
import { getCompanyFeatures } from "@/lib/features";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = getSupabase();
  const { data: settingsData } = await supabase
    .from("system_settings")
    .select("system_name")
    .eq("id", 1)
    .maybeSingle();

  // 업무관리 사용 권한 — 네비바 버튼 표시용
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
        systemName={settingsData?.system_name}
        impersonated={session.impersonated}
      />
      <NavBar role={session.user.role} hubEnabled={hubUser?.hub_enabled ?? false} features={await getCompanyFeatures(session.company.id)} />
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
