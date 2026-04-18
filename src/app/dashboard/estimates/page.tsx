"use client";

import React, { useState, useEffect, useCallback } from "react";

interface OrderData {
  id: string; order_no: string; client_name: string; orderer: string; contact: string;
  title: string; total_amount: number; discount: number; product_type: string; payment: string; status: string; author: string;
}

export default function EstimatesListPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("전체");
  const [searchField, setSearchField] = useState("전체");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState("text-base");
  const [year, setYear] = useState("전체");
  const [month, setMonth] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("listFontSize") : null;
    if (saved) setFontSize(saved);
  }, []);

  function changeFontSize(size: string) {
    setFontSize(size);
    if (typeof window !== "undefined") localStorage.setItem("listFontSize", size);
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20", mode: "estimates" });
    if (keyword) { params.set("keyword", keyword); params.set("searchField", searchField); }
    if (year !== "전체") {
      if (month !== "전체") {
        const m = month.padStart(2, "0");
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        params.set("startDate", `${year}-${m}-01`);
        params.set("endDate", `${year}-${m}-${String(lastDay).padStart(2, "0")}`);
      } else {
        params.set("startDate", `${year}-01-01`);
        params.set("endDate", `${year}-12-31`);
      }
    }
    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) { const data = await res.json(); setOrders(data.data || []); setTotal(data.total || 0); }
    setLoading(false);
  }, [page, keyword, searchField, year, month]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "progress" ? "complete" : "progress";
    await fetch(`/api/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    fetchOrders();
  }

  async function moveToList(id: string) {
    if (!confirm("이 항목을 작업리스트로 복귀시키겠습니까?")) return;
    await fetch(`/api/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_estimate: false }) });
    fetchOrders();
  }

  // 검색어 하이라이트: 매칭되는 부분을 빨간색으로 표시
  function highlight(text: string | null | undefined, field: string): React.ReactNode {
    const t = text || "";
    if (!keyword || !t) return t;
    // searchField가 "전체"이거나 현재 필드와 일치할 때만 하이라이트
    if (searchField !== "전체" && searchField !== field) return t;
    const lowerKw = keyword.toLowerCase();
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const lowerT = t.toLowerCase();
    let idx = lowerT.indexOf(lowerKw);
    while (idx !== -1) {
      if (idx > lastIdx) parts.push(t.slice(lastIdx, idx));
      parts.push(<span key={idx} className="text-red-600 font-bold">{t.slice(idx, idx + keyword.length)}</span>);
      lastIdx = idx + keyword.length;
      idx = lowerT.indexOf(lowerKw, lastIdx);
    }
    if (lastIdx < t.length) parts.push(t.slice(lastIdx));
    return parts.length > 0 ? <>{parts}</> : t;
  }

  const totalPages = Math.ceil(total / 40);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
          <option>전체</option><option>블랙카피</option><option>출력실</option><option>디자인실</option>
        </select>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={fontSize} onChange={e => changeFontSize(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs" title="글자 크기">
            <option value="text-xs">글자: 작게</option>
            <option value="text-sm">글자: 보통</option>
            <option value="text-base">글자: 노안용</option>
            <option value="text-lg">글자: 심한 노안용</option>
          </select>
          <select value={year} onChange={e => { setYear(e.target.value); setPage(1); if (e.target.value === "전체") setMonth("전체"); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs" title="연도">
            <option value="전체">연도: 전체</option>
            {Array.from({length: 7}, (_, i) => 2026 - i).map(y => (
              <option key={y} value={String(y)}>{y}년</option>
            ))}
          </select>
          <select value={month} onChange={e => { setMonth(e.target.value); setPage(1); }} disabled={year === "전체"} className="px-2 py-1.5 border border-gray-300 rounded text-xs disabled:bg-gray-100 disabled:text-gray-400" title="월">
            <option value="전체">월: 전체</option>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={String(m)}>{m}월</option>
            ))}
          </select>
          <select value={searchField} onChange={e => setSearchField(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs">
            <option>전체</option><option>거래처</option><option>주문자</option><option>연락처</option><option>제목</option>
          </select>
          <input type="text" placeholder="검색어 입력" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") fetchOrders(); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs w-40" />
          <button onClick={fetchOrders} className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs">검색</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse border border-gray-300 ${fontSize}`}>
          <thead><tr className="bg-[#3b4b5b] text-white">
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">순번</th><th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">거래처</th><th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">주문자</th><th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">연락처</th><th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">제목</th><th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">금액</th><th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">제품형태</th><th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">MEMO</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap" style={{minWidth:"80px"}}>작업리스트 복귀</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap" style={{minWidth:"60px"}}>거래명세서</th><th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap" style={{minWidth:"60px"}}>견적서</th>
          </tr></thead>
          <tbody>
            {(() => {
              const filtered = statusFilter === "전체" ? orders : orders.filter(o => o.status === statusFilter);
              if (loading) return <tr><td colSpan={11} className="text-center py-8 text-gray-300 text-sm">불러오는 중...</td></tr>;
              if (filtered.length === 0) return <tr><td colSpan={11} className="text-center py-8 text-gray-400">견적서로 이동된 작업이 없습니다.</td></tr>;
              return filtered.map((o, i) => (
              <tr key={o.id} className={`${i % 2 === 1 ? "bg-gray-50" : ""} hover:bg-blue-50`} style={{animation: `fadeIn 0.3s ease ${i * 0.02}s both`}}>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap"><a href={`/dashboard/write?id=${o.id}`} className="hover:text-blue-600 hover:underline">{o.order_no}</a></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-left"><a href={`/dashboard/write?id=${o.id}`} className="hover:text-blue-600 hover:underline">{highlight(o.client_name, "거래처")}</a></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-left"><a href={`/dashboard/write?id=${o.id}`} className="hover:text-blue-600 hover:underline">{highlight(o.orderer, "주문자")}</a></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-left"><a href={`/dashboard/write?id=${o.id}`} className="hover:text-blue-600 hover:underline">{highlight(o.contact, "연락처")}</a></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-left max-w-[400px]"><a href={`/dashboard/write?id=${o.id}`} title={o.title} className="hover:text-blue-600 hover:underline block truncate">{highlight(o.title, "제목")}</a></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-right">{((o.total_amount||0) - (o.discount||0)).toLocaleString()}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center">{o.product_type}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center">{o.payment}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center">
                  <button onClick={() => moveToList(o.id)} className="px-2 py-0.5 border border-blue-500 text-blue-600 rounded text-xs hover:bg-blue-50">← 복귀</button>
                </td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap"><a href={`/print/statement?id=${o.id}`} target="_blank" className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:text-blue-600">명세서</a></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap"><a href={`/print/estimate?id=${o.id}`} target="_blank" className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:text-red-600">견적서</a></td>
              </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <span className="text-xs text-gray-400 mr-2">20개씩</span>
          {Array.from({length:Math.min(totalPages,10)},(_,i)=>i+1).map(p=>(
            <button key={p} onClick={()=>setPage(p)} className={`px-2.5 py-1 rounded border text-xs ${p===page?"bg-blue-600 text-white border-blue-600":"border-gray-300 text-gray-500"}`}>{p}</button>
          ))}
          <span className="ml-2 text-xs text-gray-400">/ {totalPages} 페이지</span>
        </div>
      )}
    </div>
  );
}
