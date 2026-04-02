"use client";

import { useState, useEffect, useCallback } from "react";

interface OrderData {
  id: string; order_no: string; client_name: string; orderer: string; contact: string;
  title: string; total_amount: number; product_type: string; payment: string; status: string;
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("전체");
  const [searchField, setSearchField] = useState("전체");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "40" });
    if (keyword) { params.set("keyword", keyword); params.set("searchField", searchField); }
    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) { const data = await res.json(); setOrders(data.data || []); setTotal(data.total || 0); }
    setLoading(false);
  }, [page, keyword, searchField]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "progress" ? "complete" : "progress";
    await fetch(`/api/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    fetchOrders();
  }

  const totalPages = Math.ceil(total / 40);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
          <option>전체</option><option>블랙카피</option><option>출력실</option><option>디자인실</option>
        </select>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={searchField} onChange={e => setSearchField(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs">
            <option>전체</option><option>거래처</option><option>주문자</option><option>연락처</option><option>제목</option>
          </select>
          <input type="text" placeholder="검색어 입력" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") fetchOrders(); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs w-40" />
          <button onClick={fetchOrders} className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs">검색</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead><tr className="bg-[#3b4b5b] text-white">
            <th className="border border-[#2d3a47] px-2 py-2.5 w-[40px]">순번</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[140px]">거래처</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[90px]">주문자</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[110px]">연락처</th><th className="border border-[#2d3a47] px-2 py-2.5">제목</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[80px]">금액</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[100px]">제품형태</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[70px]">결제</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[65px]">진행상태</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[65px]">거래명세서</th><th className="border border-[#2d3a47] px-2 py-2.5 w-[55px]">견적서</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={11} className="text-center py-8 text-gray-400">로딩중...</td></tr> :
            orders.length === 0 ? <tr><td colSpan={11} className="text-center py-8 text-gray-400">등록된 작업이 없습니다. 작업등록 버튼을 눌러 새 작업을 등록하세요.</td></tr> :
            orders.map((o, i) => (
              <tr key={o.id} className={`${i % 2 === 1 ? "bg-gray-50" : ""} hover:bg-blue-50`}>
                <td className="border border-gray-200 px-2 py-2 text-center">{(page-1)*40+i+1}</td>
                <td className="border border-gray-200 px-2 py-2 text-left"><a href={`/dashboard/write?id=${o.id}`} className="hover:text-blue-600 hover:underline">{o.client_name}</a></td>
                <td className="border border-gray-200 px-2 py-2 text-left">{o.orderer}</td>
                <td className="border border-gray-200 px-2 py-2 text-left">{o.contact}</td>
                <td className="border border-gray-200 px-2 py-2 text-left"><a href={`/dashboard/write?id=${o.id}`} className="hover:text-blue-600 hover:underline">{o.title}</a></td>
                <td className="border border-gray-200 px-2 py-2 text-right">{(o.total_amount||0).toLocaleString()}</td>
                <td className="border border-gray-200 px-2 py-2 text-center">{o.product_type}</td>
                <td className="border border-gray-200 px-2 py-2 text-center">{o.payment}</td>
                <td className="border border-gray-200 px-2 py-2 text-center">
                  <button onClick={()=>toggleStatus(o.id,o.status)} className={`text-xs font-semibold cursor-pointer ${o.status==="progress"?"text-blue-600":"text-red-600"}`}>{o.status==="progress"?"진행중":"완료"}</button>
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center"><a href={`/dashboard/statement?id=${o.id}`} target="_blank" className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:text-blue-600">명세서</a></td>
                <td className="border border-gray-200 px-2 py-2 text-center"><a href={`/dashboard/estimate?id=${o.id}`} target="_blank" className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:text-red-600">견적서</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <span className="text-xs text-gray-400 mr-2">40개씩</span>
          {Array.from({length:Math.min(totalPages,10)},(_,i)=>i+1).map(p=>(
            <button key={p} onClick={()=>setPage(p)} className={`px-2.5 py-1 rounded border text-xs ${p===page?"bg-blue-600 text-white border-blue-600":"border-gray-300 text-gray-500"}`}>{p}</button>
          ))}
          <span className="ml-2 text-xs text-gray-400">/ {totalPages} 페이지</span>
        </div>
      )}
    </div>
  );
}
