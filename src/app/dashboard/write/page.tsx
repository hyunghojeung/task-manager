"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function WritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [saving, setSaving] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clients, setClients] = useState<Array<{id:string;name:string;contact_person:string;phone:string;mobile:string;email:string}>>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const [autoClients, setAutoClients] = useState<Array<{id:string;name:string;contact_person:string;phone:string;mobile:string;email:string}>>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newClient, setNewClient] = useState({name:"",contact_person:"",phone:"",mobile:"",email:""});
  const [formData, setFormData] = useState({
    orderer: "", contact: "", email: "", client_name: "",
    product_type: "", title: "", category_id: "",
    trade_type: "vat", tax_invoice: "", payment: "",
    paper_type: "", color: "", print_side: "", copies: "",
    binding: "", paper_size: "", coating: "", finishing: "",
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

  function calcFormulas(rowData: Record<string,string>, formulas: Array<{target:string;expression:string}>): Record<string,string> {
    const result = {...rowData};
    for (const f of formulas) {
      try {
        let expr = f.expression;
        for (const key of Object.keys(result)) {
          const val = parseFloat(result[key]) || 0;
          expr = expr.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(val));
        }
        const computed = Function('"use strict"; return (' + expr + ')')();
        if (typeof computed === 'number' && !isNaN(computed)) {
          result[f.target] = String(Math.round(computed));
        }
      } catch { /* ignore */ }
    }
    return result;
  }

  function handleItemChange(rowIdx: number, colName: string, value: string) {
    setItemData(prev => {
      const newData = [...prev];
      newData[rowIdx] = {...newData[rowIdx], [colName]: value};
      if (templateFormulas.length > 0) {
        newData[rowIdx] = calcFormulas(newData[rowIdx], templateFormulas);
      }
      return newData;
    });
  }

  useEffect(() => {
    fetch(`/api/templates?_=${Date.now()}`).then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        setTemplateList(d);
        setSelectedTemplate(d[0].name);
        if (d[0].columns?.length > 0) setTemplateCols(d[0].columns);
        if (d[0].formulas?.length > 0) setTemplateFormulas(d[0].formulas);
      }
    });
  }, []);

  function handleTemplateChange(name: string) {
    setSelectedTemplate(name);
    const tmpl = templateList.find(t => t.name === name);
    if (tmpl?.columns?.length) setTemplateCols(tmpl.columns);
    if (tmpl?.formulas?.length) setTemplateFormulas(tmpl.formulas);
    else setTemplateFormulas([]);
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
            payment: data.payment || "", paper_type: data.paper_type || "",
            color: data.color || "", print_side: data.print_side || "",
            copies: data.copies || "", binding: data.binding || "",
            paper_size: data.paper_size || "", coating: data.coating || "",
            finishing: data.finishing || "", detail_spec: data.detail_spec || "",
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
        }
      });
    }
  }, [editId]);

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
      // 합계 계산 - 자동계산 컬럼에서 공급가/부가세/합계를 찾아 합산
      const calcCols = templateCols.filter(c => c.type === "자동계산");
      let totalSupply = 0;
      let totalVat = 0;
      let totalAmount = 0;

      if (calcCols.length > 0) {
        const supplyCol = calcCols.find(c => c.name.includes("공급"));
        const vatCol = calcCols.find(c => c.name.includes("부가"));

        itemData.forEach(row => {
          if (supplyCol) totalSupply += parseInt(row[supplyCol.name]) || 0;
          if (vatCol) totalVat += parseInt(row[vatCol.name]) || 0;
        });
        totalAmount = totalSupply + totalVat;
      }

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, total_supply: totalSupply, total_vat: totalVat, total_amount: totalAmount }) });
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
            <td className="font-semibold text-gray-600 text-xs py-1">
              <button type="button" onClick={() => setShowRegisterModal(true)} className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs">거래처</button>
            </td>
            <td className="py-1">
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
            <td className="font-semibold text-gray-600 text-xs py-1 align-top pt-2">작업내용1<br/>(메모)</td>
            <td colSpan={3} className="py-1">
              <textarea placeholder="세부사양 및 후가공 내용" value={formData.detail_spec} onChange={e => handleChange("detail_spec", e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded text-sm min-h-[120px] resize-y" />
            </td>
          </tr>
        </tbody></table>
      </div>

      {/* 작업내용 */}
      <div className="bg-white border border-gray-300 rounded p-4 mb-3">
        <p className="font-bold text-sm text-gray-800 mb-3 pb-2 border-b border-gray-200">작업내용2</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            ["용지", "paper_type", ["모조","스노우","아트지","아르떼","펄지","CCP"]],
            ["색상", "color", ["칼라","흑백"]],
            ["인쇄면", "print_side", ["양면","단면"]],
            ["제본방식", "binding", ["무선제본","중철","스프링","인쇄만"]],
            ["코팅", "coating", ["무광","유광"]],
          ].map(([label, key, options]) => (
            <div key={key as string} className="flex items-center gap-2">
              <label className="w-16 text-xs font-semibold text-gray-600 shrink-0">{label as string}</label>
              <select value={formData[key as keyof typeof formData]} onChange={e => handleChange(key as string, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">선택</option>
                {(options as string[]).map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-start gap-2 md:col-span-2">
            <label className="w-16 text-xs font-semibold text-gray-600 shrink-0 pt-1">후가공</label>
            <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border border-gray-300 rounded">
              {["재단","1줄오시","2줄오시","3줄오시","기타오시","접지","금박","에폭시","스코딕스"].map(opt => {
                const selected = (formData.finishing || "").split(",").filter(Boolean);
                const checked = selected.includes(opt);
                return (
                  <label key={opt} className="inline-flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={e => {
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
            <label className="w-16 text-xs font-semibold text-gray-600 shrink-0">부수</label>
            <input type="text" placeholder="부수 입력" value={formData.copies} onChange={e => handleChange("copies", e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-semibold text-gray-600 shrink-0">사이즈</label>
            {(() => {
              const sizeOptions = ["A4","A3","A2","190x260","465x315","A5","B4"];
              const isCustom = formData.paper_size !== "" && !sizeOptions.includes(formData.paper_size);
              const selectValue = isCustom ? "__custom__" : formData.paper_size;
              return (
                <div className="flex-1 flex gap-2">
                  <select value={selectValue} onChange={e => {
                    if (e.target.value === "__custom__") handleChange("paper_size", " ");
                    else handleChange("paper_size", e.target.value);
                  }} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                    <option value="">선택</option>
                    {sizeOptions.map(s => <option key={s}>{s}</option>)}
                    <option value="__custom__">직접입력</option>
                  </select>
                  {(isCustom || formData.paper_size === " ") && (
                    <input type="text" placeholder="사이즈 입력" value={formData.paper_size.trim()} onChange={e => handleChange("paper_size", e.target.value || " ")} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" autoFocus />
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 표양식 (품목 테이블) - 동적 컬럼 */}
      <div className="bg-white border border-gray-300 rounded p-4 mb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">표양식</span>
            <select value={selectedTemplate} onChange={e => handleTemplateChange(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs">
              {templateList.length === 0 && <option>기본</option>}
              {templateList.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <a href="/admin?tab=template" className="px-2 py-1 bg-gray-600 text-white rounded text-xs no-underline hover:bg-gray-700">양식등록</a>
          </div>
          <button onClick={() => { setItemRows(r => r + 1); setItemData(p => [...p, {}]); }} className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-500 transition">+ 행 추가</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                {templateCols.map((c, i) => (
                  <th key={i} className={`border border-gray-200 px-2 py-2 ${c.type === "자동계산" ? "bg-amber-50" : ""}`} style={{width: (c as Record<string,string>).width ? `${(c as Record<string,string>).width}px` : c.name === "순번" ? "35px" : "auto", minWidth: 40}}>{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: itemRows }, (_, i) => i).map((rowIdx) => (
                <tr key={rowIdx}>
                  {templateCols.map((c, ci) => (
                    <td key={ci} className={`border border-gray-200 px-1 py-1 ${c.type === "자동계산" ? "bg-amber-50" : ""}`}>
                      {c.type === "auto" ? <span className="text-center block">{rowIdx + 1}</span> :
                       c.type === "자동계산" ? <span className="block text-right text-xs px-1 py-1">{itemData[rowIdx]?.[c.name] || ""}</span> :
                       <input type="text" value={itemData[rowIdx]?.[c.name] || ""} onChange={e => handleItemChange(rowIdx, c.name, e.target.value)} className={`w-full px-1 py-1 border border-gray-200 rounded text-xs ${c.type === "숫자" ? "text-right" : ""}`} />}
                    </td>
                  ))}
                </tr>
              ))}
              {(() => {
                const calcCols = templateCols.filter(tc => tc.type === "자동계산");
                const nonCalcCount = templateCols.length - calcCols.length;
                const sums: Record<string, number> = {};
                calcCols.forEach(c => { sums[c.name] = itemData.reduce((acc, row) => acc + (parseInt(row[c.name]) || 0), 0); });
                const grandTotal = Object.values(sums).reduce((a, b) => a + b, 0);
                return (
                  <>
                    <tr className="bg-gray-50 font-bold">
                      {templateCols.map((c, ci) => {
                        if (ci === 0) return <td key={ci} colSpan={nonCalcCount} className="border border-gray-200 px-2 py-2 text-right">합 계</td>;
                        if (ci < nonCalcCount) return null;
                        return <td key={ci} className="border border-gray-200 px-2 py-2 text-right bg-amber-50">{(sums[c.name] || 0).toLocaleString()}</td>;
                      })}
                    </tr>
                    <tr className="bg-blue-50 font-bold">
                      <td colSpan={nonCalcCount} className="border border-gray-200 px-2 py-2 text-right text-blue-700">총 액</td>
                      <td colSpan={calcCols.length} className="border border-gray-200 px-2 py-2 text-right text-blue-700 text-sm">{grandTotal.toLocaleString()}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-2 py-3">
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{saving ? "저장중..." : "저장"}</button>
        <button onClick={() => router.push("/dashboard")} className="px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded text-sm">리스트</button>
        {editId && <button onClick={handleDelete} className="px-6 py-2 bg-red-600 text-white rounded text-sm">삭제</button>}
      </div>
      {/* 거래처 검색 모달 */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-[650px] max-h-[80vh] overflow-y-auto shadow-xl">
            <h4 className="text-base font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">거래처 검색</h4>
            <div className="flex gap-2 mb-3">
              <input type="text" placeholder="거래처명을 입력하세요" value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" />
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600">회사명</th>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600">담당자</th>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600">전화</th>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600">핸드폰</th>
                  <th className="bg-gray-50 px-2 py-2 border-b-2 border-gray-200 text-center font-semibold text-gray-600">이메일</th>
                </tr>
              </thead>
              <tbody>
                {clients.filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                  <tr key={c.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => selectClient(c)}>
                    <td className="px-2 py-2 border-b border-gray-100 text-left">{c.name}</td>
                    <td className="px-2 py-2 border-b border-gray-100 text-center">{c.contact_person}</td>
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
