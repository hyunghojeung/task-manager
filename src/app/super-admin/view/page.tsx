"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface CompanyInfo { id: string; company_id: string; company_name: string }

function ViewContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("company");
  const type = searchParams.get("type") || "orders";
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/admin/company-data?companyId=${companyId}&type=${type}&_=${Date.now()}`)
      .then(r => r.json())
      .then(d => { setCompany(d.company); setData(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, type]);

  const typeLabel = type === "orders" ? "작업리스트" : type === "memos" ? "작업메모" : "발주서";

  if (!companyId) return <div className="p-10 text-center text-gray-500">company 파라미터가 없습니다.</div>;
  if (loading) return <div className="p-10 text-center text-gray-400">로딩중...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg font-bold">Platform Admin - <a href="/super-admin/dashboard" className="text-blue-400 no-underline">Blackcopy.kr</a></h1>
        <div className="flex items-center gap-3 text-sm">
          <span>최고관리자</span>
          <a href="/super-admin/dashboard" className="text-slate-400 hover:text-white">돌아가기</a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-gray-200">
            <h3 className="text-base font-bold text-gray-800">
              <span className="text-blue-600">{company?.company_name}</span> ({company?.company_id}) - {typeLabel}
              <span className="ml-2 text-sm font-normal text-gray-500">총 {data.length}건</span>
            </h3>
            <a href="/super-admin/dashboard" className="px-4 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50">업체관리로 돌아가기</a>
          </div>

          {type === "orders" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs border border-gray-300">
                <thead><tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 px-2 py-2.5 w-10">번호</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[120px]">작업번호</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[120px]">거래처</th>
                  <th className="border border-slate-700 px-2 py-2.5">작업명</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[100px]">금액</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[70px]">상태</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[100px]">등록일</th>
                </tr></thead>
                <tbody>
                  {data.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr> :
                  data.map((o, i) => (
                    <tr key={o.id as string} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                      <td className="border border-gray-200 px-2 py-2 text-center">{i + 1}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{o.order_no as string}</td>
                      <td className="border border-gray-200 px-2 py-2 text-left">{o.client_name as string}</td>
                      <td className="border border-gray-200 px-2 py-2 text-left">{o.title as string}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right">{((o.total_amount as number) || 0).toLocaleString()}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${o.status === "completed" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                          {o.status === "completed" ? "완료" : "진행중"}
                        </span>
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{(o.created_at as string)?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {type === "memos" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs border border-gray-300">
                <thead><tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 px-2 py-2.5 w-10">번호</th>
                  <th className="border border-slate-700 px-2 py-2.5">제목</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[130px]">작성자</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[100px]">작성일</th>
                </tr></thead>
                <tbody>
                  {data.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr> :
                  data.map((m, i) => (
                    <tr key={m.id as string} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                      <td className="border border-gray-200 px-2 py-2 text-center">{i + 1}</td>
                      <td className="border border-gray-200 px-2 py-2 text-left">{m.title as string}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{m.author as string || "-"}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{(m.created_at as string)?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {type === "purchase-orders" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs border border-gray-300">
                <thead><tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 px-2 py-2.5 w-10">번호</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[140px]">발주No.</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[100px]">발주일</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[130px]">발주처</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[90px]">발주자</th>
                  <th className="border border-slate-700 px-2 py-2.5">요청사항</th>
                  <th className="border border-slate-700 px-2 py-2.5 w-[100px]">등록일</th>
                </tr></thead>
                <tbody>
                  {data.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr> :
                  data.map((po, i) => (
                    <tr key={po.id as string} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                      <td className="border border-gray-200 px-2 py-2 text-center">{i + 1}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{po.po_no as string}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{po.po_date as string}</td>
                      <td className="border border-gray-200 px-2 py-2 text-left">{po.supplier_name as string}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{po.orderer as string || "-"}</td>
                      <td className="border border-gray-200 px-2 py-2 text-left">{(po.request_note as string)?.slice(0, 50) || "-"}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{(po.created_at as string)?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminViewPage() {
  return <Suspense fallback={<div className="p-10 text-center text-gray-400">로딩중...</div>}><ViewContent /></Suspense>;
}
