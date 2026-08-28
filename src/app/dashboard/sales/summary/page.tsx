"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Totals { count: number; supply: number; vat: number; discount: number; net: number; progress: number; complete: number }
interface CategoryRow { name: string; count: number; supply: number; vat: number; discount: number; net: number }
interface ClientRow { name: string; count: number; net: number }
interface TaxRow { label: string; count: number; net: number }
interface MonthRow { month: string; count: number; net: number }

interface SummaryData {
  totals: Totals;
  byCategory: CategoryRow[];
  byClient: ClientRow[];
  clientRest: { count: number; orderCount: number; net: number };
  byTax: TaxRow[];
  byMonth: MonthRow[];
}

export default function SalesSummaryPage() {
  const [category, setCategory] = useState("전체");
  const [clientName, setClientName] = useState("");
  const [preset, setPreset] = useState<"today"|"week"|"month"|"lastMonth"|"year"|"custom">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryList, setCategoryList] = useState<Array<{id:string;name:string}>>([]);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/categories?_=${Date.now()}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCategoryList(d);
    }).catch(() => {});
  }, []);

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
  }, [preset]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ _: String(Date.now()) });
    if (category !== "전체") params.set("category", category);
    if (clientName) params.set("clientName", clientName);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const res = await fetch(`/api/sales/summary?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [category, clientName, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: number) => (n || 0).toLocaleString();
  const totals = data?.totals || { count: 0, supply: 0, vat: 0, discount: 0, net: 0, progress: 0, complete: 0 };

  return (
    <div>
      {/* 툴바 */}
      <div className="bg-white border border-gray-200 rounded p-3 mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-gray-600">기간</label>
        <div className="inline-flex border border-gray-300 rounded overflow-hidden">
          {([["today","오늘"],["week","이번주"],["month","이번달"],["lastMonth","지난달"],["year","올해"],["custom","직접선택"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setPreset(k)} className={`px-2.5 py-1 text-xs border-r border-gray-300 last:border-r-0 ${preset === k ? "bg-[#3b4b5b] text-white font-bold" : "bg-white text-gray-600"}`}>{l}</button>
          ))}
        </div>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreset("custom"); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
        <span className="text-xs text-gray-400">~</span>
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPreset("custom"); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
        <label className="text-xs font-bold text-gray-600 ml-2">카테고리</label>
        <select value={category} onChange={e => setCategory(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
          <option value="전체">전체</option>
          {categoryList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <label className="text-xs font-bold text-gray-600 ml-2">업체명</label>
        <input type="text" placeholder="업체명 (부분일치)" value={clientName} onChange={e => setClientName(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-44" />
        <button onClick={() => window.print()} className="ml-auto px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-xs">인쇄</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
        <div className="bg-white border border-gray-200 rounded p-3">
          <div className="text-[10px] font-bold text-gray-500 tracking-wider">총 매출</div>
          <div className="text-lg font-extrabold text-rose-600">₩ {fmt(totals.net)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded p-3">
          <div className="text-[10px] font-bold text-gray-500 tracking-wider">건수</div>
          <div className="text-lg font-extrabold text-gray-800">{fmt(totals.count)}건</div>
          <div className="text-[10px] text-gray-500">진행 {totals.progress} · 완료 {totals.complete}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded p-3">
          <div className="text-[10px] font-bold text-gray-500 tracking-wider">공급가액</div>
          <div className="text-lg font-extrabold text-gray-800">₩ {fmt(totals.supply)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded p-3">
          <div className="text-[10px] font-bold text-gray-500 tracking-wider">부가세</div>
          <div className="text-lg font-extrabold text-gray-800">₩ {fmt(totals.vat)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded p-3">
          <div className="text-[10px] font-bold text-gray-500 tracking-wider">할인</div>
          <div className="text-lg font-extrabold text-gray-800">-₩ {fmt(totals.discount)}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
      ) : (
        <>
          {/* 카테고리별 */}
          <div className="bg-white border border-gray-200 rounded mb-3 overflow-hidden">
            <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-bold text-sm">카테고리별 매출</div>
            <table className="w-full text-xs">
              <thead className="bg-[#3b4b5b] text-white">
                <tr>
                  <th className="border border-[#2d3a47] px-2 py-2 w-10">순위</th>
                  <th className="border border-[#2d3a47] px-2 py-2">카테고리</th>
                  <th className="border border-[#2d3a47] px-2 py-2">건수</th>
                  <th className="border border-[#2d3a47] px-2 py-2 text-right">공급가액</th>
                  <th className="border border-[#2d3a47] px-2 py-2 text-right">부가세</th>
                  <th className="border border-[#2d3a47] px-2 py-2 text-right">할인</th>
                  <th className="border border-[#2d3a47] px-2 py-2 text-right">순매출</th>
                  <th className="border border-[#2d3a47] px-2 py-2 text-right">비중</th>
                </tr>
              </thead>
              <tbody>
                {(data?.byCategory || []).map((c, i) => (
                  <tr key={c.name} className={i % 2 ? "bg-gray-50" : ""}>
                    <td className="border border-gray-200 px-2 py-2 text-center font-bold text-gray-400">{i+1}</td>
                    <td className="border border-gray-200 px-2 py-2 font-bold">{c.name}</td>
                    <td className="border border-gray-200 px-2 py-2 text-center">{fmt(c.count)}</td>
                    <td className="border border-gray-200 px-2 py-2 text-right">{fmt(c.supply)}</td>
                    <td className="border border-gray-200 px-2 py-2 text-right">{fmt(c.vat)}</td>
                    <td className="border border-gray-200 px-2 py-2 text-right text-rose-600">-{fmt(c.discount)}</td>
                    <td className="border border-gray-200 px-2 py-2 text-right font-bold">{fmt(c.net)}</td>
                    <td className="border border-gray-200 px-2 py-2 text-right">{totals.net > 0 ? ((c.net / totals.net) * 100).toFixed(1) : "0.0"}%</td>
                  </tr>
                ))}
                {(!data?.byCategory || data.byCategory.length === 0) && (
                  <tr><td colSpan={8} className="text-center py-6 text-gray-400">데이터 없음</td></tr>
                )}
                <tr className="bg-gray-100 font-bold border-t-2 border-[#3b4b5b]">
                  <td colSpan={2} className="border border-gray-200 px-2 py-2">합계</td>
                  <td className="border border-gray-200 px-2 py-2 text-center">{fmt(totals.count)}</td>
                  <td className="border border-gray-200 px-2 py-2 text-right">{fmt(totals.supply)}</td>
                  <td className="border border-gray-200 px-2 py-2 text-right">{fmt(totals.vat)}</td>
                  <td className="border border-gray-200 px-2 py-2 text-right">-{fmt(totals.discount)}</td>
                  <td className="border border-gray-200 px-2 py-2 text-right">{fmt(totals.net)}</td>
                  <td className="border border-gray-200 px-2 py-2 text-right">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 거래처 TOP + 세금계산서 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-bold text-sm">거래처별 매출 TOP 10</div>
              <table className="w-full text-xs">
                <thead className="bg-[#3b4b5b] text-white">
                  <tr>
                    <th className="border border-[#2d3a47] px-2 py-2 w-10">순위</th>
                    <th className="border border-[#2d3a47] px-2 py-2">거래처</th>
                    <th className="border border-[#2d3a47] px-2 py-2">건수</th>
                    <th className="border border-[#2d3a47] px-2 py-2 text-right">매출</th>
                    <th className="border border-[#2d3a47] px-2 py-2 text-right">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byClient || []).map((c, i) => (
                    <tr key={c.name} className={i % 2 ? "bg-gray-50" : ""}>
                      <td className="border border-gray-200 px-2 py-2 text-center font-bold text-gray-400">{i+1}</td>
                      <td className="border border-gray-200 px-2 py-2">{c.name}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{fmt(c.count)}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right font-bold">{fmt(c.net)}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right">{totals.net > 0 ? ((c.net / totals.net) * 100).toFixed(1) : "0.0"}%</td>
                    </tr>
                  ))}
                  {data && data.clientRest.count > 0 && (
                    <tr className="text-gray-400 italic">
                      <td colSpan={2} className="border border-gray-200 px-2 py-2">그 외 {data.clientRest.count}개 거래처</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{fmt(data.clientRest.orderCount)}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right">{fmt(data.clientRest.net)}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right">{totals.net > 0 ? ((data.clientRest.net / totals.net) * 100).toFixed(1) : "0.0"}%</td>
                    </tr>
                  )}
                  {(!data?.byClient || data.byClient.length === 0) && (
                    <tr><td colSpan={5} className="text-center py-6 text-gray-400">데이터 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-bold text-sm">세금계산서 상태별 집계</div>
              <table className="w-full text-xs">
                <thead className="bg-[#3b4b5b] text-white">
                  <tr>
                    <th className="border border-[#2d3a47] px-2 py-2">구분</th>
                    <th className="border border-[#2d3a47] px-2 py-2">건수</th>
                    <th className="border border-[#2d3a47] px-2 py-2 text-right">매출</th>
                    <th className="border border-[#2d3a47] px-2 py-2 text-right">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byTax || []).map((t, i) => (
                    <tr key={t.label} className={i % 2 ? "bg-gray-50" : ""}>
                      <td className="border border-gray-200 px-2 py-2">{t.label}</td>
                      <td className="border border-gray-200 px-2 py-2 text-center">{fmt(t.count)}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right font-bold">{fmt(t.net)}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right">{totals.net > 0 ? ((t.net / totals.net) * 100).toFixed(1) : "0.0"}%</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold border-t-2 border-[#3b4b5b]">
                    <td className="border border-gray-200 px-2 py-2">합계</td>
                    <td className="border border-gray-200 px-2 py-2 text-center">{fmt(totals.count)}</td>
                    <td className="border border-gray-200 px-2 py-2 text-right">{fmt(totals.net)}</td>
                    <td className="border border-gray-200 px-2 py-2 text-right">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 월별 */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-bold text-sm">월별 매출</div>
            <table className="w-full text-xs">
              <thead className="bg-[#3b4b5b] text-white">
                <tr>
                  <th className="border border-[#2d3a47] px-2 py-2">월</th>
                  <th className="border border-[#2d3a47] px-2 py-2">건수</th>
                  <th className="border border-[#2d3a47] px-2 py-2 text-right">매출</th>
                  <th className="border border-[#2d3a47] px-2 py-2 text-right">누계</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const months = data?.byMonth || [];
                  let cum = 0;
                  return months.map((m, i) => {
                    cum += m.net;
                    return (
                      <tr key={m.month} className={i % 2 ? "bg-gray-50" : ""}>
                        <td className="border border-gray-200 px-2 py-2">{m.month}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">{fmt(m.count)}</td>
                        <td className="border border-gray-200 px-2 py-2 text-right font-bold">{fmt(m.net)}</td>
                        <td className="border border-gray-200 px-2 py-2 text-right text-gray-500">{fmt(cum)}</td>
                      </tr>
                    );
                  });
                })()}
                {(!data?.byMonth || data.byMonth.length === 0) && (
                  <tr><td colSpan={4} className="text-center py-6 text-gray-400">데이터 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
