"use client";

import React, { useState, useEffect, useCallback } from "react";

type Tab = "notice" | "users" | "category" | "client" | "supplier" | "template" | "company" | "import";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("notice");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab;
    if (t && ["notice","users","category","client","supplier","template","company","import"].includes(t)) {
      setTab(t);
    }
  }, []);
  const tabs: { key: Tab; label: string }[] = [
    { key: "notice", label: "작업전달" }, { key: "users", label: "사용자관리" },
    { key: "category", label: "카테고리관리" }, { key: "client", label: "거래처관리" },
    { key: "supplier", label: "발주처관리" }, { key: "template", label: "양식폼관리" },
    { key: "company", label: "업체정보설정" }, { key: "import", label: "CSV가져오기" },
  ];

  return (
    <div>
      <div className="bg-white border-b-2 border-gray-200 px-4 flex justify-center gap-0 overflow-x-auto mb-6">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 md:px-6 py-3 text-sm md:text-base font-bold border-b-[3px] whitespace-nowrap transition ${tab === t.key ? "text-blue-600 border-blue-600" : "text-gray-800 border-transparent hover:text-blue-500"}`}>
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
        {tab === "import" && <ImportTab />}
      </div>
    </div>
  );
}

// ===== CSV 가져오기 =====
interface FileInfo { name: string; rows: Record<string,string>[]; headers: string[] }

function ImportTab() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{success:number;skip:number;errors:string[]}|null>(null);

  function parseCsv(text: string): { headers: string[]; rows: Record<string,string>[] } {
    const lines: string[][] = [];
    let cur: string[] = [];
    let field = "";
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuote) {
        if (c === '"') {
          if (text[i+1] === '"') { field += '"'; i++; }
          else inQuote = false;
        } else field += c;
      } else {
        if (c === '"') inQuote = true;
        else if (c === ",") { cur.push(field); field = ""; }
        else if (c === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; }
        else if (c === "\r") continue;
        else field += c;
      }
    }
    if (field || cur.length) { cur.push(field); lines.push(cur); }
    const h = lines[0] || [];
    const rs = lines.slice(1).filter(l => l.some(v => v.trim())).map(l => {
      const o: Record<string,string> = {};
      h.forEach((k, i) => o[k] = (l[i] || "").trim());
      return o;
    });
    return { headers: h, rows: rs };
  }

  async function parseXlsx(file: File): Promise<{ headers: string[]; rows: Record<string,string>[] }> {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
    if (json.length === 0) return { headers: [], rows: [] };
    const h = Object.keys(json[0]);
    const rs = json.map(r => {
      const o: Record<string,string> = {};
      for (const k of h) o[k] = ((r[k] ?? "") + "").trim();
      return o;
    });
    return { headers: h, rows: rs };
  }

  async function readCsv(file: File): Promise<{ headers: string[]; rows: Record<string,string>[] }> {
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (text.includes("\uFFFD")) {
      try { text = new TextDecoder("euc-kr").decode(buffer); }
      catch { try { text = new TextDecoder("cp949").decode(buffer); } catch { /* ignore */ } }
    }
    return parseCsv(text);
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const parsed: FileInfo[] = [];
    setProgress("파일 읽는 중...");
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setProgress(`파일 읽는 중 ${i+1}/${list.length}: ${file.name}`);
      try {
        const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
        const { headers, rows } = isXlsx ? await parseXlsx(file) : await readCsv(file);
        parsed.push({ name: file.name, headers, rows });
      } catch (err) {
        console.error("파일 읽기 실패:", file.name, err);
      }
    }
    setFiles(parsed);
    setProgress("");
    setResult(null);
  }

  async function handleImport() {
    if (files.length === 0) { alert("파일을 먼저 업로드해주세요."); return; }
    const totalRows = files.reduce((s, f) => s + f.rows.length, 0);
    if (!confirm(`${files.length}개 파일, 총 ${totalRows}행을 가져오시겠습니까?`)) return;
    setImporting(true);
    setResult(null);
    const combined = { success: 0, skip: 0, errors: [] as string[] };
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(`가져오는 중 ${i+1}/${files.length}: ${f.name} (${f.rows.length}행)`);
      try {
        const res = await fetch("/api/admin/import-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: f.rows }) });
        const d = await res.json();
        combined.success += d.success || 0;
        combined.skip += d.skip || 0;
        if (d.errors && Array.isArray(d.errors)) combined.errors.push(...d.errors.map((e: string) => `[${f.name}] ${e}`));
      } catch (err) {
        combined.errors.push(`[${f.name}] ${err instanceof Error ? err.message : "전송 실패"}`);
      }
    }
    setResult(combined);
    setProgress("");
    setImporting(false);
  }

  const totalRows = files.reduce((s, f) => s + f.rows.length, 0);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">이카운트 CSV/엑셀 가져오기</h3>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        <p className="font-semibold mb-1">필수 컬럼:</p>
        <p>작성일, 순번, 주문자, 연락처, 거래처명, 제품형태, 제목, 거래유형, 세부사양/후가공, 품목명, 규격, 수량, 페이지수, 단가, 공급가액, 부가세, 합계금액</p>
        <p className="mt-2">※ CSV 또는 엑셀(xlsx, xls) 파일 지원. 여러 파일 동시 선택 가능 (Ctrl+클릭)</p>
        <p>※ 같은 작성일+순번은 하나의 주문으로 그룹됩니다. 같은 주문번호가 이미 있으면 건너뜁니다.</p>
      </div>
      <div className="mb-4">
        <input type="file" accept=".csv,.xlsx,.xls" multiple onChange={handleFiles} className="text-sm" />
      </div>

      {progress && (
        <div className="mb-3 p-2 bg-gray-100 rounded text-xs text-gray-700">{progress}</div>
      )}

      {files.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">선택된 파일: {files.length}개 (총 {totalRows}행)</p>
          <div className="border border-gray-300 rounded max-h-60 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 sticky top-0"><tr>
                <th className="border border-gray-200 px-2 py-1 text-left">파일명</th>
                <th className="border border-gray-200 px-2 py-1 w-20 text-center">행 수</th>
              </tr></thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={i}>
                    <td className="border border-gray-200 px-2 py-1 truncate max-w-md">{f.name}</td>
                    <td className="border border-gray-200 px-2 py-1 text-center">{f.rows.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <button onClick={handleImport} disabled={importing} className="px-6 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
          {importing ? "가져오는 중..." : "가져오기 실행"}
        </button>
      )}

      {result && (
        <div className="mt-4 p-3 border rounded text-sm">
          <p className="text-green-700 font-semibold">성공: {result.success}건</p>
          <p className="text-amber-700">건너뜀: {result.skip}건 (중복)</p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-red-700 font-semibold">오류 {result.errors.length}건:</p>
              <ul className="text-xs text-red-600 mt-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
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
  const [editUser, setEditUser] = useState<{id:string;user_id:string;name:string;role:string}|null>(null);
  const [editForm, setEditForm] = useState({name:"",password:"",role:"user"});
  const [showEditModal, setShowEditModal] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/users"); if(r.ok) setUsers(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  async function create(e:React.FormEvent) { e.preventDefault(); await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); setShowModal(false); setForm({name:"",user_id:"",password:"",role:"user"}); load(); }
  async function remove(id:string) { if(!confirm("정말 삭제할까요?")) return; await fetch(`/api/users/${id}`,{method:"DELETE"}); load(); }
  function openEdit(u: {id:string;user_id:string;name:string;role:string}) {
    setEditUser(u);
    setEditForm({name:u.name,password:"",role:u.role});
    setShowEditModal(true);
  }
  async function saveEdit(e:React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    const body: Record<string,string> = { name: editForm.name, role: editForm.role };
    if (editForm.password) body.password = editForm.password;
    const res = await fetch(`/api/users/${editUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowEditModal(false); setEditUser(null); load(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error || "수정 실패"); }
  }
  async function toggleRole(id:string, currentRole:string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const res = await fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: newRole }) });
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); alert(d.error || "권한 변경 실패"); }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">사용자 관리</h3>
      <table className="w-full border-collapse text-xs border border-gray-300">
        <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-2 py-2.5 w-12">순번</th><th className="border border-[#2d3a47] px-2 py-2.5 w-32">사용자ID</th><th className="border border-[#2d3a47] px-2 py-2.5 w-28">이름</th><th className="border border-[#2d3a47] px-2 py-2.5 w-20">권한</th><th className="border border-[#2d3a47] px-2 py-2.5 w-28">등록일</th><th className="border border-[#2d3a47] px-2 py-2.5 w-20">관리</th></tr></thead>
        <tbody>{users.map((u,i) => (
          <tr key={u.id} className={i%2===1?"bg-gray-50":""}>
            <td className="border border-gray-200 px-2 py-2 text-center">{i+1}</td>
            <td className="border border-gray-200 px-2 py-2 text-center font-bold">{u.user_id}</td>
            <td className="border border-gray-200 px-2 py-2 text-center">{u.name}</td>
            <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={() => toggleRole(u.id, u.role)} className={`px-2 py-0.5 rounded-full text-xs cursor-pointer hover:opacity-80 ${u.role==="admin"?"bg-amber-100 text-amber-800":"bg-blue-100 text-blue-800"}`}>{u.role==="admin"?"관리자":"사용자"}</button></td>
            <td className="border border-gray-200 px-2 py-2 text-center">{u.created_at?.slice(0,10)}</td>
            <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={() => openEdit(u)} className="text-blue-600 border border-blue-600 px-2 py-0.5 rounded text-xs mr-1">수정</button><button onClick={()=>remove(u.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button></td>
          </tr>
        ))}</tbody>
      </table>
      <button onClick={()=>setShowModal(true)} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded text-sm">+ 사용자 추가</button>
      {showEditModal && editUser && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setShowEditModal(false)}}>
          <form onSubmit={saveEdit} className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h4 className="text-base font-bold mb-4 pb-2 border-b-2 border-gray-200">사용자 수정</h4>
            <div className="grid gap-3 text-sm">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">사용자 ID</label><input type="text" value={editUser.user_id} readOnly className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-100 text-gray-400" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">이름</label><input required type="text" value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label><input type="password" value={editForm.password} onChange={e=>setEditForm(p=>({...p,password:e.target.value}))} placeholder="변경 시에만 입력" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">권한</label><select value={editForm.role} onChange={e=>setEditForm(p=>({...p,role:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"><option value="user">사용자</option><option value="admin">관리자</option></select></div>
            </div>
            <div className="flex gap-2 justify-end mt-4"><button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded text-sm">저장</button><button type="button" onClick={()=>setShowEditModal(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">취소</button></div>
          </form>
        </div>
      )}
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
  async function remove(id:string) {
    if(!confirm("정말 삭제할까요?")) return;
    const res = await fetch(`/api/categories/${id}`,{method:"DELETE"});
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); alert("삭제 실패: " + (d.error || res.status)); }
  }

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
  interface Tmpl { id: string; name: string; columns: Array<{name:string;type:string}>; formulas: Array<{target:string;expression:string}>; is_default?: boolean }
  const [templates, setTemplates] = useState<Tmpl[]>([]);
  const [newName, setNewName] = useState("");
  const [editTmpl, setEditTmpl] = useState<Tmpl | null>(null);
  const [cols, setCols] = useState<Array<{name:string;type:string}>>([{name:"순번",type:"auto"}]);
  const [formulas, setFormulas] = useState<Array<{target:string;expression:string}>>([]);
  const [colOptions, setColOptions] = useState<Array<{id:string;name:string;sort_order:number}>>([]);
  const [newColName, setNewColName] = useState("");
  const defaultColNames = ["품목명","규격","종류","수량","페이지수","단가","공급가액","부가세","합계금액"];

  const load = useCallback(async () => {
    const r = await fetch(`/api/templates?_=${Date.now()}`);
    if (r.ok) setTemplates(await r.json());
  }, []);
  const loadOptions = useCallback(async () => {
    const r = await fetch(`/api/column-options?_=${Date.now()}`);
    if (r.ok) setColOptions(await r.json());
  }, []);
  useEffect(() => { load(); loadOptions(); }, [load, loadOptions]);

  async function addColOption() {
    if (!newColName.trim()) return;
    await fetch("/api/column-options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newColName.trim(), sort_order: colOptions.length }) });
    setNewColName("");
    loadOptions();
  }
  async function removeColOption(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/column-options/${id}`, { method: "DELETE" });
    loadOptions();
  }
  async function updateColOption(id: string, name: string) {
    await fetch(`/api/column-options/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    loadOptions();
  }
  // 사용할 컬럼명 리스트: DB에 있으면 그것을 사용, 없으면 기본값
  const availableColNames = colOptions.length > 0 ? colOptions.map(o => o.name) : defaultColNames;

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
  const [dragIdx, setDragIdx] = useState<number|null>(null);
  function handleDragStart(e: React.DragEvent, i: number) { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }
  function handleDragOver(e: React.DragEvent, i: number) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragIdx === null || dragIdx === i) return; setCols(prev => { const next = [...prev]; const [moved] = next.splice(dragIdx, 1); next.splice(i, 0, moved); return next; }); setDragIdx(i); }
  function handleDragEnd() { setDragIdx(null); }
  function moveCol(from: number, to: number) { if (to < 0 || to >= cols.length) return; setCols(prev => { const next = [...prev]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next; }); }
  async function setDefault(id: string) {
    setTemplates(prev => prev.map(t => ({ ...t, is_default: t.id === id })));
    await fetch("/api/templates/default", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-2 pb-2 border-b-2 border-gray-200">표양식관리</h3>
      <p className="text-xs text-gray-500 mb-4">양식을 만들면 사용자가 주문서 입력 시 선택할 수 있습니다. 컬럼과 계산공식을 자유롭게 지정하세요.</p>

      {/* 양식 목록 */}
      <div className="mb-4">
        {templates.map(t => (
          <div key={t.id} className={`flex justify-between items-center p-3 border rounded mb-2 ${editTmpl?.id === t.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                <input type="radio" name="defaultTmpl" checked={!!t.is_default} onChange={() => setDefault(t.id)} />
                기본값
              </label>
              <span className="font-semibold text-sm text-gray-800">{t.name}</span>
              {t.is_default && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">DEFAULT</span>}
              <span className="text-xs text-gray-400">{t.columns?.length ? t.columns.map(c=>c.name).join(", ") : "(미설정)"}</span>
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
                <div key={`${c.name}-${c.type}-${i}`} onDragOver={e => handleDragOver(e, i)} onDrop={e => e.preventDefault()} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${dragIdx === i ? "opacity-50 border-blue-400 bg-blue-50" : ""} ${c.type === "자동계산" ? "bg-amber-50 border-amber-300" : c.type === "auto" ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200"}`}>
                  <span draggable onDragStart={e => handleDragStart(e, i)} onDragEnd={handleDragEnd} className="text-gray-400 cursor-grab select-none text-sm" title="드래그하여 순서 변경">☰</span>
                  <span className="flex flex-col">
                    <button type="button" onClick={() => moveCol(i, i - 1)} disabled={i === 0} className="text-xs leading-3 text-gray-500 hover:text-blue-600 disabled:opacity-20 px-0.5">▲</button>
                    <button type="button" onClick={() => moveCol(i, i + 1)} disabled={i === cols.length - 1} className="text-xs leading-3 text-gray-500 hover:text-blue-600 disabled:opacity-20 px-0.5">▼</button>
                  </span>
                  {c.type === "auto" ? (
                    <input type="text" value={c.name} readOnly className="w-24 px-1 py-0.5 border border-gray-300 rounded text-xs" style={{background:"#eee"}} />
                  ) : (
                    <select value={c.name} onChange={e => updateCol(i, "name", e.target.value)} className="w-28 px-1 py-0.5 border border-gray-300 rounded text-xs">
                      <option value="">선택</option>
                      {availableColNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
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

          {/* 컬럼명 관리 */}
          <div className="mb-4 p-3 bg-white border border-gray-200 rounded">
            <p className="text-xs font-bold text-gray-700 mb-1">사용 가능한 컬럼명 관리</p>
            <p className="text-[10px] text-gray-500 mb-2">양식 편집 시 선택 가능한 컬럼명 리스트입니다. 원하는 항목을 추가/삭제/수정하세요.</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(colOptions.length > 0 ? colOptions : defaultColNames.map((n, i) => ({ id: `default-${i}`, name: n, sort_order: i }))).map(o => (
                <div key={o.id} className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-300 rounded text-xs">
                  {o.id.startsWith("default-") ? (
                    <span className="text-gray-600">{o.name}</span>
                  ) : (
                    <input type="text" value={o.name} onChange={e => setColOptions(prev => prev.map(p => p.id === o.id ? {...p, name: e.target.value} : p))} onBlur={e => updateColOption(o.id, e.target.value)} className="w-20 px-1 py-0 border-0 text-xs bg-transparent focus:outline-none focus:bg-yellow-50" />
                  )}
                  {!o.id.startsWith("default-") && (
                    <button onClick={() => removeColOption(o.id)} className="text-red-500 hover:text-red-700">×</button>
                  )}
                </div>
              ))}
            </div>
            {colOptions.length === 0 && (
              <p className="text-[10px] text-amber-600 mb-2">※ 기본값 사용중. 컬럼명을 추가하면 기본값이 대체됩니다.</p>
            )}
            <div className="flex gap-2">
              <input type="text" placeholder="새 컬럼명" value={newColName} onChange={e => setNewColName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addColOption(); }} className="px-2 py-1 border border-gray-300 rounded text-xs w-32" />
              <button onClick={addColOption} className="px-3 py-1 bg-gray-700 text-white rounded text-xs">+ 추가</button>
              {colOptions.length === 0 && (
                <button onClick={async () => {
                  for (let i = 0; i < defaultColNames.length; i++) {
                    await fetch("/api/column-options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: defaultColNames[i], sort_order: i }) });
                  }
                  loadOptions();
                }} className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-600">기본값 불러오기</button>
              )}
            </div>
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
  async function save() {
    setSaving(true);
    const res = await fetch("/api/company",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(company)});
    setSaving(false);
    if (res.ok) alert("저장되었습니다.");
    else { const d = await res.json().catch(() => ({})); alert("저장 실패: " + (d.error || res.status)); }
  }
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
          <div className="flex items-start gap-2 md:col-span-2">
            <label className="w-20 text-xs font-semibold text-gray-600 shrink-0 pt-2">회사 도장</label>
            <div className="flex-1">
              <input type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 500 * 1024) { alert("500KB 이하 이미지만 첨부 가능합니다."); return; }
                const reader = new FileReader();
                reader.onload = () => set("seal_image", reader.result as string);
                reader.readAsDataURL(file);
              }} className="text-xs" />
              <p className="text-[10px] text-gray-400 mt-1">PNG 투명 배경 권장, 500KB 이하 (DB companies.seal_image 컬럼에 저장)</p>
              {company.seal_image && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={company.seal_image} alt="도장" className="w-20 h-20 object-contain border border-gray-200 rounded bg-white" />
                  <button type="button" onClick={() => set("seal_image", "")} className="px-2 py-1 text-xs text-red-500 border border-red-300 rounded hover:bg-red-50">삭제</button>
                </div>
              )}
            </div>
          </div>
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
        {company.company_id !== "pwindow" && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            이 기능은 추후 서비스될 예정입니다.
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 text-sm max-w-2xl">
          {dropboxFields.map(([k,l])=>(<div key={k} className="flex items-center gap-2"><label className="w-24 text-xs font-semibold text-gray-600 shrink-0">{l}</label><input type={k.includes("secret")||k.includes("token")?"password":"text"} value={company[k]||""} onChange={e=>set(k,e.target.value)} disabled={company.company_id !== "pwindow"} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400" /></div>))}
        </div>
      </div>
      <div className="flex justify-center py-3"><button onClick={save} disabled={saving} className="px-10 py-2.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{saving?"저장중...":"저장"}</button></div>
    </div>
  );
}
