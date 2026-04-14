"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface OrderItemRow { sort_order: number; data: Record<string, string> }
interface OrderData { id: string; order_no: string; client_name: string; title: string; total_amount: number; total_supply: number; total_vat: number; discount: number; template_name?: string; trade_type?: string; order_date: string; created_at: string; order_items?: OrderItemRow[] }
interface CompanyData { company_name: string; business_number: string; representative: string; address: string; business_type: string; business_category: string; phone: string; email: string; seal_image?: string; bank_name?: string; bank_account?: string; bank_holder?: string; bank_name_2?: string; bank_account_2?: string; bank_holder_2?: string; bank_name_3?: string; bank_account_3?: string; bank_holder_3?: string; default_bank?: number }

function fmt(n: number) { return (n || 0).toLocaleString(); }

function StatementContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [templates, setTemplates] = useState<Array<{name:string; columns: Array<{name:string;type:string}>}>>([]);
  const [templateCols, setTemplateCols] = useState<string[]>([]);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [bankIdx, setBankIdx] = useState<number>(1);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${orderId}?_=${Date.now()}`).then(r => r.json()).then(d => setOrder(d));
    fetch(`/api/company?_=${Date.now()}`).then(r => r.json()).then(d => { setCompany(d); if (d?.default_bank) setBankIdx(parseInt(d.default_bank) || 1); });
    fetch(`/api/templates?_=${Date.now()}`).then(r => r.json()).then(d => setTemplates(d || [])).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    if (!order || !templates.length) return;
    let tmpl = order.template_name ? templates.find(t => t.name === order.template_name) : null;
    if (!tmpl && order.order_items?.length) {
      const itemKeys = new Set(Object.keys(order.order_items.sort((a, b) => a.sort_order - b.sort_order)[0].data || {}));
      let bestMatch = 0;
      for (const t of templates) {
        const colNames = t.columns.filter(c => c.type !== "auto").map(c => c.name);
        const match = colNames.filter(n => itemKeys.has(n)).length;
        if (match > bestMatch) { bestMatch = match; tmpl = t; }
      }
    }
    if (!tmpl) tmpl = templates[0];
    setTemplateCols(tmpl.columns.filter(c => c.type !== "auto").map(c => c.name));
  }, [order, templates]);

  async function handleSendEmail() {
    if (!emailTo) { alert("수신 이메일을 입력해주세요."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/email-pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, orderId, type: "statement", customSubject: emailSubject || "", customFrom: emailFrom || "", bankIdx }),
      });
      if (res.ok) alert("이메일이 발송되었습니다. (PDF 첨부)");
      else { const d = await res.json().catch(() => ({})); alert("발송 실패: " + (d.error || res.status)); }
    } catch (e) { alert("발송 실패: " + (e instanceof Error ? e.message : "네트워크 오류")); }
    finally { setSending(false); }
  }

  if (!orderId) return <div className="p-10 text-center text-gray-500">주문 ID가 없습니다.</div>;
  if (!order || !company) return <div className="p-10 text-center text-gray-400">로딩중...</div>;

  const rawItems = (order.order_items || []).sort((a, b) => a.sort_order - b.sort_order).map(it => it.data);
  // 마지막 비어있지 않은 행까지 유지 (중간 빈 행 보존)
  let lastNonEmptyIdx = -1;
  rawItems.forEach((d, i) => {
    const hasContent = Object.entries(d).some(([k, v]) => k !== "_bold" && v);
    if (hasContent) lastNonEmptyIdx = i;
  });
  const items = rawItems.slice(0, lastNonEmptyIdx + 1);

  // 템플릿 컬럼 순서에 맞춰 정렬 (작업등록 양식과 동일)
  const rawKeys = items.length > 0 ? Object.keys(items[0]) : [];
  const allKeys = templateCols.length > 0
    ? templateCols.filter(k => rawKeys.includes(k))
    : rawKeys;
  const supplyKey = allKeys.find(k => k.includes("공급")) || "";
  const vatKey = allKeys.find(k => k.includes("부가")) || "";

  const supplyTotal = items.reduce((acc, d) => acc + (supplyKey && d[supplyKey] ? parseInt(d[supplyKey]) || 0 : 0), 0);
  const vatTotal = items.reduce((acc, d) => acc + (vatKey && d[vatKey] ? parseInt(d[vatKey]) || 0 : 0), 0);
  const discount = order.discount || 0;
  const grandTotal = (order.total_amount || 0) - discount;
  const orderDate = new Date(order.order_date || order.created_at);
  const dateStr = `${orderDate.getFullYear()}년 ${String(orderDate.getMonth() + 1).padStart(2, "0")}월 ${String(orderDate.getDate()).padStart(2, "0")}일`;
  const emptyRows = Math.max(8 - items.length, 0);

  return (
    <div className="min-h-screen bg-gray-100 py-5 print:bg-white print:py-0">
      <div className="print-wrap max-w-[800px] mx-auto bg-white p-8 md:p-10 shadow print:shadow-none print:p-5">
        <p className="text-sm text-gray-700 mb-5">No. {order.order_no}</p>
        <h1 className="text-center text-3xl font-black tracking-[20px] text-gray-800 py-3 border-t-[3px] border-b-[3px] border-double border-gray-800 mb-6">
          거 래 명 세 서
        </h1>

        <div className="flex justify-between mb-4 text-sm">
          <div>
            <p className="mb-1"><strong>납품일: {dateStr}</strong></p>
            <p className="mb-4"><strong>업체명: {order.client_name} 귀하</strong></p>
            <p>아래와 같이 납품합니다.</p>
          </div>
          <table className="border-collapse text-xs">
            <tbody>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1 w-[85px] whitespace-nowrap">등록번호</th><td className="border border-gray-800 px-2 py-1" colSpan={3}>{company.business_number || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1 whitespace-nowrap">상호(법인명)</th><td className="border border-gray-800 px-2 py-1">{company.company_name}</td><th className="border border-gray-800 bg-gray-50 px-2 py-1 whitespace-nowrap">성명</th><td className="border border-gray-800 px-2 py-1 relative"><span className="relative inline-block">{company.representative || "[직인]"}{company.seal_image && <img src={company.seal_image} alt="도장" className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-12 h-12 object-contain pointer-events-none" style={{opacity:0.85}} />}</span></td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1 whitespace-nowrap">주소</th><td className="border border-gray-800 px-2 py-1" colSpan={3}>{company.address || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1 whitespace-nowrap">업태</th><td className="border border-gray-800 px-2 py-1">{company.business_type || "-"}</td><th className="border border-gray-800 bg-gray-50 px-2 py-1 whitespace-nowrap">종목</th><td className="border border-gray-800 px-2 py-1">{company.business_category || "-"}</td></tr>
              <tr><th className="border border-gray-800 bg-gray-50 px-2 py-1 whitespace-nowrap">TEL / E-mail</th><td className="border border-gray-800 px-2 py-1" colSpan={3}>{company.phone || "-"} / {company.email || "-"}</td></tr>
            </tbody>
          </table>
        </div>

        <p className="text-lg font-extrabold text-gray-800 my-4">작업명: {order.title}</p>

        <table className="w-full border-collapse text-xs mb-4">
          <thead>
            <tr className="bg-[#3b4b5b] text-white">
              <th className="border border-[#2d3a47] px-2 py-2.5 font-semibold" style={{width:"35px"}}>순번</th>
              {allKeys.map(k => (
                <th key={k} className="border border-[#2d3a47] px-2 py-2.5 font-semibold">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((d, i) => {
              const isBold = d._bold === "1";
              const isEmpty = !Object.entries(d).some(([k, v]) => k !== "_bold" && v);
              return (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-2 text-center">{isEmpty ? <>&nbsp;</> : i + 1}</td>
                  {allKeys.map(k => {
                    const val = d[k] || "";
                    const isNum = /^\d+$/.test(val);
                    const num = isNum ? parseInt(val) : NaN;
                    const displayVal = isNum ? (num === 0 ? "" : num.toLocaleString()) : val;
                    const isNameCol = k.includes("품목") || k.includes("품명") || k.includes("작업");
                    return <td key={k} className={`border border-gray-300 px-2 py-2 ${isNum ? "text-right" : "text-left"} ${isNameCol ? "text-sm" : ""} ${isBold && isNameCol ? "font-bold" : ""}`}>{displayVal}</td>;
                  })}
                </tr>
              );
            })}
            {Array.from({ length: emptyRows }, (_, i) => (
              <tr key={`e${i}`}>
                <td className="border border-gray-300 px-2 py-2 text-center">&nbsp;</td>
                {allKeys.map(k => <td key={k} className="border border-gray-300 px-2 py-2"></td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <table className="border-collapse text-sm">
            <tbody>
              {order.trade_type === "cash" ? (
                <tr>
                  <th className="border border-gray-800 bg-gray-100 px-3 py-2">공급가액 합계</th>
                  <td className="border border-gray-800 px-3 py-2 text-right font-bold">{fmt(supplyTotal)}</td>
                </tr>
              ) : (
                <tr>
                  <th className="border border-gray-800 bg-gray-100 px-3 py-2">공급가액 합계</th>
                  <td className="border border-gray-800 px-3 py-2 text-right">{fmt(supplyTotal)}</td>
                  <th className="border border-gray-800 bg-gray-100 px-3 py-2">부가세 합계</th>
                  <td className="border border-gray-800 px-3 py-2 text-right">{fmt(vatTotal)}</td>
                  {discount > 0 && <>
                    <th className="border border-gray-800 bg-gray-100 px-3 py-2 text-red-700">할인</th>
                    <td className="border border-gray-800 px-3 py-2 text-right text-red-700">-{fmt(discount)}</td>
                  </>}
                  <th className="border border-gray-800 bg-gray-100 px-3 py-2">총 합계</th>
                  <td className="border border-gray-800 px-3 py-2 text-right font-bold">{fmt(grandTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {(() => {
          const suffix = bankIdx === 1 ? "" : `_${bankIdx}`;
          const name = (company as unknown as Record<string,string>)[`bank_name${suffix}`];
          const acc = (company as unknown as Record<string,string>)[`bank_account${suffix}`];
          const holder = (company as unknown as Record<string,string>)[`bank_holder${suffix}`];
          if (!name && !acc && !holder) return null;
          return (
            <div className="mt-6 pt-3 border-t border-gray-300 text-sm text-gray-700">
              <span className="font-bold mr-2">※ 입금 계좌:</span>
              {name && <span className="mr-3">{name}</span>}
              {acc && <span className="mr-3 font-semibold">{acc}</span>}
              {holder && <span>(예금주: {holder})</span>}
            </div>
          );
        })()}
      </div>

      <div className="max-w-[800px] mx-auto mt-3 flex flex-col gap-2 print:hidden">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm shrink-0">수신 이메일:</label>
          <input type="email" placeholder="이메일 주소를 입력하세요" value={emailTo} onChange={e => setEmailTo(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm w-64" />
          <button onClick={handleSendEmail} disabled={sending} className="px-4 py-1.5 bg-gray-700 text-white rounded text-sm disabled:opacity-50">{sending ? "발송중..." : "발송"}</button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm shrink-0">이메일 제목:</label>
          <input type="text" placeholder="미입력 시 자동생성" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm w-64" />
          <label className="text-sm shrink-0 ml-2">작성자명:</label>
          <input type="text" placeholder="미입력 시 업체명" value={emailFrom} onChange={e => setEmailFrom(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm w-40" />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm shrink-0">입금 계좌:</label>
          <select value={bankIdx} onChange={e => setBankIdx(parseInt(e.target.value))} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
            {[1, 2, 3].map(idx => {
              const suffix = idx === 1 ? "" : `_${idx}`;
              const name = (company as unknown as Record<string,string>)[`bank_name${suffix}`];
              const acc = (company as unknown as Record<string,string>)[`bank_account${suffix}`];
              if (!name && !acc) return null;
              const isDefault = (company.default_bank || 1) === idx;
              return <option key={idx} value={idx}>계좌{idx}: {name} {acc}{isDefault ? " (기본)" : ""}</option>;
            })}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white rounded text-sm">인쇄</button>
          <a href={`/api/pdf?id=${orderId}&type=statement&bankIdx=${bankIdx}`} className="px-6 py-2 bg-emerald-600 text-white rounded text-sm text-center">PDF 다운로드</a>
          <button onClick={() => window.close()} className="px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded text-sm">닫기</button>
        </div>
      </div>
    </div>
  );
}

export default function StatementPage() {
  return <Suspense fallback={<div className="p-10 text-center text-gray-400">로딩중...</div>}><StatementContent /></Suspense>;
}
