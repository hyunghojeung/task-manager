"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function WritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");
  const [editId, setEditId] = useState<string | null>(urlId);
  const [saving, setSaving] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clients, setClients] = useState<Array<{id:string;name:string;contact_person:string;phone:string;mobile:string;email:string}>>([]);
  const [categoryList, setCategoryList] = useState<Array<{id:string;name:string}>>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const [autoClients, setAutoClients] = useState<Array<{id:string;name:string;contact_person:string;phone:string;mobile:string;email:string}>>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newClient, setNewClient] = useState({name:"",contact_person:"",phone:"",mobile:"",email:""});
  const [formData, setFormData] = useState({
    orderer: "", contact: "", email: "", client_name: "",
    product_type: "", title: "", category_id: "",
    trade_type: "vat", tax_invoice: "", payment: "",
    paper_type: "", paper_weight: "", color: "", print_side: "", copies: "", page_count: "",
    binding: "", paper_size: "", coating: "", finishing: "",
    cover_paper_size: "", cover_orientation: "", cover_paper_type: "", cover_paper_weight: "",
    cover_print_side: "", cover_color: "",
    cover_coating: "", cover_copies: "", cover_finishing: "",
    discount: "",
    detail_spec: "", order_date: new Date().toISOString().slice(0, 10),
  });
  const [orderNo, setOrderNo] = useState("자동생성");
  const [itemRows, setItemRows] = useState(5);
  const [templateList, setTemplateList] = useState<Array<{id:string;name:string;columns:Array<{name:string;type:string}>;formulas:Array<{target:string;expression:string}>}>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateCols, setTemplateCols] = useState<Array<{name:string;type:string}>>([
    {name:"순번",type:"auto"},{name:"품목명",type:"텍스트"},{name:"규격",type:"텍스트"},
    {name:"부수",type:"숫자"},{name:"페이지수",type:"숫자"},{name:"단가",type:"숫자"},
    {name:"공급가",type:"자동계산"},{name:"부가세",type:"자동계산"},{name:"합계",type:"자동계산"}
  ]);
  const [templateFormulas, setTemplateFormulas] = useState<Array<{target:string;expression:string}>>([]);
  const [itemData, setItemData] = useState<Array<Record<string,string>>>(Array.from({length:5}, () => ({})));
  const [showDetail, setShowDetail] = useState(true);
  const [alwaysCollapse, setAlwaysCollapse] = useState(false);
  const [sizeCustom, setSizeCustom] = useState(false);
  const [coverSizeCustom, setCoverSizeCustom] = useState(false);
  const [attachments, setAttachments] = useState<Array<{id:string;file_name:string;file_size:number;dropbox_url:string}>>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  useEffect(() => {
    try {
      const cookies = document.cookie.split(";").map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith("session="));
      if (sessionCookie) {
        const decoded = decodeURIComponent(sessionCookie.split("=").slice(1).join("="));
        const session = JSON.parse(decoded);
        setCurrentUserId(session.user?.user_id || "");
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    const alwaysC = localStorage.getItem("writeAlwaysCollapseDetail") === "1";
    setAlwaysCollapse(alwaysC);
    if (alwaysC) {
      setShowDetail(false);
    } else {
      const v = localStorage.getItem("writeShowDetail");
      if (v !== null) setShowDetail(v === "1");
    }
  }, []);
  function toggleDetail() {
    const next = !showDetail;
    setShowDetail(next);
    localStorage.setItem("writeShowDetail", next ? "1" : "0");
  }
  function toggleAlwaysCollapse() {
    const next = !alwaysCollapse;
    setAlwaysCollapse(next);
    localStorage.setItem("writeAlwaysCollapseDetail", next ? "1" : "0");
    if (next) setShowDetail(false);
  }

  function calcFormulas(rowData: Record<string,string>, formulas: Array<{target:string;expression:string}>): Record<string,string> {
    const result = {...rowData};
    // 자동계산 대상 필드의 이전 값을 삭제 → 낡은 값 간섭 방지
    for (const f of formulas) {
      delete result[f.target];
    }
    // 수식을 2회 반복하여 수식 간 의존성 해결
    for (let pass = 0; pass < 2; pass++) {
      for (const f of formulas) {
        try {
          let expr = f.expression;
          // "x"를 "*"로 변환 (곱셈 기호 호환)
          expr = expr.replace(/(\d)x(\d)/g, '$1*$2').replace(/([가-힣])x([가-힣])/g, '$1*$2').replace(/\bx\b/g, '*');
          // 키를 긴 순서대로 정렬 (부분 문자열 충돌 방지: 공급가액 > 공급가)
          const sortedKeys = Object.keys(result).sort((a, b) => b.length - a.length);
          for (const key of sortedKeys) {
            const val = parseFloat(result[key]) || 0;
            expr = expr.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(val));
          }
          const computed = Function('"use strict"; return (' + expr + ')')();
          if (typeof computed === 'number' && !isNaN(computed)) {
            result[f.target] = String(Math.round(computed));
          }
        } catch { /* ignore */ }
      }
    }
    return result;
  }

  function formatNumber(v: string): string {
    const num = parseInt(v);
    if (isNaN(num)) return v;
    return num.toLocaleString();
  }

  function handleItemChange(rowIdx: number, colName: string, value: string) {
    setItemData(prev => {
      const newData = [...prev];
      // 숫자 타입이거나 콤마 포함된 숫자면 콤마 제거 후 순수 숫자만 저장
      const col = templateCols.find(tc => tc.name === colName);
      const stripped = value.replace(/,/g, "");
      const raw = (col?.type === "숫자" || /^-?\d+$/.test(stripped)) ? stripped.replace(/[^0-9\-]/g, "") : value;
      newData[rowIdx] = {...newData[rowIdx], [colName]: raw};
      // 일반 입력 필드가 모두 비어있으면 자동계산 필드도 모두 삭제
      const nonAutoCols = templateCols.filter(tc => tc.type !== "auto" && tc.type !== "자동계산");
      const allEmpty = nonAutoCols.every(tc => !newData[rowIdx][tc.name] || newData[rowIdx][tc.name].trim() === "");
      if (allEmpty) {
        // _bold 플래그는 유지
        const bold = newData[rowIdx]._bold;
        newData[rowIdx] = bold ? { _bold: bold } : {};
      } else if (templateFormulas.length > 0) {
        newData[rowIdx] = calcFormulas(newData[rowIdx], templateFormulas);
      }
      return newData;
    });
  }

  useEffect(() => {
    fetch(`/api/categories?_=${Date.now()}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCategoryList(d);
    }).catch(() => {});
    fetch(`/api/templates?_=${Date.now()}`).then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        setTemplateList(d);
        // 기본 양식 찾기 (is_default=true), 없으면 첫 번째
        const defaultTmpl = d.find((t: {is_default?: boolean}) => t.is_default) || d[0];
        setSelectedTemplate(defaultTmpl.name);
        if (defaultTmpl.columns?.length > 0) setTemplateCols(defaultTmpl.columns);
        if (defaultTmpl.formulas?.length > 0) setTemplateFormulas(defaultTmpl.formulas);
      }
    });
  }, []);

  // 현재 수식 타겟을 ref로 추적 (state 비동기 문제 방지)
  const currentFormulasRef = useRef(templateFormulas);
  currentFormulasRef.current = templateFormulas;

  function handleTemplateChange(name: string) {
    setSelectedTemplate(name);
    const tmpl = templateList.find(t => t.name === name);
    if (!tmpl) return;
    const newCols = tmpl.columns?.length ? tmpl.columns : templateCols;
    const newFormulas = tmpl.formulas?.length ? tmpl.formulas : [];
    // 이전 수식 타겟은 ref에서 안전하게 읽기
    const oldTargets = currentFormulasRef.current.map(f => f.target);
    const newTargets = newFormulas.map(f => f.target);
    const allTargets = [...new Set([...oldTargets, ...newTargets])];
    // state 일괄 업데이트
    setTemplateCols(newCols);
    setTemplateFormulas(newFormulas);
    setItemData(prev => prev.map(row => {
      const cleaned: Record<string,string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!allTargets.includes(k)) cleaned[k] = v;
      }
      if (newFormulas.length > 0) {
        return calcFormulas(cleaned, newFormulas);
      }
      return cleaned;
    }));
  }

  useEffect(() => {
    if (editId) {
      fetch(`/api/orders/${editId}?_=${Date.now()}`).then(r => r.json()).then(data => {
        if (data && !data.error) {
          setFormData({
            orderer: data.orderer || "", contact: data.contact || "", email: data.email || "",
            client_name: data.client_name || "", product_type: data.product_type || "",
            title: data.title || "", category_id: data.category_id || "",
            trade_type: data.trade_type || "vat", tax_invoice: data.tax_invoice || "",
            payment: data.payment || "", paper_type: data.paper_type || "", paper_weight: data.paper_weight || "",
            color: data.color || "", print_side: data.print_side || "",
            copies: data.copies || "", page_count: data.page_count || "", binding: data.binding || "",
            paper_size: data.paper_size || "", coating: data.coating || "",
            finishing: data.finishing || "",
            cover_paper_size: data.cover_paper_size || "", cover_orientation: data.cover_orientation || "",
            cover_paper_type: data.cover_paper_type || "", cover_paper_weight: data.cover_paper_weight || "",
            cover_print_side: data.cover_print_side || "", cover_color: data.cover_color || "",
            cover_coating: data.cover_coating || "", cover_copies: data.cover_copies || "",
            cover_finishing: data.cover_finishing || "",
            discount: data.discount != null ? String(data.discount) : "",
            detail_spec: data.detail_spec || "",
            order_date: data.order_date || new Date().toISOString().slice(0, 10),
          });
          setOrderNo(data.order_no || "");
          // 품목 데이터 복원
          if (data.order_items && data.order_items.length > 0) {
            const restored = data.order_items
              .sort((a: {sort_order:number}, b: {sort_order:number}) => a.sort_order - b.sort_order)
              .map((item: {data: Record<string,string>}) => item.data || {});
            setItemData(restored.length >= 5 ? restored : [...restored, ...Array.from({length: 5 - restored.length}, () => ({}))]);
            setItemRows(Math.max(restored.length, 5));
          }
          if (data.attachments && Array.isArray(data.attachments)) {
            setAttachments(data.attachments);
          }
          // 저장된 양식으로 템플릿 설정
          if (data.template_name && templateList.length > 0) {
            const tmpl = templateList.find(t => t.name === data.template_name);
            if (tmpl) {
              setSelectedTemplate(tmpl.name);
              if (tmpl.columns?.length) setTemplateCols(tmpl.columns);
              if (tmpl.formulas?.length) setTemplateFormulas(tmpl.formulas);
              else setTemplateFormulas([]);
            }
          }
        }
      });
    }
  }, [editId, templateList]);

  async function uploadFiles(files: FileList | File[]) {
    // pwindow 외 업체는 첨부 기능 차단
    try {
      const cookies = document.cookie.split(";").map(c => c.trim());
      const sc = cookies.find(c => c.startsWith("session="));
      if (sc) {
        const s = JSON.parse(decodeURIComponent(sc.split("=").slice(1).join("=")));
        if (s.company?.company_id !== "pwindow") {
          alert("이 기능은 추후 제공될 예정입니다.");
          return;
        }
      }
    } catch { /* ignore */ }
    setUploading(true);
    try {
      let orderId = editId;
      // editId가 없으면 임시 저장 후 orderId 획득
      if (!orderId) {
        const draftBody = { ...formData, title: formData.title || "", total_supply: 0, total_vat: 0, total_amount: 0, discount: 0 };
        const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draftBody) });
        const saved = await res.json();
        if (!res.ok || !saved?.id) { alert("임시저장 실패"); return; }
        orderId = saved.id;
        setEditId(saved.id);
        setOrderNo(saved.order_no || "");
        // URL을 새 주문 ID로 업데이트 (페이지 리로드 없이)
        window.history.replaceState(null, "", `/dashboard/write?id=${orderId}`);
      }
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("orderId", orderId as string);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok) { alert("업로드 실패: " + (d.error || "")); continue; }
      }
      const r = await fetch(`/api/orders/${orderId}?_=${Date.now()}`);
      const data = await r.json();
      setAttachments(data.attachments || []);
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(attId: string) {
    if (!confirm("첨부파일을 삭제할까요?")) return;
    const res = await fetch(`/api/upload/${attId}`, { method: "DELETE" });
    if (res.ok) setAttachments(prev => prev.filter(a => a.id !== attId));
    else alert("삭제 실패");
  }

  function openClientModal() {
    fetch(`/api/clients?_=${Date.now()}`).then(r => r.json()).then(d => setClients(d || []));
    setShowClientModal(true);
  }

  function selectClient(c: {name:string;contact_person:string;phone:string;mobile:string;email:string}) {
    setFormData(prev => ({ ...prev, client_name: c.name, orderer: c.contact_person || prev.orderer, contact: c.mobile || c.phone || prev.contact, email: c.email || prev.email }));
    setShowClientModal(false);
  }

  async function registerClient() {
    if (!newClient.name) { alert("회사명을 입력해주세요."); return; }
    const res = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newClient) });
    if (res.ok) {
      const created = await res.json();
      setFormData(prev => ({ ...prev, client_name: newClient.name, orderer: newClient.contact_person || prev.orderer, contact: newClient.mobile || newClient.phone || prev.contact, email: newClient.email || prev.email }));
      setNewClient({name:"",contact_person:"",phone:"",mobile:"",email:""});
      setShowRegisterModal(false);
      alert("거래처가 등록되었습니다.");
    } else {
      alert("등록 실패");
    }
  }

  function handleClientInput(value: string) {
    handleChange("client_name", value);
    if (value.length >= 1) {
      fetch(`/api/clients?_=${Date.now()}`).then(r => r.json()).then(d => {
        const filtered = (d || []).filter((c: {name:string}) => c.name?.toLowerCase().includes(value.toLowerCase()));
        setAutoClients(filtered);
        setShowAutoComplete(filtered.length > 0);
      });
    } else {
      setShowAutoComplete(false);
    }
  }

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!formData.title) { alert("제목을 입력해주세요."); return; }
    setSaving(true);
    try {
      const url = editId ? `/api/orders/${editId}` : "/api/orders";
      const method = editId ? "PUT" : "POST";
      // 합계 계산 - 합계금액/합계/총액 컬럼 우선, 없으면 공급가+부가세
      const supplyCol = templateCols.find(c => c.name.includes("공급") && (c.type === "자동계산" || c.type === "숫자"));
      const vatCol = templateCols.find(c => c.name.includes("부가") && (c.type === "자동계산" || c.type === "숫자"));
      const totalCol = templateCols.find(c => (c.name === "합계" || c.name === "합계금액" || c.name === "총액") && (c.type === "자동계산" || c.type === "숫자"));
      let totalSupply = 0;
      let totalVat = 0;
      itemData.forEach(row => {
        if (supplyCol) totalSupply += parseInt(row[supplyCol.name]) || 0;
        if (vatCol) totalVat += parseInt(row[vatCol.name]) || 0;
      });
      let totalAmount = totalSupply + totalVat;
      // 합계금액 컬럼이 있으면 그 값을 사용 (반올림 오차 방지)
      if (totalCol) {
        const colTotal = itemData.reduce((acc, row) => acc + (parseInt(row[totalCol.name]) || 0), 0);
        if (colTotal > 0) totalAmount = colTotal;
      }
      const discountAmount = parseInt(formData.discount) || 0;
      const finalAmount = totalAmount - discountAmount;

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, discount: discountAmount, total_supply: totalSupply, total_vat: totalVat, total_amount: totalAmount, template_name: selectedTemplate }) });
      if (res.ok) {
        const savedOrder = await res.json();
        const orderId = editId || savedOrder?.id;
        // 품목 데이터 저장
        if (orderId) {
          // 기존 품목 삭제 후 새로 저장
          await fetch(`/api/orders/${orderId}/items`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: itemData.filter(d => Object.keys(d).length > 0).map((d, i) => ({ sort_order: i, data: d })) }) });
        }
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

  function handleCopy() {
    if (!editId) return;
    if (!confirm("현재 작업을 복사하여 새 작업으로 등록합니다. 계속하시겠습니까?")) return;
    // editId 제거 → 저장 시 새 작업으로 등록됨
    setEditId(null);
    setOrderNo("자동생성");
    setAttachments([]);
    // 작성일을 오늘로 초기화
    setFormData(prev => ({ ...prev, order_date: new Date().toISOString().slice(0, 10), tax_invoice: "" }));
    // URL에서 id 파라미터 제거
    window.history.replaceState(null, "", "/dashboard/write");
    alert("복사되었습니다. 내용을 수정한 후 저장 버튼을 눌러주세요.");
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-base font-bold text-gray-800 mb-3">주문서입력</h2>
      <div className="bg-white rounded mb-3 overflow-hidden">
        <table className="w-full border-collapse text-sm"><tbody>
          <tr>
            <td className="w-[80px] text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200">주문No.</td>
            <td className="py-1.5 px-2 border border-gray-200"><input type="text" readOnly className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-100 text-gray-400" value={orderNo} /></td>
            <td className="w-[80px] text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200 text-center">작성일</td>
            <td className="py-1.5 px-2 border border-gray-200"><div className="flex gap-2 items-center"><input type="date" value={formData.order_date} onChange={e => handleChange("order_date", e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm" /><span className="text-xs text-gray-500">작성자: <strong className="text-[#3b4b5b]">{currentUserId || "-"}</strong></span></div></td>
          </tr>
          <tr>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200">주문자</td>
            <td className="py-1.5 px-2 border border-gray-200"><input type="text" placeholder="주문자" value={formData.orderer} onChange={e => handleChange("orderer", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200 text-center">연락처</td>
            <td className="py-1.5 px-2 border border-gray-200"><input type="text" placeholder="연락처" value={formData.contact} onChange={e => handleChange("contact", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200">
              <button type="button" onClick={() => setShowRegisterModal(true)} className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs">거래처</button>
            </td>
            <td className="py-1.5 px-2 border border-gray-200">
              <div style={{display:"flex",gap:"4px",alignItems:"center",position:"relative"}}>
                <input type="text" placeholder="거래처" value={formData.client_name} onChange={e => handleClientInput(e.target.value)} onBlur={() => setTimeout(() => setShowAutoComplete(false), 200)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                <button type="button" onClick={openClientModal} className="px-2 py-1 bg-blue-600 text-white rounded text-xs whitespace-nowrap">검색</button>
                {showAutoComplete && (
                  <div className="absolute top-full left-0 right-12 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                    {autoClients.map(c => (
                      <div key={c.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 flex justify-between" onClick={() => { selectClient(c); setShowAutoComplete(false); }}>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-gray-400 text-xs">{c.contact_person}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </td>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200 text-center">이메일</td>
            <td className="py-1.5 px-2 border border-gray-200"><input type="text" placeholder="이메일" value={formData.email} onChange={e => handleChange("email", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200">카테고리</td>
            <td className="py-1.5 px-2 border border-gray-200">
              <select value={formData.category_id} onChange={e => handleChange("category_id", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">선택</option>
                {categoryList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </td>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200 text-center">제품형태</td>
            <td className="py-1.5 px-2 border border-gray-200"><input type="text" placeholder="제품형태" value={formData.product_type} onChange={e => handleChange("product_type", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200">세금계산서</td>
            <td className="py-1.5 px-2 border border-gray-200"><input type="text" placeholder="발행일 직접 입력" value={formData.tax_invoice} onChange={e => handleChange("tax_invoice", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200 text-center">결제</td>
            <td className="py-1.5 px-2 border border-gray-200"><input type="text" placeholder="결제 정보" value={formData.payment} onChange={e => handleChange("payment", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
          </tr>
          <tr>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200">제목</td>
            <td className="py-1.5 px-2 border border-gray-200"><input type="text" placeholder="제목" value={formData.title} onChange={e => handleChange("title", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></td>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200 text-center">거래유형</td>
            <td className="py-1.5 px-2 border border-gray-200">
              <select value={formData.trade_type} onChange={e => handleChange("trade_type", e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="vat">부가세율 적용</option><option value="novat">부가세율 미적용</option><option value="cash">현금가격 적용</option>
              </select>
            </td>
          </tr>
          <tr className="print:hidden">
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200 align-top">첨부</td>
            <td colSpan={3} className="py-1.5 px-2 border border-gray-200">
              {(() => {
                let isPwindow = false;
                try {
                  const cookies = document.cookie.split(";").map(c => c.trim());
                  const sc = cookies.find(c => c.startsWith("session="));
                  if (sc) { const s = JSON.parse(decodeURIComponent(sc.split("=").slice(1).join("="))); isPwindow = s.company?.company_id === "pwindow"; }
                } catch { /* ignore */ }
                if (!isPwindow) {
                  return <div className="border-2 border-dashed border-gray-200 rounded p-3 text-center text-xs text-gray-400 bg-gray-50 cursor-not-allowed" onClick={() => alert("이 기능은 추후 제공될 예정입니다.")}>첨부파일 기능은 추후 제공될 예정입니다.</div>;
                }
                return null;
              })()}
              {(() => {
                let isPwindow = false;
                try {
                  const cookies = document.cookie.split(";").map(c => c.trim());
                  const sc = cookies.find(c => c.startsWith("session="));
                  if (sc) { const s = JSON.parse(decodeURIComponent(sc.split("=").slice(1).join("="))); isPwindow = s.company?.company_id === "pwindow"; }
                } catch { /* ignore */ }
                if (!isPwindow) return null;
                return (
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files); }}
                className={`block border-2 border-dashed rounded p-3 text-center text-xs cursor-pointer transition ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 text-gray-400 hover:border-blue-500"}`}
              >
                <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
                {uploading ? "업로드 중..." : editId ? "+ 파일을 드래그하여 놓거나 클릭하여 첨부 (Dropbox)" : "작업 저장 후 첨부 가능합니다"}
              </label>
                );
              })()}
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map(a => (
                    <li key={a.id} className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded">
                      <a href={a.dropbox_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate flex-1">{a.file_name}</a>
                      <span className="text-gray-400 ml-2">{(a.file_size / 1024).toFixed(1)} KB</span>
                      <button type="button" onClick={() => deleteAttachment(a.id)} className="ml-2 text-red-500 hover:text-red-700">삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
          <tr>
            <td className="text-[#3b4b5b] font-bold text-xs py-2 px-2 border border-gray-200 align-top">작업내용1</td>
            <td colSpan={3} className="py-1.5 px-2 border border-gray-200">
              <textarea placeholder="세부사양 및 후가공, 고객 상담 메모 등을 입력해주세요" value={formData.detail_spec} onChange={e => handleChange("detail_spec", e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded text-sm min-h-[156px] resize-y" />
            </td>
          </tr>
        </tbody></table>
      </div>

      {/* 세부내역 */}
      <div className="bg-white border border-gray-300 rounded p-4 mb-3">
        <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-[#3b4b5b]">
          <p className="font-bold text-sm text-gray-800">작업내용2</p>
          <div className="flex items-center gap-3 print:hidden">
            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={alwaysCollapse} onChange={toggleAlwaysCollapse} style={{width:"14px",height:"14px"}} />
              항상 접기
            </label>
            <button type="button" onClick={toggleDetail} className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#3b4b5b] border border-[#3b4b5b] rounded hover:bg-[#3b4b5b] hover:text-white transition">
              {showDetail ? "▼ 접기" : "▶ 펼치기"}
            </button>
          </div>
        </div>
        {showDetail && <>
        <div className="font-bold text-sm text-[#3b4b5b] mb-3 px-3 py-2 border-l-4 border-[#3b4b5b]">📘 표지</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">사이즈</label>
            {(() => {
              const sizeOptions = ["A4","A3","A2","190x260","465x315","A5","B4"];
              const isCustom = coverSizeCustom || (formData.cover_paper_size !== "" && !sizeOptions.includes(formData.cover_paper_size));
              const selectValue = isCustom ? "__custom__" : formData.cover_paper_size;
              return (
                <div className="flex-1 flex gap-2">
                  <select value={selectValue} onChange={e => {
                    if (e.target.value === "__custom__") { setCoverSizeCustom(true); handleChange("cover_paper_size", ""); }
                    else { setCoverSizeCustom(false); handleChange("cover_paper_size", e.target.value); }
                  }} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                    <option value="">선택</option>
                    {sizeOptions.map(s => <option key={s}>{s}</option>)}
                    <option value="__custom__">직접입력</option>
                  </select>
                  {isCustom && (
                    <input type="text" placeholder="사이즈 입력" value={formData.cover_paper_size} onChange={e => handleChange("cover_paper_size", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" autoFocus />
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">방향</label>
            <select value={formData.cover_orientation} onChange={e => handleChange("cover_orientation", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
              <option value="">선택</option><option>가로</option><option>세로</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">용지</label>
            {(() => {
              const paperWeights: Record<string, number[]> = {
                "복사지": [80, 100],
                "모조": [80, 100, 120, 150, 180, 230],
                "스노우": [100, 120, 150, 180, 200, 250, 300],
                "아트지": [100, 120, 150, 180, 200, 250, 300],
                "아르떼": [105, 130, 160, 190, 230],
              };
              const weights = paperWeights[formData.cover_paper_type] || [];
              return (
                <div className="flex-1 flex gap-2">
                  <select value={formData.cover_paper_type} onChange={e => { handleChange("cover_paper_type", e.target.value); handleChange("cover_paper_weight", ""); }} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                    <option value="">선택</option>
                    {["복사지","모조","스노우","아트지","아르떼"].map(o => <option key={o}>{o}</option>)}
                  </select>
                  <select value={formData.cover_paper_weight} onChange={e => handleChange("cover_paper_weight", e.target.value)} disabled={weights.length === 0} className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400">
                    <option value="">무게</option>
                    {weights.map(w => <option key={w} value={String(w)}>{w}g</option>)}
                  </select>
                </div>
              );
            })()}
          </div>
          {[
            ["인쇄면", "cover_print_side", ["양면","단면"]],
            ["색상", "cover_color", ["칼라","흑백"]],
            ["코팅", "cover_coating", ["무광","유광","엠보","실크"]],
          ].map(([label, key, options]) => (
            <div key={key as string} className="flex items-center gap-2">
              <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">{label as string}</label>
              <select value={formData[key as keyof typeof formData]} onChange={e => handleChange(key as string, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">선택</option>
                {(options as string[]).map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">부수</label>
            <input type="text" placeholder="부수 입력" value={formData.cover_copies} onChange={e => handleChange("cover_copies", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
          </div>
          <div className="flex items-start gap-2 md:col-span-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0 pt-1">후가공</label>
            <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border border-gray-300 rounded">
              {["금박","에폭시","스코딕스"].map(opt => {
                const selected = (formData.cover_finishing || "").split(",").filter(Boolean);
                const checked = selected.includes(opt);
                return (
                  <label key={opt} className="inline-flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={checked} style={{width:"14px",height:"14px"}} onChange={e => {
                      const next = e.target.checked ? [...selected, opt] : selected.filter(v => v !== opt);
                      handleChange("cover_finishing", next.join(","));
                    }} />
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <hr className="my-4 border-t-2 border-gray-300" />
        <div className="font-bold text-sm text-emerald-700 mb-3 px-3 py-2 border-l-4 border-emerald-700">📗 내지</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">용지</label>
            {(() => {
              const paperWeights: Record<string, number[]> = {
                "복사지": [80, 100],
                "모조": [80, 100, 120, 150, 180, 230],
                "스노우": [100, 120, 150, 180, 200, 250, 300],
                "아트지": [100, 120, 150, 180, 200, 250, 300],
                "아르떼": [105, 130, 160, 190, 230],
              };
              const weights = paperWeights[formData.paper_type] || [];
              return (
                <div className="flex-1 flex gap-2">
                  <select value={formData.paper_type} onChange={e => { handleChange("paper_type", e.target.value); handleChange("paper_weight", ""); }} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                    <option value="">선택</option>
                    {["복사지","모조","스노우","아트지","아르떼"].map(o => <option key={o}>{o}</option>)}
                  </select>
                  <select value={formData.paper_weight} onChange={e => handleChange("paper_weight", e.target.value)} disabled={weights.length === 0} className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400">
                    <option value="">무게</option>
                    {weights.map(w => <option key={w} value={String(w)}>{w}g</option>)}
                  </select>
                </div>
              );
            })()}
          </div>
          {[
            ["색상", "color", ["칼라","흑백"]],
            ["인쇄면", "print_side", ["양면","단면"]],
            ["제본방식", "binding", ["무선제본","하드커버제본","중철제본","스프링제본","반접제본","인쇄만"]],
            ["코팅", "coating", ["무광","유광"]],
          ].map(([label, key, options]) => (
            <div key={key as string} className="flex items-center gap-2">
              <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">{label as string}</label>
              <select value={formData[key as keyof typeof formData]} onChange={e => handleChange(key as string, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">선택</option>
                {(options as string[]).map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-start gap-2 md:col-span-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0 pt-1">후가공</label>
            <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border border-gray-300 rounded">
              {["재단","1줄오시","2줄오시","3줄오시","기타오시","접지","금박","에폭시","스코딕스"].map(opt => {
                const selected = (formData.finishing || "").split(",").filter(Boolean);
                const checked = selected.includes(opt);
                return (
                  <label key={opt} className="inline-flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={checked} style={{width:"14px",height:"14px"}} onChange={e => {
                      const next = e.target.checked ? [...selected, opt] : selected.filter(v => v !== opt);
                      handleChange("finishing", next.join(","));
                    }} />
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">부수</label>
            <input type="text" placeholder="부수 입력" value={formData.copies} onChange={e => handleChange("copies", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">페이지수</label>
            <input type="text" placeholder="페이지수 입력" value={formData.page_count} onChange={e => handleChange("page_count", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-bold text-[#3b4b5b] shrink-0">사이즈</label>
            {(() => {
              const sizeOptions = ["A4","A3","A2","190x260","465x315","A5","B4"];
              const isCustom = sizeCustom || (formData.paper_size !== "" && !sizeOptions.includes(formData.paper_size));
              const selectValue = isCustom ? "__custom__" : formData.paper_size;
              return (
                <div className="flex-1 flex gap-2">
                  <select value={selectValue} onChange={e => {
                    if (e.target.value === "__custom__") { setSizeCustom(true); handleChange("paper_size", ""); }
                    else { setSizeCustom(false); handleChange("paper_size", e.target.value); }
                  }} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                    <option value="">선택</option>
                    {sizeOptions.map(s => <option key={s}>{s}</option>)}
                    <option value="__custom__">직접입력</option>
                  </select>
                  {isCustom && (
                    <input type="text" placeholder="사이즈 입력" value={formData.paper_size} onChange={e => handleChange("paper_size", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" autoFocus />
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        </>}
      </div>

      {/* 표양식 (품목 테이블) - 동적 컬럼 */}
      <div className="bg-white border border-gray-300 rounded p-4 mb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#3b4b5b] border-l-4 border-[#3b4b5b] pl-2">표양식</span>
            <select key={selectedTemplate} value={selectedTemplate} onChange={e => { if (e.target.value !== selectedTemplate) handleTemplateChange(e.target.value); }} className="px-2 py-1 border border-gray-300 rounded text-xs print:hidden" style={{minHeight:"28px"}}>
              {templateList.length === 0 && <option>기본</option>}
              {templateList.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <a href="/admin?tab=template" className="px-2 py-1 bg-gray-600 text-white rounded text-xs no-underline hover:bg-gray-700 print:hidden">양식등록</a>
            <span className="text-xs text-red-500 print:hidden">※표양식을 변경하시려면 새로 작성하셔야 합니다.</span>
          </div>
          <button onClick={() => { setItemRows(r => r + 1); setItemData(p => [...p, {}]); }} className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-500 transition print:hidden">+ 행 추가</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-[#3b4b5b] text-white">
                <th className="border border-[#2d3a47] px-1 py-2.5 font-semibold" style={{width:"30px"}} title="체크 시 거래명세서/견적서에서 해당 품목명이 굵게 표시됩니다"><span className="text-[10px]">굵게</span></th>
                {templateCols.map((c, i) => (
                  <th key={i} className={`border border-[#2d3a47] px-2 py-2.5 font-semibold ${c.type === "자동계산" ? "bg-[#4a5a6b]" : ""}`} style={{width: (c as Record<string,string>).width ? `${(c as Record<string,string>).width}px` : c.name === "순번" ? "35px" : "auto", minWidth: 40}}>{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: itemRows }, (_, i) => i).map((rowIdx) => (
                <tr key={rowIdx}>
                  <td className="border border-gray-200 px-1 py-1 text-center">
                    <input type="checkbox" checked={itemData[rowIdx]?._bold === "1"} onChange={e => {
                      setItemData(prev => {
                        const newData = [...prev];
                        newData[rowIdx] = {...newData[rowIdx], _bold: e.target.checked ? "1" : ""};
                        return newData;
                      });
                    }} style={{width:"14px",height:"14px"}} />
                  </td>
                  {templateCols.map((c, ci) => (
                    <td key={ci} className={`border border-gray-200 px-1 py-1 ${c.type === "자동계산" ? "bg-amber-50" : ""}`}>
                      {c.type === "auto" ? <span className="text-center block">{rowIdx + 1}</span> :
                       c.type === "자동계산" ? <span className="block text-right text-xs px-1 py-1">{(() => { const v = itemData[rowIdx]?.[c.name] || ""; const n = parseInt(v); return !v || isNaN(n) || n === 0 ? "" : n.toLocaleString(); })()}</span> :
                       <input type="text" value={(c.type === "숫자" || /^\d+$/.test(itemData[rowIdx]?.[c.name] || "")) ? formatNumber(itemData[rowIdx]?.[c.name] || "") : (itemData[rowIdx]?.[c.name] || "")} onChange={e => handleItemChange(rowIdx, c.name, e.target.value)} className={`w-full px-1 py-1 border border-gray-200 rounded text-xs ${(c.type === "숫자" || /^\d+$/.test(itemData[rowIdx]?.[c.name] || "")) ? "text-right" : ""}`} />}
                    </td>
                  ))}
                </tr>
              ))}
              {(() => {
                // 합계 집계용 컬럼: auto 제외하고 숫자/자동계산 타입 또는 이름 매칭
                const sumCols = templateCols.filter(tc => {
                  if (tc.type === "auto") return false;
                  const name = (tc.name || "").trim();
                  // 숫자 타입이지만 단가/수량/페이지 같은 단순 숫자는 제외
                  if (tc.type === "자동계산") return true;
                  if (name.includes("공급")) return true;
                  if (name.includes("부가")) return true;
                  if (name.includes("합계")) return true;
                  if (name.includes("총액")) return true;
                  if (name.includes("금액") && !name.includes("외화")) return true;
                  return false;
                });
                const nonCalcCount = templateCols.length - sumCols.length;
                const sums: Record<string, number> = {};
                sumCols.forEach(c => { sums[c.name] = itemData.reduce((acc, row) => acc + (parseInt(row[c.name]) || 0), 0); });
                // 총액 = 합계/합계금액/총액 컬럼 우선, 없으면 공급가+부가세
                const totalCol = templateCols.find(c => c.name === "합계" || c.name === "합계금액" || c.name === "총액");
                let grandTotal = 0;
                if (totalCol && sums[totalCol.name] != null) grandTotal = sums[totalCol.name];
                else {
                  const supplyCol = templateCols.find(c => c.name.includes("공급"));
                  const vatCol = templateCols.find(c => c.name.includes("부가"));
                  grandTotal = (supplyCol ? sums[supplyCol.name] || 0 : 0) + (vatCol ? sums[vatCol.name] || 0 : 0);
                }
                const discountAmt = parseInt(formData.discount) || 0;
                const finalAmount = discountAmt > 0 ? grandTotal - discountAmt : 0;
                const calcCols = sumCols;
                return (
                  <>
                    <tr className="bg-gray-50 font-bold">
                      <td className="border border-gray-200"></td>
                      {templateCols.map((c, ci) => {
                        if (ci === 0) return <td key={ci} colSpan={Math.max(nonCalcCount, 1)} className="border border-gray-200 px-2 py-2 text-right">합 계</td>;
                        if (ci < nonCalcCount) return null;
                        return <td key={ci} className="border border-gray-200 px-2 py-2 text-right bg-amber-50">{(sums[c.name] || 0).toLocaleString()}</td>;
                      })}
                    </tr>
                    <tr className="bg-blue-50 font-bold">
                      <td colSpan={Math.max(nonCalcCount, 1) + 1} className="border border-gray-200 px-2 py-2 text-right text-blue-700">총 액</td>
                      <td colSpan={Math.max(calcCols.length, 1)} className="border border-gray-200 px-2 py-2 text-right text-blue-700 text-sm">{grandTotal.toLocaleString()}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* 할인/할인 후 총액 - 표양식 컨테이너 바깥 독립 영역 */}
      <div className="bg-white border border-gray-300 rounded p-0 mb-3 overflow-hidden">
        <div className="flex items-center bg-red-50 border-b border-gray-300" style={{minHeight:"40px"}}>
          <div className="flex-1 px-3 py-2 text-right text-red-700 font-bold text-xs">할 인</div>
          <div className="px-2 py-1" style={{width:"160px"}}>
            <input type="text" value={formData.discount} onChange={e => handleChange("discount", e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-right" />
          </div>
        </div>
        <div className="flex items-center bg-emerald-50" style={{minHeight:"40px"}}>
          <div className="flex-1 px-3 py-2 text-right text-emerald-700 font-bold text-xs">할인 후 총액</div>
          <div className="px-3 py-2 text-right text-emerald-700 font-bold text-sm" style={{width:"160px"}}>
            {(() => {
              const discountAmt = parseInt(formData.discount) || 0;
              if (discountAmt <= 0) return "0";
              const totalCol = templateCols.find(c => c.name === "합계" || c.name === "합계금액" || c.name === "총액");
              let gt = 0;
              if (totalCol) {
                gt = itemData.reduce((acc, row) => acc + (parseInt(row[totalCol.name]) || 0), 0);
              } else {
                const supplyCol = templateCols.find(c => c.name.includes("공급"));
                const vatCol = templateCols.find(c => c.name.includes("부가"));
                if (supplyCol) gt += itemData.reduce((acc, row) => acc + (parseInt(row[supplyCol.name]) || 0), 0);
                if (vatCol) gt += itemData.reduce((acc, row) => acc + (parseInt(row[vatCol.name]) || 0), 0);
              }
              return (gt - discountAmt).toLocaleString();
            })()}
          </div>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-2 py-3 print:hidden">
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{saving ? "저장중..." : "저장"}</button>
        <button onClick={() => router.push("/dashboard")} className="px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded text-sm">리스트</button>
        <button onClick={() => window.print()} className="px-6 py-2 bg-gray-700 text-white rounded text-sm">프린트</button>
        {editId && <button onClick={handleCopy} className="px-6 py-2 bg-amber-500 text-white rounded text-sm">복사</button>}
        {editId && <a href={`/print/statement?id=${editId}`} target="_blank" className="px-6 py-2 bg-indigo-600 text-white rounded text-sm">거래명세서</a>}
        {editId && <a href={`/print/estimate?id=${editId}`} target="_blank" className="px-6 py-2 bg-purple-600 text-white rounded text-sm">견적서</a>}
        {editId && <button onClick={handleDelete} className="px-6 py-2 bg-red-600 text-white rounded text-sm">삭제</button>}
      </div>
      {/* 거래처 검색 모달 */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-[850px] max-h-[80vh] overflow-y-auto shadow-xl">
            <h4 className="text-base font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">거래처 검색</h4>
            <div className="flex gap-2 mb-3">
              <input type="text" placeholder="거래처명을 입력하세요" value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" />
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-left font-semibold text-gray-600" style={{width:"35%"}}>회사명</th>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600" style={{width:"13%"}}>담당자</th>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600" style={{width:"17%"}}>전화</th>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600" style={{width:"17%"}}>핸드폰</th>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600" style={{width:"18%"}}>이메일</th>
                </tr>
              </thead>
              <tbody>
                {clients.filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                  <tr key={c.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => selectClient(c)}>
                    <td className="px-2 py-2 border-b border-gray-100 text-left">{c.name}</td>
                    <td className="px-2 py-2 border-b border-gray-100 text-center whitespace-nowrap">{c.contact_person}</td>
                    <td className="px-2 py-2 border-b border-gray-100 text-center">{c.phone}</td>
                    <td className="px-2 py-2 border-b border-gray-100 text-center">{c.mobile}</td>
                    <td className="px-2 py-2 border-b border-gray-100 text-left">{c.email}</td>
                  </tr>
                ))}
                {clients.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-400">등록된 거래처가 없습니다.</td></tr>}
              </tbody>
            </table>
            <div className="flex justify-end mt-3">
              <button onClick={() => setShowClientModal(false)} className="px-5 py-2 bg-gray-700 text-white rounded text-xs">닫기</button>
            </div>
          </div>
        </div>
      )}
      {/* 거래처 간편 등록 모달 */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h4 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">거래처 등록</h4>
            <div className="grid grid-cols-[70px_1fr] gap-2 text-sm items-center">
              <span className="font-semibold text-gray-600 text-xs">회사명</span>
              <input type="text" placeholder="회사명" value={newClient.name} onChange={e => setNewClient(p => ({...p, name: e.target.value}))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
              <span className="font-semibold text-gray-600 text-xs">담당자</span>
              <input type="text" placeholder="담당자" value={newClient.contact_person} onChange={e => setNewClient(p => ({...p, contact_person: e.target.value}))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
              <span className="font-semibold text-gray-600 text-xs">전화</span>
              <input type="text" placeholder="02-0000-0000" value={newClient.phone} onChange={e => setNewClient(p => ({...p, phone: e.target.value}))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
              <span className="font-semibold text-gray-600 text-xs">핸드폰</span>
              <input type="text" placeholder="010-0000-0000" value={newClient.mobile} onChange={e => setNewClient(p => ({...p, mobile: e.target.value}))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
              <span className="font-semibold text-gray-600 text-xs">이메일</span>
              <input type="text" placeholder="email@example.com" value={newClient.email} onChange={e => setNewClient(p => ({...p, email: e.target.value}))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={registerClient} className="px-5 py-2 bg-blue-600 text-white rounded text-sm">등록</button>
              <button onClick={() => setShowRegisterModal(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
