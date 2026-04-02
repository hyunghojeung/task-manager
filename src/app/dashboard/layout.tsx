import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase-admin";
import Header from "@/components/Header";
import NavBar from "@/components/NavBar";
import NoticeBar from "@/components/NoticeBar";

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companyName={session.company.company_name}
        userName={session.user.name}
        userId={session.user.user_id}
        userRole={session.user.role}
      />
      <NoticeBar notices={notices || []} />
      <NavBar />
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
