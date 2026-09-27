import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCompanyFeatures } from "@/lib/features";
import { getSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "B-PRINT" };

// B-PRINT 내려받기 화면 — B-imposition 과 따로 파는 상품이라 feat_print 를 켠 업체만 들어온다.
// 프로그램은 내려받아 설치한 뒤, 처음 한 번 업체ID·아이디·비밀번호로 로그인해야 열린다(B-imposition 과 같은 방식).
export default async function BPrintPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const f = await getCompanyFeatures(session.company.id);
  if (!f.print) redirect("/dashboard");

  const { data: rel } = await getSupabase()
    .from("program_releases")
    .select("file_name, version, size_bytes, note, updated_at")
    .eq("key", "bprint")
    .maybeSingle();

  const day = rel?.updated_at
    ? new Date(rel.updated_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    : "";
  const mb = rel?.size_bytes ? (rel.size_bytes / 1048576).toFixed(1) + " MB" : "";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">B-PRINT</h1>
          {rel?.version && <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold">v{rel.version}</span>}
          <span className="text-sm text-gray-500">PDF 편집·조판 윈도우 프로그램</span>
        </div>

        <p className="text-sm text-gray-600 mt-3 leading-7">
          여러 PDF를 한 파일로 묶고, N-up 조판·쪽번호·배경·흑백 변환·아웃라인까지 PC에서 처리합니다.
          파일은 서버로 올라가지 않고 PC 안에서만 처리됩니다.
        </p>

        <div className="mt-6">
          {rel ? (
            <a
              href="/api/program-releases/bprint/download"
              className="inline-block px-6 py-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded font-bold"
            >
              B-PRINT 프로그램 다운로드{rel.version ? ` (v${rel.version}${day ? " · " + day : ""})` : ""}
            </a>
          ) : (
            <span className="inline-block px-6 py-3 bg-gray-200 text-gray-500 rounded font-bold">아직 올라온 배포 파일이 없습니다</span>
          )}
          {rel && (
            <div className="text-xs text-gray-500 mt-2">
              {rel.file_name}
              {mb ? ` · ${mb}` : ""}
              {rel.note ? ` · ${rel.note}` : ""}
            </div>
          )}
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-4 text-sm">
          <div className="border border-gray-200 rounded p-4">
            <div className="font-bold mb-2">설치와 로그인</div>
            <ol className="list-decimal pl-5 space-y-1 text-gray-600 leading-6">
              <li>받은 zip 을 압축 풀고 폴더 안의 <b>BPrint.exe</b> 를 실행합니다.</li>
              <li>처음 한 번 <b>업체ID · 아이디 · 비밀번호</b>로 로그인합니다 (Bcount 계정과 같습니다).</li>
              <li>다음부터는 바로 열립니다. 실행할 때마다 사용 권한을 확인합니다.</li>
            </ol>
          </div>
          <div className="border border-gray-200 rounded p-4">
            <div className="font-bold mb-2">이 프로그램이 하는 일</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-600 leading-6">
              <li>여러 PDF 결합 (빈 페이지 보정 · 크기/방향 맞춤)</li>
              <li>N-up 조판 (용지·이미지 크기·간격·여백·테두리)</li>
              <li>머리말·꼬리말과 쪽번호</li>
              <li>배경 넣기 (색 · 이미지 · PDF)</li>
              <li>흑백 변환 (먹 1도) · 서체 아웃라인</li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          B-PRINT 는 B-imposition 과 별개 상품입니다. 사용 권한은 업체별로 따로 열립니다.
        </p>
      </div>
    </div>
  );
}
