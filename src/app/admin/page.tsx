"use client";

import React, { useState, useEffect, useCallback } from "react";

type Tab = "notice" | "users" | "category" | "client" | "supplier" | "template" | "company";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("notice");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab;
    if (t && ["notice","users","category","client","supplier","template","company"].includes(t)) {
      setTab(t);
    }
  }, []);
  const tabs: { key: Tab; label: string }[] = [
    { key: "notice", label: "작업전달" }, { key: "users", label: "사용자관리" },
    { key: "category", label: "카테고리관리" }, { key: "client", label: "거래처관리" },
    { key: "supplier", label: "발주처관리" }, { key: "template", label: "양식폼관리" },
    { key: "company", label: "업체정보설정" },
  ];

  return (
    <div>
      <div className="bg-white border-b-2 border-gray-200 px-4 flex gap-0 overflow-x-auto mb-6">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 md:px-6 py-3 text-xs md:text-sm font-semibold border-b-[3px] whitespace-nowrap transition ${tab === t.key ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-800"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-w-5xl mx-auto">
        {tab === "notice" && <NoticeTab />}
        {tab === "users" && <UsersTab />}
        {tab === "category" && <CategoryTab />}
        {tab === "client" && <CrudTab endpoint="clients" title="거래처 관리" fields={[{k:"name",l:"회사명"},{k:"contact_person",l:"담당자"},{k:"phone",l:"전화"},{k:"mobile",l:"핸드폰"},{k:"email",l:"이메일"}]} />}
        {tab === "supplier" && <CrudTab endpoint="suppliers" title="발주처 관리" subtitle="발주처는 거래처와 별도로 관리됩니다. 발주서 작성 시 이 목록에서 선택합니다." fields={[{k:"name",l:"발주처명"},{k:"contact_person",l:"담당자"},{k:"phone",l:"전화"},{k:"fax",l:"팩스"},{k:"email",l:"이메일"}]} />}
        {tab === "template" && <TemplateTab />}
        {tab === "company" && <CompanyTab />}
      </div>
    </div>
  );
}

