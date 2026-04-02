"use client";

import { useState, useEffect, useCallback } from "react";

type Tab = "notice" | "users" | "category" | "client" | "supplier" | "template" | "company";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("notice");
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
        {tab === "supplier" && <CrudTab endpoint="suppliers" title="발주처 관리" fields={[{k:"name",l:"발주처명"},{k:"contact_person",l:"담당자"},{k:"phone",l:"전화"},{k:"fax",l:"팩스"},{k:"email",l:"이메일"}]} />}
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
  const [form, setForm] = useState({name:"",user_id:"",password:"@pw4332@",role:"user"});
  const [showModal, setShowModal] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/users"); if(r.ok) setUsers(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  async function create(e:React.FormEvent) { e.preventDefault(); await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); setShowModal(false); setForm({name:"",user_id:"",password:"@pw4332@",role:"user"}); load(); }
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
function CrudTab({endpoint, title, fields}:{endpoint:string; title:string; fields:{k:string;l:string}[]}) {
  const [items, setItems] = useState<Array<Record<string,string>>>([]);
  const [form, setForm] = useState<Record<string,string>>({});
  const load = useCallback(async () => { const r = await fetch(`/api/${endpoint}`); if(r.ok) setItems(await r.json()); }, [endpoint]);
  useEffect(() => { load(); }, [load]);
  async function create() { if(!form[fields[0].k]) return; await fetch(`/api/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); setForm({}); load(); }
  async function remove(id:string) { if(!confirm("정말 삭제할까요?")) return; await fetch(`/api/${endpoint}/${id}`,{method:"DELETE"}); load(); }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs border border-gray-300">
          <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-2 py-2.5 w-10">순번</th>{fields.map(f=><th key={f.k} className="border border-[#2d3a47] px-2 py-2.5">{f.l}</th>)}<th className="border border-[#2d3a47] px-2 py-2.5 w-20">관리</th></tr></thead>
          <tbody>{items.map((item,i) => (
            <tr key={item.id} className={i%2===1?"bg-gray-50":""}><td className="border border-gray-200 px-2 py-2 text-center">{i+1}</td>{fields.map(f=><td key={f.k} className="border border-gray-200 px-2 py-2 text-left">{item[f.k]}</td>)}<td className="border border-gray-200 px-2 py-2 text-center"><button onClick={()=>remove(item.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button></td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {fields.map(f=><input key={f.k} type="text" placeholder={f.l} value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-32" />)}
        <button onClick={create} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm">+ 등록</button>
      </div>
    </div>
  );
}

// ===== 양식폼관리 =====
function TemplateTab() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-2 pb-2 border-b-2 border-gray-200">표양식관리</h3>
      <p className="text-xs text-gray-500 mb-4">양식을 만들면 사용자가 주문서 입력 시 선택할 수 있습니다.</p>
      {["부가세포함", "제본용", "브로셔용", "옵셋용"].map(name => (
        <div key={name} className="flex justify-between items-center p-3 border border-gray-200 rounded mb-2 hover:bg-gray-50">
          <span className="font-semibold text-sm text-gray-800">{name}</span>
          <div className="flex gap-1"><button className="text-blue-600 border border-blue-600 px-2 py-0.5 rounded text-xs">편집</button><button className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button></div>
        </div>
      ))}
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
