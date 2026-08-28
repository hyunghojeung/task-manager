"use client";

import React, { useState, useEffect, useCallback } from "react";

interface OrderData {
  id: string; order_no: string; client_name: string; orderer: string; contact: string;
  title: string; total_amount: number; discount: number; product_type: string; payment: string; tax_invoice?: string; status: string; is_highlighted?: boolean;
}

interface SummaryTotals { count: number; supply: number; vat: number; discount: number; net: number; progress: number; complete: number }

export default function SalesListPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("전체");
  const [clientName, setClientName] = useState("");
  const [searchField, setSearchField] = useState("전체");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<"today"|"week"|"month"|"lastMonth"|"year"|"custom">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryList, setCategoryList] = useState<Array<{id:string;name:string}>>([]);
  const [totals, setTotals] = useState<SummaryTotals>({ count: 0, supply: 0, vat: 0, discount: 0, net: 0, progress: 0, complete: 0 });

  useEffect(() => {
    fetch(`/api/categories?_=${Date.now()}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCategoryList(d);
    }).catch(() => {});
  }, []);

  // 프리셋에 따라 startDate/endDate 자동 계산
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
    if (preset === "today") { const t = fmt(now); setStartDate(t); setEndDate(t); }
    else if (preset === "week") {
      const day = now.getDay();
      const monday = new Date(y, m, d - (day === 0 ? 6 : day - 1));
      setStartDate(fmt(monday)); setEndDate(fmt(now));
    }
    else if (preset === "month") { setStartDate(fmt(new Date(y, m, 1))); setEndDate(fmt(now)); }
    else if (preset === "lastMonth") {
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      setStartDate(fmt(first)); setEndDate(fmt(last));
    }
    else if (preset === "year") { setStartDate(fmt(new Date(y, 0, 1))); setEndDate(fmt(now)); }
    // custom은 사용자가 직접 입력
  }, [preset]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ _: String(Date.now()) });
    if (category !== "전체") params.set("category", category);
    if (clientName) params.set("clientName", clientName);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params;
  }, [category, clientName, startDate, endDate]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = buildParams();
    params.set("page", String(page));
    params.set("limit", "20");
    // 리스트: 거래처는 clientName 필터로 처리, 검색어는 별도
    if (keyword) { params.set("keyword", keyword); params.set("searchField", searchField); }
    // clientName은 서버에서 ilike로 검색 (거래처 필드 확장 필요)
    if (clientName) { params.set("keyword", clientName); params.set("searchField", "거래처"); }
    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.data || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [page, keyword, searchField, clientName, buildParams]);

  const fetchSummary = useCallback(async () => {
    const params = buildParams();
    const res = await fetch(`/api/sales/summary?${params}`);
    if (res.ok) {
      const data = await res.json();
      setTotals(data.totals || totals);
    }
  }, [buildParams, totals]);

  useEffect(() => { fetchOrders(); fetchSummary(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [page, startDate, endDate, category, clientName]);

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "progress" ? "complete" : "progress";
    await fetch(`/api/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    fetchOrders(); fetchSummary();
  }

  function onSearch() { setPage(1); fetchOrders(); fetchSummary(); }

  const totalPages = Math.ceil(total / 20);
  const fmt = (n: number) => (n || 0).toLocaleString();

  return (
    <div>
      {/* 툴바 */}
      <div className="bg-white border border-gray-200 rounded p-3 mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-gray-600">카테고리</label>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
          <option value="전체">전체</option>
          {categoryList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <label className="text-xs font-bold text-gray-600 ml-2">업체명</label>
        <input list="sales-clients" type="text" placeholder="업체명 (부분일치)" value={clientName} onChange={e => { setClientName(e.target.value); setPage(1); }} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-44" />
        <datalist id="sales-clients">
          {[...new Set(orders.map(o => o.client_name).filter(Boolean))].map(n => <option key={n} value={n} />)}
        </datalist>
        <div className="inline-flex border border-gray-300 rounded overflow-hidden ml-2">
          {([["today","오늘"],["week","이번주"],["month","이번달"],["lastMonth","지난달"],["year","올해"],["custom","직접선택"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setPreset(k); setPage(1); }} className={`px-2.5 py-1 text-xs border-r border-gray-300 last:border-r-0 ${preset === k ? "bg-[#3b4b5b] text-white font-bold" : "bg-white text-gray-600"}`}>{l}</button>
          ))}
        </div>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreset("custom"); setPage(1); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
        <span className="text-xs text-gray-400">~</span>
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPreset("custom"); setPage(1); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
        <div className="ml-auto flex items-center gap-2">
          <select value={searchField} onChange={e => setSearchField(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs">
            <option>전체</option><option>주문자</option><option>연락처</option><option>제목</option>
          </select>
          <input type="text" placeholder="검색어" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onSearch(); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs w-32" />
          <button onClick={onSearch} className="px-3 py-1.5 bg-gray-700 text-white rounded text-xs">검색</button>
          <button onClick={() => window.print()} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-xs">인쇄</button>
        </div>
      </div>

      {/* 매출 합계 카드 */}
      <div className="bg-[#f0f4f9] border-2 border-[#3b4b5b] rounded p-4 mb-3 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-center">
        <div className="md:pr-4 md:border-r border-gray-300 pb-2 md:pb-0 border-b md:border-b-0">
          <div className="text-sm font-bold text-gray-800">매출합계</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{startDate || "-"} ~ {endDate || "-"}</div>
          <div className="text-[10px] text-gray-500">카테고리 {category}{clientName ? ` · 업체 "${clientName}"` : ""}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div>
            <div className="text-[10px] font-bold text-gray-500 tracking-wider">건수</div>
            <div className="text-xl font-extrabold text-gray-800">{totals.count}건</div>
            <div className="text-[10px] text-gray-500">진행중 {totals.progress} · 완료 {totals.complete}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-gray-500 tracking-wider">공급가액</div>
            <div className="text-xl font-extrabold text-gray-800">₩ {fmt(totals.supply)}</div>
            <div className="text-[10px] text-gray-500">부가세 미포함</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-gray-500 tracking-wider">부가세</div>
            <div className="text-xl font-extrabold text-gray-800">₩ {fmt(totals.vat)}</div>
            <div className="text-[10px] text-gray-500">VAT 10%</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-rose-600 tracking-wider">순매출</div>
            <div className="text-xl font-extrabold text-rose-600">₩ {fmt(totals.net)}</div>
            <div className="text-[10px] text-gray-500">할인 -{fmt(totals.discount)} 반영</div>
          </div>
        </div>
      </div>

      {/* 표 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead><tr className="bg-[#3b4b5b] text-white">
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">순번</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">거래처</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">주문자</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">연락처</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">제목</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">금액</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">제품형태</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">세금계산서</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">MEMO</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">상태</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">거래명세서</th>
            <th className="border border-[#2d3a47] px-1.5 py-2.5 whitespace-nowrap">견적서</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="text-center py-8 text-gray-400 text-sm">불러오는 중...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-8 text-gray-400">해당 조건의 매출 내역이 없습니다.</td></tr>
            ) : orders.map((o, i) => (
              <tr key={o.id} className={`${i % 2 === 1 ? "bg-gray-50" : ""} hover:bg-blue-50`}>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap">
                  <a href={`/dashboard/write?id=${o.id}`} className="hover:text-blue-600 hover:underline">{o.order_no}</a>
                </td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-left">{o.client_name}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-left">{o.orderer}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-left">{o.contact}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-left max-w-[400px]"><a href={`/dashboard/write?id=${o.id}`} className={`hover:underline block truncate ${o.is_highlighted ? "text-red-600 font-bold" : "hover:text-blue-600"}`}>{o.title}</a></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-right">{fmt((o.total_amount || 0) - (o.discount || 0))}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center">{o.product_type}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap text-xs"><span className={o.tax_invoice === "세금계산서 작성요망" ? "blink" : ""}>{o.tax_invoice}</span></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center">{o.payment}</td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center">
                  <button onClick={() => toggleStatus(o.id, o.status)} className={`text-xs font-semibold cursor-pointer ${o.status === "progress" ? "text-blue-600" : "text-red-600"}`}>{o.status === "progress" ? "진행중" : "완료"}</button>
                </td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap"><a href={`/print/statement?id=${o.id}`} target="_blank" className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:text-blue-600">명세서</a></td>
                <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap"><a href={`/print/estimate?id=${o.id}`} target="_blank" className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:text-red-600">견적서</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <span className="text-xs text-gray-400 mr-2">20개씩</span>
          {Array.from({length: Math.min(totalPages, 10)}, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 rounded border text-xs ${p === page ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-500"}`}>{p}</button>
          ))}
          <span className="ml-2 text-xs text-gray-400">/ {totalPages} 페이지</span>
        </div>
      )}
    </div>
  );
}