// ===== 작업전달 =====
function NoticeTab() {
  const [notices, setNotices] = useState<Array<{id:string;title:string;content?:string;created_at:string;users?:{name:string}}>>([]);
  const [title, setTitle] = useState(""); const [content, setContent] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/notices"); if(r.ok) setNotices(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  async function create() { if(!title) return; await fetch("/api/notices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,content})}); setTitle(""); setContent(""); load(); }
  async function remove(id:string) { if(!confirm("정말 삭제할까요?")) return; await fetch(`/api/notices/${id}`,{method:"DELETE"}); load(); }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-2 pb-2 border-b-2 border-gray-200">작업전달</h3>
      <p className="text-xs text-gray-500 mb-1">작성된 글은 리스트 화면 상단에 빨간색으로 깜빡이며 표시됩니다.</p>
      <p className="text-xs text-gray-500 mb-4">작업을 완료한 누군가가 작업완료 버튼을 클릭해야 작업표시가 사라집니다.</p>
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-5">
        <input type="text" placeholder="작업전달 제목" value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2" />
        <textarea placeholder="작업전달 내용" value={content} onChange={e=>setContent(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm min-h-[80px] resize-y mb-2" />
        <button onClick={create} className="px-5 py-2 bg-blue-600 text-white rounded text-sm">작업전달 등록</button>
      </div>
      <table className="w-full border-collapse text-xs border border-gray-300">
        <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-2 py-2.5 w-10">순번</th><th className="border border-[#2d3a47] px-2 py-2.5">제목</th><th className="border border-[#2d3a47] px-2 py-2.5 w-24">작성일</th><th className="border border-[#2d3a47] px-2 py-2.5 w-20">관리</th></tr></thead>
        <tbody>{notices.map((n,i) => (
          <tr key={n.id} className={i%2===1?"bg-gray-50":""}>
            <td className="border border-gray-200 px-2 py-2 text-center">{i+1}</td>
            <td className="border border-gray-200 px-2 py-2 text-left">{n.title}</td>
            <td className="border border-gray-200 px-2 py-2 text-center">{n.created_at?.slice(0,10)}</td>
            <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={()=>remove(n.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ===== 사용자관리 =====
function UsersTab() {
  const [users, setUsers] = useState<Array<{id:string;user_id:string;name:string;role:string;created_at:string}>>([]);
  const [form, setForm] = useState({name:"",user_id:"",password:"",role:"user"});
  const [showModal, setShowModal] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/users"); if(r.ok) setUsers(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  async function create(e:React.FormEvent) { e.preventDefault(); await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); setShowModal(false); setForm({name:"",user_id:"",password:"",role:"user"}); load(); }
  async function remove(id:string) { if(!confirm("정말 삭제할까요?")) return; await fetch(`/api/users/${id}`,{method:"DELETE"}); load(); }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">사용자 관리</h3>
      <table className="w-full border-collapse text-xs border border-gray-300">
        <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-2 py-2.5 w-10">순번</th><th className="border border-[#2d3a47] px-2 py-2.5">사용자ID</th><th className="border border-[#2d3a47] px-2 py-2.5">이름</th><th className="border border-[#2d3a47] px-2 py-2.5 w-16">권한</th><th className="border border-[#2d3a47] px-2 py-2.5 w-24">등록일</th><th className="border border-[#2d3a47] px-2 py-2.5 w-20">관리</th></tr></thead>
        <tbody>{users.map((u,i) => (
          <tr key={u.id} className={i%2===1?"bg-gray-50":""}>
            <td className="border border-gray-200 px-2 py-2 text-center">{i+1}</td>
            <td className="border border-gray-200 px-2 py-2 text-center font-bold">{u.user_id}</td>
            <td className="border border-gray-200 px-2 py-2 text-center">{u.name}</td>
            <td className="border border-gray-200 px-2 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${u.role==="admin"?"bg-amber-100 text-amber-800":"bg-blue-100 text-blue-800"}`}>{u.role==="admin"?"관리자":"사용자"}</span></td>
            <td className="border border-gray-200 px-2 py-2 text-center">{u.created_at?.slice(0,10)}</td>
            <td className="border border-gray-200 px-2 py-2 text-center">{u.role!=="admin"&&<button onClick={()=>remove(u.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button>}</td>
          </tr>
        ))}</tbody>
      </table>
      <button onClick={()=>setShowModal(true)} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded text-sm">+ 사용자 추가</button>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setShowModal(false)}}>
          <form onSubmit={create} className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h4 className="text-base font-bold mb-4 pb-2 border-b-2 border-gray-200">사용자 추가</h4>
            <div className="grid gap-3 text-sm">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">이름</label><input required type="text" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">사용자 ID</label><input required type="text" value={form.user_id} onChange={e=>setForm(p=>({...p,user_id:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label><input type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">권한</label><select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"><option value="user">사용자</option><option value="admin">관리자</option></select></div>
            </div>
            <div className="flex gap-2 justify-end mt-4"><button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded text-sm">등록</button><button type="button" onClick={()=>setShowModal(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">취소</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

// ===== 카테고리관리 =====
function CategoryTab() {
  const [items, setItems] = useState<Array<{id:string;name:string}>>([]);
  const [name, setName] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/categories"); if(r.ok) setItems(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  async function create() { if(!name) return; await fetch("/api/categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})}); setName(""); load(); }
  async function remove(id:string) { if(!confirm("정말 삭제할까요?")) return; await fetch(`/api/categories/${id}`,{method:"DELETE"}); load(); }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">카테고리 관리</h3>
      <table className="w-full border-collapse text-xs border border-gray-300 max-w-md">
        <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-2 py-2.5 w-10">순번</th><th className="border border-[#2d3a47] px-2 py-2.5">카테고리명</th><th className="border border-[#2d3a47] px-2 py-2.5 w-20">관리</th></tr></thead>
        <tbody>{items.map((c,i) => (
          <tr key={c.id} className={i%2===1?"bg-gray-50":""}><td className="border border-gray-200 px-2 py-2 text-center">{i+1}</td><td className="border border-gray-200 px-2 py-2 text-center">{c.name}</td><td className="border border-gray-200 px-2 py-2 text-center"><button onClick={()=>remove(c.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button></td></tr>
        ))}</tbody>
      </table>
      <div className="flex gap-2 mt-4"><input type="text" placeholder="카테고리명" value={name} onChange={e=>setName(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm" /><button onClick={create} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm">+ 추가</button></div>
    </div>
  );
}

// ===== 거래처/발주처 공통 =====
function CrudTab({endpoint, title, fields, subtitle}:{endpoint:string; title:string; fields:{k:string;l:string}[]; subtitle?:string}) {
  const [items, setItems] = useState<Array<Record<string,string>>>([]);
  const [form, setForm] = useState<Record<string,string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await fetch(`/api/${endpoint}?_=${Date.now()}`); if(r.ok) setItems(await r.json()); }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if(!form[fields[0].k]) return;
    if (editId) {
      await fetch(`/api/${endpoint}/${editId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      setEditId(null);
    } else {
      await fetch(`/api/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    }
    setForm({});
    load();
  }

  function startEdit(item: Record<string,string>) {
    setEditId(item.id);
    const newForm: Record<string,string> = {};
    fields.forEach(f => { newForm[f.k] = item[f.k] || ""; });
    setForm(newForm);
  }

  function cancelEdit() { setEditId(null); setForm({}); }

  async function remove(id:string) { if(!confirm("정말 삭제할까요?")) return; await fetch(`/api/${endpoint}/${id}`,{method:"DELETE"}); load(); }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-2 pb-2 border-b-2 border-gray-200">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mb-4">{subtitle}</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs border border-gray-300">
          <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-1.5 py-2.5 w-10">순번</th>{fields.map(f=><th key={f.k} className="border border-[#2d3a47] px-1.5 py-2.5">{f.l}</th>)}<th className="border border-[#2d3a47] px-1.5 py-2.5 w-[100px]">관리</th></tr></thead>
          <tbody>{items.map((item,i) => (
            <tr key={item.id} className={i%2===1?"bg-gray-50":""}>
              <td className="border border-gray-200 px-1.5 py-[7px] text-center">{i+1}</td>
              {fields.map(f=><td key={f.k} className="border border-gray-200 px-1.5 py-[7px] text-left">{item[f.k]}</td>)}
              <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap">
                <button onClick={()=>startEdit(item)} className="text-blue-600 border border-blue-600 px-2 py-0.5 rounded text-xs mr-1">수정</button>
                <button onClick={()=>remove(item.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {/* 등록 폼 - 미리보기 HTML과 동일한 grid 레이아웃 */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mt-4">
        <div className="grid grid-cols-[70px_1fr_70px_1fr] gap-2 items-center text-sm">
          {fields.map((f, idx) => {
            const isLast = idx === fields.length - 1 && fields.length % 2 !== 0;
            return (
              <React.Fragment key={f.k}>
                <span className="font-semibold text-gray-600 text-xs">{f.l}</span>
                <input type="text" placeholder={f.l} value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} className={`px-2 py-1.5 border border-gray-300 rounded text-sm ${isLast ? "col-span-3" : ""}`} />
              </React.Fragment>
            );
          })}
        </div>
        <div className="mt-3">
          <button onClick={save} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm">{editId ? "수정 저장" : `+ ${title.replace(" 관리","")} 등록`}</button>
          {editId && <button onClick={cancelEdit} className="px-4 py-1.5 border border-gray-300 rounded text-sm">취소</button>}
        </div>
      </div>
    </div>
  );
}

// ===== 양식폼관리 =====
function TemplateTab() {
  interface Tmpl { id: string; name: string; columns: Array<{name:string;type:string}>; formulas: Array<{target:string;expression:string}> }
  const [templates, setTemplates] = useState<Tmpl[]>([]);
  const [newName, setNewName] = useState("");
  const [editTmpl, setEditTmpl] = useState<Tmpl | null>(null);
  const [cols, setCols] = useState<Array<{name:string;type:string}>>([{name:"순번",type:"auto"}]);
  const [formulas, setFormulas] = useState<Array<{target:string;expression:string}>>([]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/templates?_=${Date.now()}`);
    if (r.ok) setTemplates(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addTemplate() {
    if (!newName) return;
    const defaultCols = [{name:"순번",type:"auto"},{name:"품목명",type:"텍스트"},{name:"규격",type:"텍스트"},{name:"수량",type:"숫자"},{name:"단가",type:"숫자"},{name:"공급가",type:"자동계산"},{name:"부가세",type:"자동계산"},{name:"합계",type:"자동계산"}];
    const defaultFormulas = [{target:"공급가",expression:"수량 * 단가"},{target:"부가세",expression:"공급가 * 0.1"},{target:"합계",expression:"공급가 + 부가세"}];
    await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, columns: defaultCols, formulas: defaultFormulas }) });
    setNewName(""); load();
  }
  async function removeTemplate(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" }); load();
  }
  function startEdit(t: Tmpl) {
    setEditTmpl(t);
    setCols(t.columns?.length ? t.columns : [{name:"순번",type:"auto"}]);
    setFormulas(t.formulas?.length ? t.formulas : []);
  }
  async function saveTemplate() {
    if (!editTmpl) return;
    await fetch(`/api/templates/${editTmpl.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columns: cols, formulas }) });
    setEditTmpl(null); load(); alert("양식이 저장되었습니다.");
  }
  function addCol() { setCols(p => [...p, {name:"",type:"텍스트"}]); }
  function removeCol(i: number) { setCols(p => p.filter((_,idx) => idx !== i)); }
  function updateCol(i: number, field: string, val: string) { setCols(p => p.map((c,idx) => idx === i ? {...c,[field]:val} : c)); }
  function addFormula() { setFormulas(p => [...p, {target:"",expression:""}]); }
  function removeFormula(i: number) { setFormulas(p => p.filter((_,idx) => idx !== i)); }
  function updateFormula(i: number, field: string, val: string) { setFormulas(p => p.map((f,idx) => idx === i ? {...f,[field]:val} : f)); }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-2 pb-2 border-b-2 border-gray-200">표양식관리</h3>
      <p className="text-xs text-gray-500 mb-4">양식을 만들면 사용자가 주문서 입력 시 선택할 수 있습니다. 컬럼과 계산공식을 자유롭게 지정하세요.</p>

      {/* 양식 목록 */}
      <div className="mb-4">
        {templates.map(t => (
          <div key={t.id} className={`flex justify-between items-center p-3 border rounded mb-2 cursor-pointer ${editTmpl?.id === t.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
            <div>
              <span className="font-semibold text-sm text-gray-800">{t.name}</span>
              <span className="text-xs text-gray-400 ml-2">{t.columns?.length ? t.columns.map(c=>c.name).join(", ") : "(미설정)"}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(t)} className="text-blue-600 border border-blue-600 px-2 py-0.5 rounded text-xs">편집</button>
              <button onClick={() => removeTemplate(t.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="새 양식 이름" value={newName} onChange={e => setNewName(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm" />
        <button onClick={addTemplate} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm">+ 양식 추가</button>
      </div>

      {/* 편집 영역 */}
      {editTmpl && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-5 mt-4">
          <h4 className="text-sm font-bold text-gray-800 mb-3">양식 편집: <span className="text-blue-600">{editTmpl.name}</span></h4>

          {/* 1. 컬럼 설정 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">1. 컬럼 설정</p>
            <div className="flex flex-col gap-1">
              {cols.map((c, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${c.type === "자동계산" ? "bg-amber-50 border-amber-300" : c.type === "auto" ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200"}`}>
                  <span className="text-gray-400 cursor-grab">☰</span>
                  <input type="text" value={c.name} onChange={e => updateCol(i, "name", e.target.value)} readOnly={c.type === "auto"} className="w-24 px-1 py-0.5 border border-gray-300 rounded text-xs" style={c.type === "auto" ? {background:"#eee"} : {}} />
                  <select value={c.type} onChange={e => updateCol(i, "type", e.target.value)} className="text-xs px-1 py-0.5 border border-gray-300 rounded">
                    {c.type === "auto" ? <option>자동순번</option> : <><option>텍스트</option><option>숫자</option><option>자동계산</option></>}
                  </select>
                  <input type="text" value={(c as Record<string,string>).width || ""} onChange={e => updateCol(i, "width", e.target.value)} placeholder="폭" className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs text-center" title="컬럼 폭 (예: 80, 120)" />
                  {c.type === "자동계산" && (
                    <>
                      <span className="text-xs text-amber-700 shrink-0">계산식 적용</span>
                      <input type="text" placeholder={`${c.name} 계산식 입력 (예: 수량 * 단가)`} value={formulas.find(f => f.target === c.name)?.expression || ""} onChange={e => {
                        const idx = formulas.findIndex(f => f.target === c.name);
                        if (idx >= 0) { updateFormula(idx, "expression", e.target.value); }
                        else { setFormulas(p => [...p, {target: c.name, expression: e.target.value}]); }
                      }} className="flex-1 px-2 py-0.5 border border-amber-300 rounded text-xs font-mono bg-amber-50 min-w-[150px]" />
                    </>
                  )}
                  {c.type !== "auto" && <button onClick={() => removeCol(i)} className="text-red-500 text-sm">x</button>}
                </div>
              ))}
            </div>
            <button onClick={addCol} className="mt-2 px-3 py-1 border border-gray-300 rounded text-xs text-gray-500 hover:bg-blue-50">+ 컬럼 추가</button>
          </div>

          {/* 2. 계산공식 설정 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">2. 계산공식 설정</p>
            <p className="text-xs text-gray-400 mb-2">컬럼명을 사용하여 수식을 입력하세요. 사용 가능: +, -, *, /, (, )</p>
            <div className="flex flex-col gap-1">
              {formulas.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded text-xs">
                  <span className="font-bold text-blue-600 w-16">{f.target}</span>
                  <span className="text-gray-400">=</span>
                  <input type="text" value={f.expression} onChange={e => updateFormula(i, "expression", e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono bg-gray-50" />
                  <input type="text" value={f.target} onChange={e => updateFormula(i, "target", e.target.value)} placeholder="대상 컬럼" className="w-16 px-1 py-1 border border-gray-300 rounded text-xs" />
                  <button onClick={() => removeFormula(i)} className="text-red-500 text-sm">x</button>
                </div>
              ))}
            </div>
            <button onClick={addFormula} className="mt-2 px-3 py-1 border border-gray-300 rounded text-xs text-gray-500 hover:bg-blue-50">+ 계산식 추가</button>
          </div>

          {/* 3. 미리보기 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">3. 미리보기</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead><tr>{cols.map((c,i) => <th key={i} className={`border border-gray-300 px-2 py-1.5 text-center font-semibold ${c.type === "자동계산" ? "bg-amber-50" : "bg-gray-100"}`} style={{width: (c as Record<string,string>).width ? `${(c as Record<string,string>).width}px` : "auto", minWidth: 40}}>{c.name}</th>)}</tr></thead>
                <tbody>
                  {[1,2,3].map(n => (
                    <tr key={n}>{cols.map((c,i) => <td key={i} className={`border border-gray-200 px-2 py-1 text-center ${c.type === "자동계산" ? "bg-amber-50" : ""}`}>{n === 1 ? (c.type === "auto" ? "1" : c.type === "자동계산" ? <span className="text-amber-700 text-[10px]">자동계산</span> : <span className="text-gray-300 text-[10px]">{c.type}</span>) : c.type === "auto" ? n : ""}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-1">노란색 배경 컬럼 = 자동 계산되는 컬럼</p>
          </div>

          <div className="flex gap-2">
            <button onClick={saveTemplate} className="px-5 py-1.5 bg-blue-600 text-white rounded text-xs">양식 저장</button>
            <button onClick={() => setEditTmpl(null)} className="px-5 py-1.5 border border-gray-300 rounded text-xs">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 업체정보설정 =====
function CompanyTab() {
  const [company, setCompany] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/company").then(r=>r.json()).then(setCompany); }, []);
  async function save() { setSaving(true); await fetch("/api/company",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(company)}); setSaving(false); alert("저장되었습니다."); }
  function set(k:string,v:string) { setCompany(p=>({...p,[k]:v})); }

  const fields = [
    ["company_name","업체명"],["business_number","사업자번호"],["representative","대표자"],
    ["phone","연락처"],["fax","팩스"],["email","이메일"],["business_type","업태"],
    ["address","주소"],["business_category","종목"],["company_id","업체 ID"],["password","비밀번호"],
  ];
  const mailFields = [["mail_email","발신 이메일"],["mail_id","메일 아이디"],["mail_password","메일 비밀번호"]];
  const dropboxFields = [["dropbox_app_key","App Key"],["dropbox_app_secret","App Secret"],["dropbox_access_token","Access Token"],["dropbox_path","저장 경로"]];

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-6 mb-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">회사 기본정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {fields.map(([k,l]) => (
            <div key={k} className={`flex items-center gap-2 ${["address","business_category"].includes(k)?"md:col-span-2":""}`}>
              <label className="w-20 text-xs font-semibold text-gray-600 shrink-0">{l}</label>
              <input type={k==="password"||k==="mail_password"?"password":"text"} value={company[k]||""} onChange={e=>set(k,e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">이메일 발송 설정</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm max-w-2xl">
          <div className="flex items-center gap-2 md:col-span-2"><label className="w-24 text-xs font-semibold text-gray-600 shrink-0">메일 서비스</label><select value={company.mail_service||"naver"} onChange={e=>set("mail_service",e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"><option value="naver">네이버</option><option value="daum">다음</option></select></div>
          {mailFields.map(([k,l])=>(<div key={k} className="flex items-center gap-2"><label className="w-24 text-xs font-semibold text-gray-600 shrink-0">{l}</label><input type={k.includes("password")?"password":"text"} value={company[k]||""} onChange={e=>set(k,e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>))}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">Dropbox API 설정</h3>
        <div className="grid grid-cols-1 gap-3 text-sm max-w-2xl">
          {dropboxFields.map(([k,l])=>(<div key={k} className="flex items-center gap-2"><label className="w-24 text-xs font-semibold text-gray-600 shrink-0">{l}</label><input type={k.includes("secret")||k.includes("token")?"password":"text"} value={company[k]||""} onChange={e=>set(k,e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>))}
        </div>
      </div>
      <div className="flex justify-center py-3"><button onClick={save} disabled={saving} className="px-10 py-2.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{saving?"저장중...":"저장"}</button></div>
    </div>
  );
}
