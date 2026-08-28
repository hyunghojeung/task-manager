import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SalesTabs from "./SalesTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.user.role !== "super_admin") redirect("/dashboard");
  return (
    <div>
      <SalesTabs />
      {children}
    </div>
  );
}
