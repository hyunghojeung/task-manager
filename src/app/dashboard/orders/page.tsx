"use client";

import { useState, useEffect } from "react";

type View = "list" | "write";
interface POItem { product_name: string; spec: string; paper_grain: string; cut_size: string; quantity: string; received: string }
interface POData { id: string; po_no: string; po_date: string; supplier_name: string; orderer: string; contact: string; request_note: string; created_at: string; purchase_order_items?: POItem[] }
interface SupplierData { id: string; name: string; contact_person: string; phone: string; fax: string; email: string }

export default function OrdersPage() {
  const [view, setView] = useState<View>("list");
  const [orders, setOrders] = useState<POData[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contact_person: "", phone: "", fax: "", email: "" });
  const [form, setForm] = useState({ supplier_name: "", orderer: "", contact: "", request_note: "", po_date: new Date().toISOString().slice(0, 10) });
  const [items, setItems] = useState(Array.from({ length: 5 }, () => ({ product_name: "", spec: "", paper_grain: "", cut_size: "", quantity: "", received: "" })));

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    fetch(`/api/purchase-orders?page=${page}&limit=20&startDate=${startDate}&endDate=${endDate}&keyword=${keyword}&_=${Date.now()}`).then(r => r.json()).then(d => { setOrders(d.data || []); setTotal(d.total || 0); });
  }, [refreshKey, page, startDate, endDate]);

  useEffect(() => {
    fetch(`/api/suppliers?_=${Date.now()}`).then(r => r.json()).then(d => setSuppliers(d || []));
  }, []);

  function openWrite(po?: POData) {
    if (po) {
      setEditId(po.id);
      setForm({ supplier_name: po.supplier_name || "", orderer: po.orderer || "", contact: po.contact || "", request_note: po.request_note || "", po_date: po.po_date || "" });
      const poItems = (po.purchase_order_items || []).map(it => ({
        product_name: it.product_name || "", spec: it.spec || "", paper_grain: it.paper_grain || "",
        cut_size: it.cut_size || "", quantity: it.quantity || "", received: it.received || ""
      }));
      const emptyRows = Math.max(5 - poItems.length, 0);
      setItems([...poItems, ...Array.from({ length: emptyRows }, () => ({ product_name: "", spec: "", paper_grain: "", cut_size: "", quantity: "", received: "" }))]);
    } else {
      setEditId(null);
      setForm({ supplier_name: "", orderer: "", contact: "", request_note: "", po_date: new Date().toISOString().slice(0, 10) });
      setItems(Array.from({ length: 5 }, () => ({ product_name: "", spec: "", paper_grain: "", cut_size: "", quantity: "", received: "" })));
    }
    setView("write");
  }

  function copyOrder() {
    setEditId(null);
    alert("발주서가 복사되었습니다. 내용을 수정 후 저장하세요.");
  }

  function handleSupplierSelect(name: string) {
    setForm(p => ({ ...p, supplier_name: name }));
    const s = suppliers.find(s => s.name === name);
    if (s) setForm(p => ({ ...p, contact: s.phone || "" }));
  }

  async function registerSupplier() {
    if (!newSupplier.name) return;
    const res = await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newSupplier) });
    if (res.ok) {
      const data = await res.json();
      setSuppliers(prev => [...prev, data]);
      setForm(p => ({ ...p, supplier_name: newSupplier.name }));
      setNewSupplier({ name: "", contact_person: "", phone: "", fax: "", email: "" });
      setShowSupplierModal(false);
    }
  }

  function updateItem(index: number, field: string, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  async function handleSave() {
    if (!form.supplier_name) { alert("발주처를 선택해주세요."); return; }
    setSaving(true);
    const url = editId ? `/api/purchase-orders/${editId}` : "/api/purchase-orders";
    const method = editId ? "PUT" : "POST";
    const validItems = items.filter(it => it.product_name);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, items: validItems }) });
    if (res.ok) { alert(editId ? "수정되었습니다." : "저장되었습니다."); setView("list"); setTimeout(() => setRefreshKey(k => k + 1), 500); }
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
              <td className="font-semibold text-gray-600 text-xs py-1">
                <button type="button" onClick={() => setShowSupplierModal(true)} className="px-2 py-0.5 bg-gray-700 text-white rounded text-xs">발주처</button>
              </td>
              <td className="py-1">
                <select value={form.supplier_name} onChange={e => handleSupplierSelect(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">발주처 선택</option>
                  {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </td>
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

        {/* 품목 테이블 */}
        <div className="flex justify-end mb-1">
          <button onClick={() => setItems(p => [...p, { product_name: "", spec: "", paper_grain: "", cut_size: "", quantity: "", received: "" }])} className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-500 hover:bg-blue-50">+ 행 추가</button>
        </div>
        <div className="overflow-x-auto mb-3">
          <table className="w-full border-collapse text-xs">
            <thead><tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-2 w-[35px]">순번</th>
              <th className="border border-gray-200 px-2 py-2">품목명</th>
              <th className="border border-gray-200 px-2 py-2 w-[90px]">규격(원지)</th>
              <th className="border border-gray-200 px-2 py-2 w-[70px]">종이결</th>
              <th className="border border-gray-200 px-2 py-2 w-[80px]">재단코기</th>
              <th className="border border-gray-200 px-2 py-2 w-[80px]">주문수량</th>
              <th className="border border-gray-200 px-2 py-2 w-[70px]">입고</th>
            </tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 px-1 py-1 text-center">{i + 1}</td>
                  <td className="border border-gray-200 px-1 py-1"><input type="text" value={item.product_name} onChange={e => updateItem(i, "product_name", e.target.value)} className="w-full px-1 py-1 border border-gray-200 rounded text-xs" /></td>
                  <td className="border border-gray-200 px-1 py-1">
                    <select value={item.spec} onChange={e => updateItem(i, "spec", e.target.value)} className="w-full py-1 border border-gray-200 rounded text-xs">
                      <option value="">선택</option><option>4X6 전지</option><option>국전</option><option>소국전</option>
                    </select>
                  </td>
                  <td className="border border-gray-200 px-1 py-1">
                    <select value={item.paper_grain} onChange={e => updateItem(i, "paper_grain", e.target.value)} className="w-full py-1 border border-gray-200 rounded text-xs">
                      <option value="">선택</option><option>횡목</option><option>종목</option>
                    </select>
                  </td>
                  <td className="border border-gray-200 px-1 py-1"><input type="text" value={item.cut_size} onChange={e => updateItem(i, "cut_size", e.target.value)} className="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center" /></td>
                  <td className="border border-gray-200 px-1 py-1"><input type="text" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center" /></td>
                  <td className="border border-gray-200 px-1 py-1"><input type="text" value={item.received} onChange={e => updateItem(i, "received", e.target.value)} className="w-full px-1 py-1 border border-gray-200 rounded text-xs text-center" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 py-3">
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-gray-700 text-white rounded text-sm font-medium disabled:opacity-50">{saving ? "저장중..." : "저장"}</button>
          <button onClick={copyOrder} className="px-6 py-2 border border-gray-300 rounded text-sm">발주서 복사</button>
          <button onClick={() => setView("list")} className="px-6 py-2 border border-gray-300 rounded text-sm">리스트</button>
          {editId && <button onClick={handleDelete} className="px-6 py-2 bg-red-600 text-white rounded text-sm">삭제</button>}
        </div>

        {/* 발주처 등록 모달 */}
        {showSupplierModal && (
          <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
              <h4 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">발주처 등록</h4>
              <div className="grid grid-cols-[70px_1fr] gap-2 text-sm items-center">
                <span className="font-semibold text-gray-600 text-xs">발주처명</span>
                <input type="text" placeholder="발주처명" value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                <span className="font-semibold text-gray-600 text-xs">담당자</span>
                <input type="text" placeholder="담당자명" value={newSupplier.contact_person} onChange={e => setNewSupplier(p => ({ ...p, contact_person: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                <span className="font-semibold text-gray-600 text-xs">전화</span>
                <input type="text" placeholder="02-0000-0000" value={newSupplier.phone} onChange={e => setNewSupplier(p => ({ ...p, phone: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                <span className="font-semibold text-gray-600 text-xs">팩스</span>
                <input type="text" placeholder="02-0000-0000" value={newSupplier.fax} onChange={e => setNewSupplier(p => ({ ...p, fax: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                <span className="font-semibold text-gray-600 text-xs">이메일</span>
                <input type="text" placeholder="email@example.com" value={newSupplier.email} onChange={e => setNewSupplier(p => ({ ...p, email: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <p className="text-xs text-gray-400 mt-2">발주처는 거래처와 별도로 관리됩니다.</p>
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={registerSupplier} className="px-5 py-2 bg-gray-700 text-white rounded text-sm">등록</button>
                <button onClick={() => setShowSupplierModal(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">닫기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <div className="flex gap-2 items-center">
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
          <span className="text-gray-400 text-xs">~</span>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
          <input type="text" placeholder="발주처/발주자 검색" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") setRefreshKey(k => k + 1); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs w-40" />
          <button onClick={() => setRefreshKey(k => k + 1)} className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs">검색</button>
        </div>
        <button onClick={() => openWrite()} className="px-5 py-2 bg-gray-700 text-white rounded text-sm font-medium">+ 발주서 작성</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead><tr className="bg-[#3b4b5b] text-white">
            <th className="border border-[#2d3a47] px-2 py-2.5 w-10"></th>
            <th className="border border-[#2d3a47] px-3 py-2.5 w-[140px]">발주No.</th>
            <th className="border border-[#2d3a47] px-3 py-2.5 w-[130px]">일자-No.</th>
            <th className="border border-[#2d3a47] px-3 py-2.5 w-[150px]">거래처명</th>
            <th className="border border-[#2d3a47] px-3 py-2.5 w-[90px]">담당자명</th>
            <th className="border border-[#2d3a47] px-3 py-2.5">용지종류 및 평량</th>
            <th className="border border-[#2d3a47] px-3 py-2.5 w-[60px]">인쇄</th>
          </tr></thead>
          <tbody>
            {orders.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">등록된 발주서가 없습니다.</td></tr> :
            orders.map((o, i) => (
              <tr key={o.id} className={`${i % 2 === 1 ? "bg-gray-50" : ""} hover:bg-blue-50`}>
                <td className="border border-gray-200 px-2 py-2 text-center">{(page - 1) * 20 + i + 1}</td>
                <td className="border border-gray-200 px-3 py-2 text-center"><button onClick={() => openWrite(o)} className="hover:text-blue-600 hover:underline">{o.po_no}</button></td>
                <td className="border border-gray-200 px-3 py-2 text-center">{o.po_date}</td>
                <td className="border border-gray-200 px-3 py-2 text-left">{o.supplier_name}</td>
                <td className="border border-gray-200 px-3 py-2 text-center">{o.orderer}</td>
                <td className="border border-gray-200 px-3 py-2 text-left">{(o.purchase_order_items || []).filter(it => it.product_name).map(it => `${it.product_name}${it.spec ? `(${it.spec})` : ""}`).join(", ") || "-"}</td>
                <td className="border border-gray-200 px-2 py-2 text-center">
                  <button onClick={() => window.open(`/dashboard/orders/print?id=${o.id}`, '_blank')} className="px-3 py-0.5 bg-red-600 text-white rounded text-xs whitespace-nowrap">인쇄</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 20 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          {Array.from({ length: Math.min(Math.ceil(total / 20), 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 rounded border text-xs ${p === page ? "bg-gray-700 text-white border-gray-700" : "border-gray-300 text-gray-500"}`}>{p}</button>
          ))}
          <span className="ml-2 text-xs text-gray-400">/ {Math.ceil(total / 20)} 페이지</span>
        </div>
      )}
    </div>
  );
}
