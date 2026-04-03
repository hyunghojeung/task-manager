"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

interface POItem { product_name: string; spec: string; paper_grain: string; cut_size: string; quantity: string; received: string }
interface POData { po_no: string; po_date: string; supplier_name: string; orderer: string; contact: string; request_note: string; purchase_order_items?: POItem[] }
interface CompanyData { company_name: string; business_number: string; representative: string; address: string; phone: string; fax: string; email: string }

function PrintContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [po, setPo] = useState<POData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [faxNumber, setFaxNumber] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/purchase-orders/${id}?_=${Date.now()}`).then(r => r.json()).then(setPo);
    fetch(`/api/company?_=${Date.now()}`).then(r => r.json()).then(setCompany);
  }, [id]);

  if (!id) return <div className="p-10 text-center text-gray-500">ID가 없습니다.</div>;
  if (!po || !company) return <div className="min-h-screen flex items-center justify-center text-gray-400">로딩중...</div>;

  const items = (po.purchase_order_items || []).filter(it => it.product_name || it.spec || it.quantity);
  const emptyRows = Math.max(7 - items.length, 0);

  return (
    <div className="min-h-screen bg-gray-100 py-5 print:bg-white print:py-0">
      <div className="print-wrap max-w-[800px] mx-auto bg-white p-8 md:p-10 shadow print:shadow-none print:p-5">
        <h1 className="text-center text-3xl font-black tracking-[20px] text-gray-800 py-3 border-t-[3px] border-b-[3px] border-double border-gray-800 mb-6">
          발 주 서
        </h1>

        <div className="flex justify-between mb-4 text-sm">
          <div>
            <p className="mb-1"><strong>일 자</strong>&nbsp;&nbsp; {po.po_date}</p>
            <p className="mb-4"><strong>수 신</strong>&nbsp;&nbsp; {po.supplier_name} 귀하</p>
            <p><strong>발주번호</strong>&nbsp;&nbsp; {po.po_no}</p>
          </div>
          <table className="border-collapse text-xs">
            <tbody>
              <tr><td colSpan={2} className="border border-gray-800 bg-gray-50 px-2 py-1 text-center font-bold">공급자정보</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1 w-[100px]">사업자등록번호</th><td className="border border-gray-800 px-2 py-1">{company.business_number || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1">상 호</th><td className="border border-gray-800 px-2 py-1">{company.company_name}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1">대표자</th><td className="border border-gray-800 px-2 py-1">{company.representative || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1">TEL / FAX</th><td className="border border-gray-800 px-2 py-1">{company.phone || "-"} / {company.fax || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1">주 소</th><td className="border border-gray-800 px-2 py-1">{company.address || "-"}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="text-left text-sm mb-2 p-2 border border-gray-200 rounded"><strong>주문자:</strong> {po.orderer} &nbsp; {po.contact}</div>
        <div className="text-sm mb-4"><strong>요청사항:</strong><br/>{po.request_note}</div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-gray-800 bg-gray-100 px-2 py-2 w-10">순번</th>
              <th className="border border-gray-800 bg-gray-100 px-2 py-2">품목명</th>
              <th className="border border-gray-800 bg-gray-100 px-2 py-2 w-[80px]">규격(원지)</th>
              <th className="border border-gray-800 bg-gray-100 px-2 py-2 w-[55px]">종이결</th>
              <th className="border border-gray-800 bg-gray-100 px-2 py-2 w-[70px]">주문수량</th>
              <th className="border border-gray-800 bg-gray-100 px-2 py-2 w-[70px]">재단사이즈</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-2 py-2 text-center">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-2 text-left">{it.product_name}</td>
                <td className="border border-gray-300 px-2 py-2 text-center">{it.spec}</td>
                <td className="border border-gray-300 px-2 py-2 text-center">{it.paper_grain}</td>
                <td className="border border-gray-300 px-2 py-2 text-center">{it.quantity}</td>
                <td className="border border-gray-300 px-2 py-2 text-center">{it.cut_size}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }, (_, i) => (
              <tr key={`e${i}`}>
                <td className="border border-gray-300 px-2 py-2 text-center">&nbsp;</td>
                <td className="border border-gray-300 px-2 py-2"></td>
                <td className="border border-gray-300 px-2 py-2"></td>
                <td className="border border-gray-300 px-2 py-2"></td>
                <td className="border border-gray-300 px-2 py-2"></td>
                <td className="border border-gray-300 px-2 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="max-w-[800px] mx-auto mt-3 flex flex-col gap-2 print:hidden">
        <div className="flex gap-2 items-center">
          <label className="text-sm">수신 팩스번호:</label>
          <input type="text" placeholder="팩스번호를 입력하세요" value={faxNumber} onChange={e => setFaxNumber(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm w-52" />
          <button className="px-4 py-1.5 bg-gray-700 text-white rounded text-sm">발송</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white rounded text-sm">인쇄</button>
          <button onClick={() => window.close()} className="px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded text-sm">닫기</button>
        </div>
      </div>
    </div>
  );
}

export default function PrintPurchaseOrderPage() {
  return <Suspense fallback={<div className="p-10 text-center text-gray-400">로딩중...</div>}><PrintContent /></Suspense>;
}
