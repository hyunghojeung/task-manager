"use client";

import { useState, useEffect } from "react";

type View = "list" | "write";
interface POData { id: string; po_no: string; po_date: string; supplier_name: string; orderer: string; contact: string; request_note: string; created_at: string }

export default function OrdersPage() {
  const [view, setView] = useState<View>("list");
  const [orders, setOrders] = useState<POData[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_name: "", orderer: "", contact: "", request_note: "", po_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    fetch(`/api/purchase-orders?_=${Date.now()}`).then(r => r.json()).then(d => setOrders(d.data || []));
  }, [refreshKey]);

  function openWrite(po?: POData) {
    if (po) {
      setEditId(po.id);
      setForm({ supplier_name: po.supplier_name || "", orderer: po.orderer || "", contact: po.contact || "", request_note: po.request_note || "", po_date: po.po_date || "" });
    } else {
      setEditId(null);
      setForm({ supplier_name: "", orderer: "", contact: "", request_note: "", po_date: new Date().toISOString().slice(0, 10) });
    }
    setView("write");
  }

  async function handleSave() {
    if (!form.supplier_name) { alert("발주처를 선택해주세요."); return; }
    setSaving(true);
    const url = editId ? `/api/purchase-orders/${editId}` : "/api/purchase-orders";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setView("list"); setRefreshKey(k => k + 1); alert(editId ? "수정되었습니다." : "저장되었습니다."); }
    else alert("저장 실패");
    setSaving(false);
  }

  async function handleDelete() {
    if (!editId || !confirm("정말 삭제할까요?")) return;
    await fetch(`/api/purchase-orders/${editId}`, { method: "DELETE" });
    setView("list"); setRefreshKey(k => k + 1);
  }

  if (view === "write") {
    return (
      <div className="max-w-5xl mx-auto">
        <h2 className="text-base font-bold text-gray-800 mb-3">발주서입력</h2>
        <div className="bg-white border border-gray-300 rounded p-4 mb-3">
          <table className="w-full text-sm"><tbody>
            <tr>
              <td className="w-[70px] font-semibold text-gray-600 text-xs py-1">발주No.</td>
              <td className="py-1"><input type="text" readOnly className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-100 text-gray-400" value={editId ? "수정" : "자동생성"} /></td>
              <td className="w-[60px] font-semibold text-gray-600 text-xs py-1 text-right pr-2">일자</td>
              <td className="py-1"><input type="date" value={form.po_date} onChange={e => setForm(p => ({ ...p, po_date: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            </tr>
            <tr>
              <td className="font-semibold text-gray-600 text-xs py-1">발주처</td>
              <td className="py-1"><input type="text" placeholder="발주처" value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
              <td className="font-semibold text-gray-600 text-xs py-1 text-right pr-2">발주자</td>
              <td className="py-1"><input type="text" placeholder="발주자" value={form.orderer} onChange={e => setForm(p => ({ ...p, orderer: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            </tr>
            <tr>
              <td className="font-semibold text-gray-600 text-xs py-1">연락처</td>
              <td colSpan={3} className="py-1"><input type="text" placeholder="연락처" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            </tr>
            <tr>
              <td className="font-semibold text-gray-600 text-xs py-1 align-top pt-2">요청사항</td>
              <td colSpan={3} className="py-1"><textarea placeholder="요청사항" value={form.request_note} onChange={e => setForm(p => ({ ...p, request_note: e.target.value }))} className="w-full px-2 py-2 border border-gray-300 rounded text-sm min-h-[80px] resize-y" /></td>
            </tr>
          </tbody></table>
        </div>
        <div className="flex gap-2 py-3">
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-gray-700 text-white rounded text-sm font-medium disabled:opacity-50">{saving ? "저장중..." : "저장"}</button>
          <button onClick={() => setView("list")} className="px-6 py-2 border border-gray-300 rounded text-sm">리스트</button>
          {editId && <button onClick={handleDelete} className="px-6 py-2 bg-red-600 text-white rounded text-sm">삭제</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div />
        <button onClick={() => openWrite()} className="px-5 py-2 bg-gray-700 text-white rounded text-sm font-medium">+ 발주서 작성</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead><tr className="bg-[#3b4b5b] text-white">
            <th className="border border-[#2d3a47] px-2 py-2.5 w-8"></th><th className="border border-[#2d3a47] px-2 py-2.5">발주No.</th><th className="border border-[#2d3a47] px-2 py-2.5">일자</th><th className="border border-[#2d3a47] px-2 py-2.5">발주처명</th><th className="border border-[#2d3a47] px-2 py-2.5">발주자</th><th className="border border-[#2d3a47] px-2 py-2.5">요청사항</th><th className="border border-[#2d3a47] px-2 py-2.5 w-12">인쇄</th>
          </tr></thead>
          <tbody>
            {orders.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">등록된 발주서가 없습니다.</td></tr> :
            orders.map((o, i) => (
              <tr key={o.id} className={`${i % 2 === 1 ? "bg-gray-50" : ""} hover:bg-blue-50`}>
                <td className="border border-gray-200 px-2 py-2 text-center">{i + 1}</td>
                <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={() => openWrite(o)} className="hover:text-blue-600 hover:underline">{o.po_no}</button></td>
                <td className="border border-gray-200 px-2 py-2 text-center">{o.po_date}</td>
                <td className="border border-gray-200 px-2 py-2 text-left">{o.supplier_name}</td>
                <td className="border border-gray-200 px-2 py-2 text-center">{o.orderer}</td>
                <td className="border border-gray-200 px-2 py-2 text-left">{o.request_note?.slice(0, 30)}</td>
                <td className="border border-gray-200 px-2 py-2 text-center">
                  <button onClick={() => window.open(`/dashboard/orders/print?id=${o.id}`, '_blank')} className="px-2 py-0.5 bg-red-600 text-white rounded text-xs">인쇄</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
