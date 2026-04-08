"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface OrderItemRow { sort_order: number; data: Record<string, string> }
interface OrderData { id: string; order_no: string; client_name: string; title: string; total_amount: number; total_supply: number; total_vat: number; discount: number; created_at: string; order_items?: OrderItemRow[] }
interface CompanyData { company_name: string; business_number: string; representative: string; address: string; business_type: string; business_category: string; phone: string; email: string }

function fmt(n: number) { return (n || 0).toLocaleString(); }
function numToKorean(n: number): string {
  if (!n) return "";
  const units = ["", "만", "억"];
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const smalls = ["", "십", "백", "천"];
  let result = "";
  let unitIdx = 0;
  while (n > 0) {
    const chunk = n % 10000;
    if (chunk > 0) {
      let chunkStr = "";
      let c = chunk;
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10;
        if (d > 0) chunkStr = digits[d] + smalls[i] + chunkStr;
        c = Math.floor(c / 10);
      }
      result = chunkStr + units[unitIdx] + result;
    }
    n = Math.floor(n / 10000);
    unitIdx++;
  }
  return result + "원 정";
}

export default function EstimatePage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${orderId}?_=${Date.now()}`).then(r => r.json()).then(d => setOrder(d));
    fetch(`/api/company?_=${Date.now()}`).then(r => r.json()).then(d => setCompany(d));
  }, [orderId]);

  async function handleSendEmail() {
    if (!emailTo) { alert("수신 이메일을 입력해주세요."); return; }
    setSending(true);
    try {
      const pageHtml = document.querySelector(".print-wrap")?.innerHTML || "";
      const res = await fetch("/api/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, subject: "견적서", html: `<div style="font-family:sans-serif;">${pageHtml}</div>` }),
      });
      if (res.ok) alert("이메일이 발송되었습니다.");
      else { const d = await res.json(); alert(d.error || "발송 실패"); }
    } catch { alert("발송 실패"); }
    finally { setSending(false); }
  }

  if (!orderId) return <div className="p-10 text-center text-gray-500">주문 ID가 없습니다.</div>;
  if (!order || !company) return <div className="p-10 text-center text-gray-400">로딩중...</div>;

  const rawItems = (order.order_items || []).sort((a, b) => a.sort_order - b.sort_order).map(it => it.data);
  const items = rawItems.filter(d => Object.values(d).some(v => v));

  const allKeys = items.length > 0 ? Object.keys(items[0]) : [];
  const nameKey = allKeys.find(k => k.includes("품목") || k.includes("품명") || k.includes("작업")) || allKeys[0] || "품목명";
  const qtyKey = allKeys.find(k => k.includes("수량")) || "";
  const priceKey = allKeys.find(k => k.includes("단가")) || "";
  const supplyKey = allKeys.find(k => k.includes("공급")) || "";
  const vatKey = allKeys.find(k => k.includes("부가")) || "";

  const supplyTotal = items.reduce((acc, d) => acc + (supplyKey && d[supplyKey] ? parseInt(d[supplyKey]) || 0 : 0), 0);
  const vatTotal = items.reduce((acc, d) => acc + (vatKey && d[vatKey] ? parseInt(d[vatKey]) || 0 : 0), 0);
  const discountAmt = order.discount || 0;
  const finalAmount = (order.total_amount || 0) - discountAmt;
  const orderDate = new Date(order.created_at);
  const dateStr = `${orderDate.getFullYear()}년 ${String(orderDate.getMonth() + 1).padStart(2, "0")}월 ${String(orderDate.getDate()).padStart(2, "0")}일`;
  const emptyRows = Math.max(8 - items.length, 0);

  return (
    <div className="min-h-screen bg-gray-100 py-5 print:bg-white print:py-0">
      <div className="print-wrap max-w-[800px] mx-auto bg-white p-8 md:p-10 shadow print:shadow-none print:p-5">
        <p className="text-sm text-gray-700 mb-5">No. {order.order_no}</p>
        <h1 className="text-center text-3xl font-black tracking-[24px] text-gray-800 py-3 border-t-[3px] border-b-[3px] border-double border-gray-800 mb-6">
          견 적 서
        </h1>

        <div className="flex justify-between mb-2 text-sm">
          <div>
            <p className="mb-1"><strong>견적일: {dateStr}</strong></p>
            <p className="mb-4"><strong>업체명: {order.client_name} 귀하</strong></p>
            <p>아래와 같이 견적드립니다.</p>
          </div>
          <table className="border-collapse text-xs">
            <tbody>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1 w-[70px]">등록번호</th><td className="border border-gray-800 px-2 py-1" colSpan={3}>{company.business_number || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1">상호(법인명)</th><td className="border border-gray-800 px-2 py-1">{company.company_name}</td><th className="border border-gray-800 bg-gray-50 px-2 py-1">성명</th><td className="border border-gray-800 px-2 py-1">{company.representative || "[직인]"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1">주소</th><td className="border border-gray-800 px-2 py-1" colSpan={3}>{company.address || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1">업태</th><td className="border border-gray-800 px-2 py-1">{company.business_type || "-"}</td><th className="border border-gray-800 bg-gray-50 px-2 py-1">종목</th><td className="border border-gray-800 px-2 py-1">{company.business_category || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1">TEL / E-mail</th><td className="border border-gray-800 px-2 py-1" colSpan={3}>{company.phone || "-"} / {company.email || "-"}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center my-4 px-4 py-3 border-2 border-red-600 text-base font-bold">
          <span>금 액 : {numToKorean(finalAmount)}</span>
          <span className="text-red-600">(# {fmt(finalAmount)} / VAT포함)</span>
        </div>

        <p className="text-lg font-extrabold text-gray-800 my-4">작업명: {order.title}</p>

        <table className="w-full border-collapse text-sm mb-4">
          <thead>
            <tr className="bg-red-50">
              <th className="border border-red-600 px-2 py-2 w-12">순번</th><th className="border border-red-600 px-2 py-2">품목명(규격)</th><th className="border border-red-600 px-2 py-2 w-14">수량</th><th className="border border-red-600 px-2 py-2 w-16">단가</th><th className="border border-red-600 px-2 py-2 w-20">공급가액</th><th className="border border-red-600 px-2 py-2 w-16">부가세</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-2 py-2 text-center">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-2 text-left">{d[nameKey] || ""}</td>
                <td className="border border-gray-300 px-2 py-2 text-center">{qtyKey ? d[qtyKey] || "" : ""}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{priceKey && d[priceKey] ? parseInt(d[priceKey]).toLocaleString() : ""}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{supplyKey && d[supplyKey] ? parseInt(d[supplyKey]).toLocaleString() : ""}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{vatKey && d[vatKey] ? parseInt(d[vatKey]).toLocaleString() : ""}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }, (_, i) => (
              <tr key={`e${i}`}><td className="border border-gray-300 px-2 py-2 text-center">&nbsp;</td><td className="border border-gray-300 px-2 py-2"></td><td className="border border-gray-300 px-2 py-2"></td><td className="border border-gray-300 px-2 py-2"></td><td className="border border-gray-300 px-2 py-2"></td><td className="border border-gray-300 px-2 py-2"></td></tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <table className="border-collapse text-sm">
            <tbody>
              <tr>
                <th className="border border-gray-800 bg-gray-100 px-3 py-2">공급가액 합계</th>
                <td className="border border-gray-800 px-3 py-2 text-right min-w-[100px]">{fmt(supplyTotal)}</td>
                <th className="border border-gray-800 bg-gray-100 px-3 py-2">부가세 합계</th>
                <td className="border border-gray-800 px-3 py-2 text-right min-w-[100px]">{fmt(vatTotal)}</td>
                <th className="border border-gray-800 bg-gray-100 px-3 py-2">총 액</th>
                <td className="border border-gray-800 px-3 py-2 text-right font-bold min-w-[100px]">{fmt(finalAmount)}</td>
              </tr>
              {discountAmt > 0 && (
                <tr>
                  <td className="border border-gray-800 px-3 py-1 text-right text-xs text-gray-500" colSpan={4}></td>
                  <th className="border border-gray-800 bg-gray-50 px-3 py-1 text-xs text-gray-500">할인</th>
                  <td className="border border-gray-800 px-3 py-1 text-right text-xs text-gray-500">-{fmt(discountAmt)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto mt-3 flex flex-col gap-2 print:hidden">
        <div className="flex gap-2 items-center">
          <label className="text-sm">수신 이메일:</label>
          <input type="email" placeholder="이메일 주소를 입력하세요" value={emailTo} onChange={e => setEmailTo(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm w-64" />
          <button onClick={handleSendEmail} disabled={sending} className="px-4 py-1.5 bg-gray-700 text-white rounded text-sm disabled:opacity-50">{sending ? "발송중..." : "발송"}</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white rounded text-sm">인쇄</button>
          <button onClick={() => window.close()} className="px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded text-sm">닫기</button>
        </div>
      </div>
    </div>
  );
}
