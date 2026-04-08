import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase-admin";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from("system_settings").select("og_title, og_description, og_url, og_site_name").eq("id", 1).maybeSingle();
    const title = data?.og_title || "Blackcopy.kr | 인쇄전용 ERP Bcount";
    const description = data?.og_description || "인쇄/출력 작업기록, 견적서, 거래명세서, 발주서까지 올인원 업무관리";
    const url = data?.og_url || "https://blackcopy.kr";
    const siteName = data?.og_site_name || "Blackcopy.kr";
    return {
      title,
      description,
      keywords: "인쇄, ERP, 견적서, 거래명세서, 발주서, 업무관리, 인쇄관리",
      openGraph: { title, description, url, siteName, type: "website" },
    };
  } catch {
    return {
      title: "Blackcopy.kr | 인쇄전용 ERP Bcount",
      description: "인쇄/출력 작업기록, 견적서, 거래명세서, 발주서까지 올인원 업무관리",
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-gray-50">
        {children}
      </body>
    </html>
  );
}
