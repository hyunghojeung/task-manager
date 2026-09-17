import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCompanyFeatures } from "@/lib/features";
import SalesTabs from "./SalesTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.user.role !== "super_admin") redirect("/dashboard");
  // 최고관리자가 매출 기능을 켜 준 업체만
  if (!(await getCompanyFeatures(session.company.id)).sales) redirect("/dashboard");
  return (
    <div>
      <SalesTabs />
      {children}
    </div>
  );
}
