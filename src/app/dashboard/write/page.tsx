"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function WritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    orderer: "", contact: "", email: "", client_name: "",
    product_type: "", title: "", category_id: "",
    trade_type: "vat", tax_invoice: "", payment: "",
    paper_type: "", color: "", print_side: "", copies: "",
    binding: "", paper_size: "", coating: "", finishing: "",
    detail_spec: "", order_date: new Date().toISOString().slice(0, 10),
  });
  const [orderNo, setOrderNo] = useState("자동생성");

  useEffect(() => {
    if (editId) {
      fetch(`/api/orders/${editId}?_=${Date.now()}`).then(r => r.json()).then(data => {
        if (data && !data.error) {
          setFormData({
            orderer: data.orderer || "", contact: data.contact || "", email: data.email || "",
            client_name: data.client_name || "", product_type: data.product_type || "",
            title: data.title || "", category_id: data.category_id || "",
            trade_type: data.trade_type || "vat", tax_invoice: data.tax_invoice || "",
            payment: data.payment || "", paper_type: data.paper_type || "",
            color: data.color || "", print_side: data.print_side || "",
            copies: data.copies || "", binding: data.binding || "",
            paper_size: data.paper_size || "", coating: data.coating || "",
            finishing: data.finishing || "", detail_spec: data.detail_spec || "",
            order_date: data.order_date || new Date().toISOString().slice(0, 10),
          });
          setOrderNo(data.order_no || "");
        }
      });
    }
  }, [editId]);

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!formData.title) { alert("제목을 입력해주세요."); return; }
    setSaving(true);
    try {
      const url = editId ? `/api/orders/${editId}` : "/api/orders";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      if (res.ok) {
        alert(editId ? "수정되었습니다." : "저장되었습니다.");
        router.push("/dashboard");
      } else {
        const d = await res.json();
        alert(d.error || "저장 실패");
      }
    } catch { alert("서버 연결 실패"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!editId || !confirm("정말 삭제할까요?")) return;
    await fetch(`/api/orders/${editId}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-base font-bold text-gray-800 mb-3">주문서입력</h2>
      <div className="bg-white border border-gray-300 rounded p-4 mb-3">
        <table className="w-full text-sm"><tbody>
          <tr>
            <td className="w-[70px] font-semibold text-gray-600 text-xs py-1">주문No.</td>
            <td className="py-1"><input type="text" readOnly className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-100 text-gray-400" value={orderNo} /></td>
            <td className="w-[60px] font-semibold text-gray-600 text-xs py-1 text-right pr-2">작성일</td>
            <td className="py-1"><input type="date" value={formData.order_date} onChange={e => handleChange("order_date", e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="font-semibold text-gray-600 text-xs py-1">주문자</td>
            <td className="py-1"><input type="text" placeholder="주문자" value={formData.orderer} onChange={e => handleChange("orderer", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            <td className="font-semibold text-gray-600 text-xs py-1 text-right pr-2">연락처</td>
            <td className="py-1"><input type="text" placeholder="연락처" value={formData.contact} onChange={e => handleChange("contact", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="font-semibold text-gray-600 text-xs py-1">거래처</td>
            <td className="py-1"><input type="text" placeholder="거래처" value={formData.client_name} onChange={e => handleChange("client_name", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            <td className="font-semibold text-gray-600 text-xs py-1 text-right pr-2">이메일</td>
            <td className="py-1"><input type="text" placeholder="이메일" value={formData.email} onChange={e => handleChange("email", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="font-semibold text-gray-600 text-xs py-1">카테고리</td>
            <td className="py-1">
              <select value={formData.category_id} onChange={e => handleChange("category_id", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">선택</option><option>블랙카피</option><option>출력실</option><option>디자인실</option>
              </select>
            </td>
            <td className="font-semibold text-gray-600 text-xs py-1 text-right pr-2">제품형태</td>
            <td className="py-1"><input type="text" placeholder="제품형태" value={formData.product_type} onChange={e => handleChange("product_type", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="font-semibold text-gray-600 text-xs py-1">세금계산서</td>
            <td className="py-1"><input type="text" placeholder="발행일 직접 입력" value={formData.tax_invoice} onChange={e => handleChange("tax_invoice", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            <td className="font-semibold text-gray-600 text-xs py-1 text-right pr-2">결제</td>
            <td className="py-1"><input type="text" placeholder="결제 정보" value={formData.payment} onChange={e => handleChange("payment", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="font-semibold text-gray-600 text-xs py-1">제목</td>
            <td className="py-1"><input type="text" placeholder="제목" value={formData.title} onChange={e => handleChange("title", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            <td className="font-semibold text-gray-600 text-xs py-1 text-right pr-2">거래유형</td>
            <td className="py-1">
              <select value={formData.trade_type} onChange={e => handleChange("trade_type", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="vat">부가세율 적용</option><option value="novat">부가세율 미적용</option>
              </select>
            </td>
          </tr>
          <tr>
            <td className="font-semibold text-gray-600 text-xs py-1">첨부</td>
            <td colSpan={3} className="py-1">
              <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center text-gray-400 text-xs cursor-pointer hover:border-blue-500 transition">
                + 파일을 드래그하여 놓거나 클릭하여 첨부 (최대 1GB, Dropbox)
              </div>
            </td>
          </tr>
          <tr>
            <td className="font-semibold text-gray-600 text-xs py-1 align-top pt-2">세부사양</td>
            <td colSpan={3} className="py-1">
              <textarea placeholder="세부사양 및 후가공 내용" value={formData.detail_spec} onChange={e => handleChange("detail_spec", e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded text-sm min-h-[120px] resize-y" />
            </td>
          </tr>
        </tbody></table>
      </div>

      {/* 작업내용 */}
      <div className="bg-white border border-gray-300 rounded p-4 mb-3">
        <p className="font-bold text-sm text-gray-800 mb-3 pb-2 border-b border-gray-200">작업내용</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            ["용지", "paper_type", ["모조","스노우","아트지","아르떼","펄지","CCP"]],
            ["색상", "color", ["칼라","흑백"]],
            ["인쇄면", "print_side", ["양면","단면"]],
            ["제본방식", "binding", ["무선제본","중철","스프링","인쇄만"]],
            ["코팅", "coating", ["무광","유광"]],
            ["후가공", "finishing", ["재단","오시","접지","금박"]],
          ].map(([label, key, options]) => (
            <div key={key as string} className="flex items-center gap-2">
              <label className="w-16 text-xs font-semibold text-gray-600 shrink-0">{label as string}</label>
              <select value={formData[key as keyof typeof formData]} onChange={e => handleChange(key as string, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">선택</option>
                {(options as string[]).map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-semibold text-gray-600 shrink-0">부수</label>
            <input type="text" placeholder="부수 입력" value={formData.copies} onChange={e => handleChange("copies", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-semibold text-gray-600 shrink-0">사이즈</label>
            <select value={formData.paper_size} onChange={e => handleChange("paper_size", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
              <option value="">선택</option><option>A4</option><option>A3</option><option>A2</option><option>190x260</option><option>465x315</option><option>A5</option><option>B4</option>
            </select>
          </div>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-2 py-3">
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{saving ? "저장중..." : "저장"}</button>
        <button onClick={() => router.push("/dashboard")} className="px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded text-sm">리스트</button>
        {editId && <button onClick={handleDelete} className="px-6 py-2 bg-red-600 text-white rounded text-sm">삭제</button>}
      </div>
    </div>
  );
}
