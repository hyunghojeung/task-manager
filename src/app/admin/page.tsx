"use client";

import React, { useState, useEffect, useCallback } from "react";

type Tab = "notice" | "users" | "category" | "client" | "supplier" | "template" | "company" | "import" | "shop" | "program";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("notice");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab;
    if (t && ["notice","users","category","client","supplier","template","company","import","shop","program"].includes(t)) {
      setTab(t);
    }
  }, []);
  const tabs: { key: Tab; label: string }[] = [
    { key: "notice", label: "작업전달" }, { key: "users", label: "사용자관리" },
    { key: "category", label: "카테고리관리" }, { key: "client", label: "거래처관리" },
    { key: "supplier", label: "발주처관리" }, { key: "template", label: "양식폼관리" },
    { key: "company", label: "업체정보설정" }, { key: "import", label: "CSV가져오기" },
    { key: "shop", label: "쇼핑몰연동" }, { key: "program", label: "프로그램배포" },
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
        {tab === "shop" && <ShopTab />}
        {tab === "program" && <ProgramTab />}
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
  const [editId, setEditId] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/notices"); if(r.ok) setNotices(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  async function save() {
    if(!title) return;
    if (editId) {
      await fetch(`/api/notices/${editId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,content})});
    } else {
      await fetch("/api/notices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,content})});
    }
    setTitle(""); setContent(""); setEditId(null); load();
  }
  function startEdit(n: {id:string;title:string;content?:string}) {
    setEditId(n.id); setTitle(n.title); setContent(n.content || "");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() { setEditId(null); setTitle(""); setContent(""); }
  async function remove(id:string) { if(!confirm("정말 삭제할까요?")) return; await fetch(`/api/notices/${id}`,{method:"DELETE"}); load(); }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-2 pb-2 border-b-2 border-gray-200">작업전달</h3>
      <p className="text-xs text-gray-500 mb-1">작성된 글은 리스트 화면 상단에 빨간색으로 깜빡이며 표시됩니다.</p>
      <p className="text-xs text-gray-500 mb-4">작업을 완료한 누군가가 작업완료 버튼을 클릭해야 작업표시가 사라집니다.</p>
      <div className={`bg-gray-50 border ${editId ? "border-blue-400" : "border-gray-200"} rounded-md p-4 mb-5`}>
        {editId && <p className="text-xs text-blue-600 font-semibold mb-2">수정 중...</p>}
        <input type="text" placeholder="작업전달 제목" value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2" />
        <textarea placeholder="작업전달 내용" value={content} onChange={e=>setContent(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm min-h-[80px] resize-y mb-2" />
        <div className="flex gap-2">
          <button onClick={save} className="px-5 py-2 bg-blue-600 text-white rounded text-sm">{editId ? "수정 저장" : "작업전달 등록"}</button>
          {editId && <button onClick={cancelEdit} className="px-5 py-2 bg-gray-500 text-white rounded text-sm">취소</button>}
        </div>
      </div>
      <table className="w-full border-collapse text-xs border border-gray-300">
        <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-2 py-2.5 w-10">순번</th><th className="border border-[#2d3a47] px-2 py-2.5">제목</th><th className="border border-[#2d3a47] px-2 py-2.5 w-24">작성일</th><th className="border border-[#2d3a47] px-2 py-2.5 w-32">관리</th></tr></thead>
        <tbody>{notices.map((n,i) => (
          <tr key={n.id} className={i%2===1?"bg-gray-50":""}>
            <td className="border border-gray-200 px-2 py-2 text-center">{i+1}</td>
            <td className="border border-gray-200 px-2 py-2 text-left">{n.title}</td>
            <td className="border border-gray-200 px-2 py-2 text-center">{n.created_at?.slice(0,10)}</td>
            <td className="border border-gray-200 px-2 py-2 text-center">
              <div className="flex gap-1 justify-center">
                <button onClick={()=>startEdit(n)} className="text-blue-600 border border-blue-600 px-2 py-0.5 rounded text-xs">수정</button>
                <button onClick={()=>remove(n.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button>
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ===== 사용자관리 =====
function UsersTab() {
  const [users, setUsers] = useState<Array<{id:string;user_id:string;name:string;role:string;hub_enabled?:boolean;created_at:string}>>([]);
  const [form, setForm] = useState({name:"",user_id:"",password:"",role:"user"});
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<{id:string;user_id:string;name:string;role:string}|null>(null);
  const [editForm, setEditForm] = useState({name:"",password:"",role:"user"});
  const [showEditModal, setShowEditModal] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/users"); if(r.ok) setUsers(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  async function create(e:React.FormEvent) { e.preventDefault(); await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); setShowModal(false); setForm({name:"",user_id:"",password:"",role:"user"}); load(); }
  async function remove(id:string) {
    if(!confirm("정말 삭제할까요?\n이 사용자가 등록한 작업·작업전달은 남고 작성자만 비워집니다.")) return;
    const res = await fetch(`/api/users/${id}`,{method:"DELETE"});
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert("삭제 실패: " + (d.error || res.status)); }
    load();
  }
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
    // 사용자 → 관리자 → 수퍼관리자 → 사용자 순환
    const nextMap: Record<string,string> = { user: "admin", admin: "super_admin", super_admin: "user" };
    const newRole = nextMap[currentRole] || "user";
    const res = await fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: newRole }) });
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); alert(d.error || "권한 변경 실패"); }
  }
  async function toggleHub(id:string, current:boolean) {
    const res = await fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hub_enabled: !current }) });
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); alert(d.error || "업무관리 권한 변경 실패"); }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">사용자 관리</h3>
      <table className="w-full border-collapse text-xs border border-gray-300">
        <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-2 py-2.5 w-12">순번</th><th className="border border-[#2d3a47] px-2 py-2.5 w-32">사용자ID</th><th className="border border-[#2d3a47] px-2 py-2.5 w-28">이름</th><th className="border border-[#2d3a47] px-2 py-2.5 w-20">권한</th><th className="border border-[#2d3a47] px-2 py-2.5 w-24">업무관리</th><th className="border border-[#2d3a47] px-2 py-2.5 w-28">등록일</th><th className="border border-[#2d3a47] px-2 py-2.5 w-20">관리</th></tr></thead>
        <tbody>{users.map((u,i) => (
          <tr key={u.id} className={i%2===1?"bg-gray-50":""}>
            <td className="border border-gray-200 px-2 py-2 text-center">{i+1}</td>
            <td className="border border-gray-200 px-2 py-2 text-center font-bold">{u.user_id}</td>
            <td className="border border-gray-200 px-2 py-2 text-center">{u.name}</td>
            <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={() => toggleRole(u.id, u.role)} className={`px-2 py-0.5 rounded-full text-xs cursor-pointer hover:opacity-80 ${u.role==="super_admin"?"bg-rose-100 text-rose-800":u.role==="admin"?"bg-amber-100 text-amber-800":"bg-blue-100 text-blue-800"}`}>{u.role==="super_admin"?"수퍼관리자":u.role==="admin"?"관리자":"사용자"}</button></td>
            <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={() => toggleHub(u.id, !!u.hub_enabled)} title="개인 일정·갤러리·개인메모 사용 권한" className={`px-2 py-0.5 rounded-full text-xs cursor-pointer hover:opacity-80 border ${u.hub_enabled?"bg-[#FEE500] text-[#191919] border-[#FEE500] font-bold":"bg-gray-100 text-gray-500 border-gray-300"}`}>{u.hub_enabled?"사용":"미사용"}</button></td>
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
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">권한</label><select value={editForm.role} onChange={e=>setEditForm(p=>({...p,role:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"><option value="user">사용자</option><option value="admin">관리자</option><option value="super_admin">수퍼관리자</option></select></div>
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
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">권한</label><select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"><option value="user">사용자</option><option value="admin">관리자</option><option value="super_admin">수퍼관리자</option></select></div>
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
  const [items, setItems] = useState<Array<{id:string;name:string;is_default?:boolean}>>([]);
  const [name, setName] = useState("");
  const load = useCallback(async () => { const r = await fetch(`/api/categories?_=${Date.now()}`); if(r.ok) setItems(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  async function create() { if(!name) return; await fetch("/api/categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})}); setName(""); load(); }
  async function remove(id:string) {
    if(!confirm("정말 삭제할까요?")) return;
    const res = await fetch(`/api/categories/${id}`,{method:"DELETE"});
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); alert("삭제 실패: " + (d.error || res.status)); }
  }
  async function setDefault(id: string) {
    // 낙관적 업데이트
    setItems(prev => prev.map(c => ({ ...c, is_default: c.id === id })));
    await fetch("/api/categories/default", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">카테고리 관리</h3>
      <p className="text-xs text-gray-500 mb-3">라디오 버튼을 선택하여 기본 카테고리를 지정할 수 있습니다.</p>
      <table className="w-full border-collapse text-xs border border-gray-300 max-w-md">
        <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-2 py-2.5 w-14">기본값</th><th className="border border-[#2d3a47] px-2 py-2.5 w-10">순번</th><th className="border border-[#2d3a47] px-2 py-2.5">카테고리명</th><th className="border border-[#2d3a47] px-2 py-2.5 w-20">관리</th></tr></thead>
        <tbody>{items.map((c,i) => (
          <tr key={c.id} className={i%2===1?"bg-gray-50":""}>
            <td className="border border-gray-200 px-2 py-2 text-center">
              <input type="radio" name="defaultCategory" checked={!!c.is_default} onChange={() => setDefault(c.id)} style={{width:"16px",height:"16px",accentColor:"#2563eb",cursor:"pointer"}} />
            </td>
            <td className="border border-gray-200 px-2 py-2 text-center">{i+1}</td>
            <td className="border border-gray-200 px-2 py-2 text-center">
              {c.name}
              {c.is_default && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">DEFAULT</span>}
            </td>
            <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={()=>remove(c.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button></td>
          </tr>
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
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const PAGE_SIZE = 20;
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
    // 수정 폼으로 스크롤
    setTimeout(() => {
      document.getElementById(`${endpoint}-form`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function cancelEdit() { setEditId(null); setForm({}); }

  async function remove(id:string) { if(!confirm("정말 삭제할까요?")) return; await fetch(`/api/${endpoint}/${id}`,{method:"DELETE"}); load(); }

  // 검색 필터링
  const filtered = keyword ? items.filter(item => fields.some(f => (item[f.k] || "").toLowerCase().includes(keyword.toLowerCase()))) : items;
  // 페이징
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-bold text-gray-800 mb-2 pb-2 border-b-2 border-gray-200">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mb-4">{subtitle}</p>}
      <div className="mb-3 flex justify-between items-center gap-2">
        <input type="text" placeholder="검색어 입력" value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} className="px-3 py-1.5 border border-gray-300 rounded text-sm w-64" />
        <span className="text-xs text-gray-500">총 {filtered.length}건</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs border border-gray-300">
          <thead><tr className="bg-[#3b4b5b] text-white"><th className="border border-[#2d3a47] px-1.5 py-2.5 w-10">순번</th>{fields.map(f=><th key={f.k} className="border border-[#2d3a47] px-1.5 py-2.5">{f.l}</th>)}<th className="border border-[#2d3a47] px-1.5 py-2.5 w-[100px]">관리</th></tr></thead>
          <tbody>{pageItems.map((item,i) => (
            <tr key={item.id} className={editId === item.id ? "bg-yellow-50" : (i%2===1?"bg-gray-50":"")}>
              <td className="border border-gray-200 px-1.5 py-[7px] text-center">{(page - 1) * PAGE_SIZE + i + 1}</td>
              {fields.map(f=><td key={f.k} className="border border-gray-200 px-1.5 py-[7px] text-left">{item[f.k]}</td>)}
              <td className="border border-gray-200 px-1.5 py-[7px] text-center whitespace-nowrap">
                <button onClick={()=>startEdit(item)} className="text-blue-600 border border-blue-600 px-2 py-0.5 rounded text-xs mr-1">수정</button>
                <button onClick={()=>remove(item.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button>
              </td>
            </tr>
          ))}
          {pageItems.length === 0 && <tr><td colSpan={fields.length + 2} className="text-center py-6 text-gray-400">등록된 항목이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-3">
          <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">≪</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">&lt;</button>
          {Array.from({length: totalPages}, (_, i) => i + 1).filter(n => Math.abs(n - page) <= 2 || n === 1 || n === totalPages).map((n, idx, arr) => (
            <React.Fragment key={n}>
              {idx > 0 && arr[idx - 1] !== n - 1 && <span className="text-xs text-gray-400">...</span>}
              <button onClick={() => setPage(n)} className={`px-2.5 py-1 text-xs rounded ${n === page ? "bg-blue-600 text-white" : "border border-gray-300"}`}>{n}</button>
            </React.Fragment>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">&gt;</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30">≫</button>
        </div>
      )}
      {/* 등록 폼 */}
      <div id={`${endpoint}-form`} className={`border rounded-md p-4 mt-4 ${editId ? "bg-yellow-50 border-yellow-400" : "bg-gray-50 border-gray-200"}`}>
        {editId && <p className="text-xs text-yellow-700 font-bold mb-2">✏️ 수정 중입니다</p>}
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
        <div className="mt-3 flex gap-2">
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
  function assignColIds(columns: Array<{name:string;type:string}>): Array<{name:string;type:string;_id:string}> {
    return columns.map((c, i) => ({...c, _id: (c as Record<string,string>)._id || `col_${i}_${Math.random().toString(36).slice(2)}`}));
  }
  const [cols, setCols] = useState<Array<{name:string;type:string;_id:string}>>(() => assignColIds([{name:"순번",type:"auto"}]));
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
    setCols(assignColIds(t.columns?.length ? t.columns : [{name:"순번",type:"auto"}]));
    setFormulas(t.formulas?.length ? t.formulas : []);
  }
  async function saveTemplate() {
    if (!editTmpl) return;
    if (!editTmpl.name.trim()) { alert("양식 이름을 입력해주세요."); return; }
    const saveCols = cols.map(({_id, ...rest}) => rest);
    await fetch(`/api/templates/${editTmpl.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editTmpl.name, columns: saveCols, formulas }) });
    setEditTmpl(null); load(); alert("양식이 저장되었습니다.");
  }
  function addCol() { setCols(p => [...p, {name:"",type:"텍스트",_id:`col_${Date.now()}_${Math.random()}`}]); }
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
          <div key={t.id} className="flex justify-between items-center p-3 border border-gray-200 rounded mb-2 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                <input type="radio" name="defaultTmpl" checked={!!t.is_default} onChange={() => setDefault(t.id)} style={{width:"16px",height:"16px",accentColor:"#2563eb",cursor:"pointer"}} />
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
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-bold text-gray-800 shrink-0">양식 편집:</h4>
            <input type="text" value={editTmpl.name} onChange={e => setEditTmpl(prev => prev ? {...prev, name: e.target.value} : prev)} className="flex-1 max-w-xs px-2 py-1 border border-gray-300 rounded text-sm text-blue-600 font-bold" placeholder="양식 이름" />
          </div>

          {/* 1. 컬럼 설정 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">1. 컬럼 설정</p>
            <div className="flex flex-col gap-1">
              {cols.map((c, i) => (
                <div key={c._id} onDragOver={e => handleDragOver(e, i)} onDrop={e => e.preventDefault()} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${dragIdx === i ? "opacity-50 border-blue-400 bg-blue-50" : ""} ${c.type === "자동계산" ? "bg-amber-50 border-amber-300" : c.type === "auto" ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200"}`}>
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
            <div className="mb-3 p-3 border-2 border-red-500 bg-red-50 rounded">
              <p className="text-sm font-bold text-red-700 mb-1">⚠️ 경고</p>
              <p className="text-sm text-red-700 leading-relaxed">
                컬럼 명은 <span className="font-bold">사용 초기에 수정하는 것은 문제가 없으나</span> Bcount 사용 중에 변경하는 것은 <span className="font-bold underline">심각한 데이터 오류</span>를 발생시킬 수 있습니다.
              </p>
              <p className="text-sm text-red-700 mt-2 leading-relaxed">
                사용 초기 칼럼 세팅할 때 이외에는 <span className="font-bold">컬럼명을 수정하지 마시기 바랍니다.</span>
                Bcount 사용 중에 컬럼명을 수정하면 기존 데이터와 충돌로 <span className="font-bold underline">돌이킬 수 없는 문제</span>가 발생할 수 있습니다.
              </p>
            </div>
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
  const dropboxFields = [["dropbox_app_key","App Key"],["dropbox_app_secret","App Secret"],["dropbox_access_token","Access Token"],["dropbox_path","저장 경로"]];

  async function uploadDoc(kind: "bankbook" | "biz_reg", slot: number, file: File) {
    if (file.size > 20 * 1024 * 1024) { alert("파일은 20MB 이하만 가능합니다."); return; }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    fd.append("slot", String(slot));
    const res = await fetch("/api/company/upload-doc", { method: "POST", body: fd });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert("업로드 실패: " + (d.error || res.status)); return; }
    const d = await res.json();
    set(`${kind}_url_${slot}`, d.url);
  }

  async function deleteDoc(kind: "bankbook" | "biz_reg", slot: number) {
    if (!confirm("파일을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/company/upload-doc?kind=${kind}&slot=${slot}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert("삭제 실패: " + (d.error || res.status)); return; }
    set(`${kind}_url_${slot}`, "");
  }

  function DocSlot({ kind, slot, title }: { kind: "bankbook" | "biz_reg"; slot: number; title: string }) {
    const urlKey = `${kind}_url_${slot}`;
    const labelKey = `${kind}_label_${slot}`;
    const url = company[urlKey] || "";
    return (
      <div className="flex items-center gap-2 flex-wrap p-2 border border-gray-200 rounded">
        <span className="text-xs font-semibold text-gray-600 shrink-0 w-16">{title}{slot}</span>
        <input type="text" placeholder="라벨 (예: 일반과세, 신한은행)" value={company[labelKey]||""} onChange={e=>set(labelKey, e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-48" />
        {url ? (
          <>
            <a href={url} target="_blank" rel="noopener" className="px-2 py-1 text-xs text-green-700 bg-green-50 border border-green-500 rounded hover:bg-green-100">파일 보기 ✓</a>
            <button type="button" onClick={() => deleteDoc(kind, slot)} className="px-2 py-1 text-xs text-red-500 border border-red-300 rounded hover:bg-red-50">삭제</button>
          </>
        ) : (
          <label className="px-2 py-1 text-xs text-gray-600 bg-gray-50 border border-dashed border-gray-400 rounded cursor-pointer hover:bg-gray-100">
            ＋ 파일 첨부
            <input type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(kind, slot, f); }} />
          </label>
        )}
        {!url && <span className="text-[10px] text-gray-400">PNG · JPG · PDF · 최대 20MB</span>}
      </div>
    );
  }

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
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">입금 계좌 정보 (최대 3개)</h3>
        <p className="text-xs text-gray-400 mb-3">거래명세서/견적서 하단에 표시됩니다. 기본값으로 설정한 계좌가 기본 표시되며, 발송/인쇄 시 다른 계좌를 선택할 수 있습니다.</p>
        <div className="space-y-3">
          {[1, 2, 3].map(idx => {
            const suffix = idx === 1 ? "" : `_${idx}`;
            return (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1 text-xs font-semibold text-gray-600 shrink-0 w-16">
                  <input type="radio" name="default_bank" checked={(company.default_bank || "1") === String(idx)} onChange={() => set("default_bank", String(idx))} style={{width:"14px",height:"14px"}} />
                  계좌{idx}
                </label>
                <input type="text" placeholder="은행명" value={company[`bank_name${suffix}`]||""} onChange={e=>set(`bank_name${suffix}`, e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-32" />
                <input type="text" placeholder="계좌번호" value={company[`bank_account${suffix}`]||""} onChange={e=>set(`bank_account${suffix}`, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[180px]" />
                <input type="text" placeholder="예금주" value={company[`bank_holder${suffix}`]||""} onChange={e=>set(`bank_holder${suffix}`, e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-32" />
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">이메일 발송 설정 (최대 3개)</h3>
        <p className="text-xs text-gray-400 mb-3">거래명세서/견적서 발송 시 이 목록에서 계정을 선택합니다. 라디오로 선택한 계정이 기본값입니다.</p>
        <div className="space-y-3">
          {[1, 2, 3].map(idx => {
            const suffix = idx === 1 ? "" : `_${idx}`;
            return (
              <div key={idx} className="p-3 border border-gray-200 rounded space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1 text-xs font-semibold text-gray-600 shrink-0 w-16">
                    <input type="radio" name="default_mail" checked={String(company.default_mail || "1") === String(idx)} onChange={() => set("default_mail", String(idx))} style={{width:"14px",height:"14px"}} />
                    계정{idx}
                  </label>
                  <select value={company[`mail_service${suffix}`]||"naver"} onChange={e=>set(`mail_service${suffix}`,e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs w-24">
                    <option value="naver">네이버</option><option value="daum">다음</option>
                  </select>
                  <input type="text" placeholder="발신 이메일" value={company[`mail_email${suffix}`]||""} onChange={e=>set(`mail_email${suffix}`, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[180px]" />
                  <input type="text" placeholder="아이디" value={company[`mail_id${suffix}`]||""} onChange={e=>set(`mail_id${suffix}`, e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-32" />
                  <input type="password" placeholder="비밀번호" value={company[`mail_password${suffix}`]||""} onChange={e=>set(`mail_password${suffix}`, e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-32" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">통장사본 (최대 3개)</h3>
        <p className="text-xs text-gray-400 mb-3">이메일 발송 시 첨부할 통장사본. 라벨을 붙여 관리하며, 발송 화면에서 선택할 수 있습니다.</p>
        <div className="space-y-2">
          {[1, 2, 3].map(idx => <DocSlot key={idx} kind="bankbook" slot={idx} title="통장" />)}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">사업자등록증 (최대 3개)</h3>
        <p className="text-xs text-gray-400 mb-3">이메일 발송 시 첨부할 사업자등록증. 라벨(일반과세/간이과세/법인 등)로 구분합니다.</p>
        <div className="space-y-2">
          {[1, 2, 3].map(idx => <DocSlot key={idx} kind="biz_reg" slot={idx} title="등록증" />)}
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

// ===== 쇼핑몰 연동 =====
interface ShopIntegration { id: string; api_key_hint: string | null; shop_url: string | null; template_name: string | null; last_received_at: string | null }
interface ShopEvent { created_at: string; external_order_id: string | null; kind: string; result: string | null }

function ShopTab() {
  const [integ, setInteg] = useState<ShopIntegration | null>(null);
  const [events, setEvents] = useState<ShopEvent[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [templates, setTemplates] = useState<string[]>([]);
  const [form, setForm] = useState({ shop_url: "", template_name: "" });
  const [newKey, setNewKey] = useState<string | null>(null);   // 발급 직후 한 번만 보여준다
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const d = await fetch(`/api/company/shop-integration?_=${Date.now()}`).then(r => r.json());
    setInteg(d.integration);
    setEvents(d.events || []);
    setTodayCount(d.todayCount || 0);
    setTemplates(d.templates || []);
    setForm({ shop_url: d.integration?.shop_url || "", template_name: d.integration?.template_name || "" });
  }, []);
  useEffect(() => { load(); setOrigin(window.location.origin); }, [load]);

  async function issueKey() {
    const msg = integ ? "재발급하면 기존 키는 즉시 무효가 됩니다. 쇼핑몰 쪽 설정도 바꿔야 합니다. 계속할까요?" : "쇼핑몰이 Bcount로 주문을 보낼 때 쓸 API 키를 발급합니다.";
    if (!confirm(msg)) return;
    setBusy(true);
    const res = await fetch("/api/company/shop-integration", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { alert("발급 실패: " + (d.error || res.status)); return; }
    setNewKey(d.api_key);
    load();
  }

  async function save() {
    setBusy(true);
    const res = await fetch("/api/company/shop-integration", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { alert("저장되었습니다."); load(); } else alert("저장 실패: " + (d.error || res.status));
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => alert("복사되었습니다.")).catch(() => prompt("복사해서 쓰세요:", text));
  }

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }).replace(/\. /g, ".").replace(/\.$/, "") : "-";
  const kindLabel: Record<string, string> = { order: "주문 접수", paid: "입금 확인", duplicate: "중복(무시)", error: "오류" };
  const endpoint = `${origin}/api/shop/orders`;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded p-4 md:p-6 border border-gray-200">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">쇼핑몰 연동</h3>
        <p className="text-xs text-gray-500 mb-4">쇼핑몰이 주문을 보내면 작업리스트에 새 작업으로 자동 등록됩니다(단방향). 배송지는 송장변환의 &quot;쇼핑몰 주문 불러오기&quot;에서 씁니다.</p>

        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-y-3 gap-x-4 items-center text-sm">
          <span className="text-xs font-bold text-gray-600">API 키</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="px-2 py-1.5 bg-gray-100 border border-gray-300 rounded text-sm">{integ?.api_key_hint ? `${integ.api_key_hint}••••••••••••••••••••••••••••` : "아직 발급 안 됨"}</code>
            <button onClick={issueKey} disabled={busy} className={`px-3 py-1.5 rounded text-xs font-medium border ${integ ? "border-red-300 text-red-600 hover:bg-red-50" : "bg-blue-600 border-blue-600 text-white"} disabled:opacity-50`}>{integ ? "재발급" : "키 발급"}</button>
          </div>

          {newKey && (
            <>
              <span className="text-xs font-bold text-red-600">새 키</span>
              <div className="bg-amber-50 border border-amber-300 rounded p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-sm break-all">{newKey}</code>
                  <button onClick={() => copy(newKey)} className="px-3 py-1 border border-gray-300 rounded text-xs bg-white">복사</button>
                </div>
                <p className="text-xs text-amber-700 mt-2">이 키는 지금만 보입니다. 쇼핑몰(Replit) 환경변수 <code>BCOUNT_API_KEY</code>에 넣어주세요. 창을 닫으면 다시 볼 수 없고, 잃어버리면 재발급해야 합니다.</p>
              </div>
            </>
          )}

          <span className="text-xs font-bold text-gray-600">상태</span>
          <div>
            {integ?.last_received_at
              ? <span><span className="text-emerald-600 font-bold">● 수신 중</span> <span className="text-xs text-gray-500">마지막 수신 {fmt(integ.last_received_at)} · 오늘 주문 {todayCount}건</span></span>
              : <span className="text-gray-400">{integ ? "아직 받은 주문 없음" : "키를 발급하면 연동이 시작됩니다"}</span>}
          </div>

          <span className="text-xs font-bold text-gray-600">받는 주소</span>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <code className="px-2 py-1 bg-gray-100 rounded">POST {endpoint}</code>
            <code className="px-2 py-1 bg-gray-100 rounded">PATCH {endpoint}/&lt;쇼핑몰주문번호&gt;</code>
            <button onClick={() => copy(endpoint)} className="px-2 py-1 border border-gray-300 rounded bg-white">복사</button>
          </div>

          <span className="text-xs font-bold text-gray-600">쇼핑몰 주소</span>
          <input value={form.shop_url} onChange={e => setForm(p => ({ ...p, shop_url: e.target.value }))} placeholder="https://www.blackcopy.co.kr" className="px-2 py-1.5 border border-gray-300 rounded text-sm w-full md:max-w-md" />

          <span className="text-xs font-bold text-gray-600">등록 카테고리</span>
          <span><b>블랙카피</b> <span className="text-xs text-gray-500">— 쇼핑몰 주문은 항상 이 카테고리로 들어갑니다 (없으면 자동 생성)</span></span>

          <span className="text-xs font-bold text-gray-600">품목 표양식</span>
          <select value={form.template_name} onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-full md:max-w-xs">
            <option value="">자동 (&quot;단가계산없이…&quot; 양식, 없으면 기본 양식)</option>
            {templates.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>· 쇼핑몰 주문은 거래처 빈칸, 제목 <code>[몰] 쇼핑몰주문번호</code>로 들어옵니다. 리스트에서 열어 제목·거래처를 직접 고치세요.</p>
          <p>· 주문 내용 전체(품목·사양·금액·결제·배송·파일·요청사항)는 세부사양 칸에 들어갑니다.</p>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={save} disabled={busy || !integ} className="px-8 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">설정 저장</button>
        </div>
      </div>

      <div className="bg-white rounded p-4 md:p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-gray-200">
          <h3 className="text-base font-bold text-gray-800">최근 수신</h3>
          <button onClick={load} className="px-3 py-1 border border-gray-300 rounded text-xs">새로고침</button>
        </div>
        {events.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">아직 받은 것이 없습니다.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-gray-100 text-gray-700">
                <th className="border border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">시각</th>
                <th className="border border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">쇼핑몰 주문번호</th>
                <th className="border border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">종류</th>
                <th className="border border-gray-200 px-2 py-1.5 text-left">결과</th>
              </tr></thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} className={e.kind === "error" ? "bg-red-50" : ""}>
                    <td className="border border-gray-200 px-2 py-1.5 whitespace-nowrap">{fmt(e.created_at)}</td>
                    <td className="border border-gray-200 px-2 py-1.5 whitespace-nowrap">{e.external_order_id || "-"}</td>
                    <td className="border border-gray-200 px-2 py-1.5 whitespace-nowrap">{kindLabel[e.kind] || e.kind}</td>
                    <td className={`border border-gray-200 px-2 py-1.5 ${e.kind === "error" ? "text-red-600" : ""}`}>{e.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 프로그램 배포 (B-imposition exe) =====
interface Release { key: string; file_name: string; version: string; size_bytes: number; note: string; uploaded_by: string; updated_at: string }
function ProgramTab() {
  const [rows, setRows] = useState<Release[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/program-releases?_=${Date.now()}`).then(r => r.json());
    setRows(d.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload() {
    if (!file) { alert("배포 파일(zip)을 고르세요."); return; }
    if (!confirm(`${file.name} (${(file.size / 1048576).toFixed(1)} MB)를 올릴까요? 직원들이 "B-imposition" 화면에서 바로 이 파일을 내려받게 됩니다.`)) return;
    const fd = new FormData();
    fd.append("file", file); fd.append("key", "imposition"); fd.append("version", version); fd.append("note", note);
    setBusy(true);
    const res = await fetch("/api/program-releases", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { alert("올리기 실패: " + (d.error || res.status)); return; }
    alert("올렸습니다."); setFile(null); setVersion(""); setNote(""); load();
  }

  const fmt = (iso: string) => iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }) : "-";
  const cur = rows.find(r => r.key === "imposition");

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-bold mb-1">프로그램 배포</h2>
      <p className="text-sm text-gray-500 mb-5">B-imposition(윈도우 프로그램) 배포 파일(zip)을 올려 두면, 로그인한 직원이 &quot;B-imposition&quot; 화면의 다운로드 버튼으로 받습니다. 받은 zip 은 압축을 풀고 폴더 안의 BcountImposition.exe 를 실행합니다.</p>

      <div className="border border-gray-200 rounded p-4 mb-6 text-sm">
        <div className="font-bold mb-2">지금 배포 중인 파일</div>
        {cur ? (
          <div className="grid grid-cols-[110px_1fr] gap-y-1">
            <span className="text-gray-500">파일</span><span>{cur.file_name} <span className="text-gray-400">({(cur.size_bytes / 1048576).toFixed(1)} MB)</span></span>
            <span className="text-gray-500">버전</span><span>{cur.version || "-"}</span>
            <span className="text-gray-500">올린 사람</span><span>{cur.uploaded_by || "-"}</span>
            <span className="text-gray-500">올린 때</span><span>{fmt(cur.updated_at)}</span>
            {cur.note && <><span className="text-gray-500">메모</span><span className="whitespace-pre-wrap">{cur.note}</span></>}
            <span className="text-gray-500">받기</span><span><a href="/api/program-releases/imposition/download" className="text-blue-600 hover:underline">지금 파일 내려받기</a></span>
          </div>
        ) : (
          <p className="text-gray-500">아직 올린 파일이 없습니다. 이 경우 저장소에 들어 있는 배포본이 내려갑니다.</p>
        )}
      </div>

      <div className="border border-gray-200 rounded p-4 text-sm">
        <div className="font-bold mb-3">새 버전 올리기</div>
        <div className="flex flex-col gap-3 max-w-xl">
          <label className="flex items-center gap-3"><span className="w-20 text-gray-600">파일</span><input type="file" accept=".exe,.zip,.msi" onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm" /></label>
          <label className="flex items-center gap-3"><span className="w-20 text-gray-600">버전</span><input value={version} onChange={e => setVersion(e.target.value)} placeholder="예: 1.0.1" className="px-3 py-1.5 border border-gray-300 rounded w-40" /></label>
          <label className="flex items-start gap-3"><span className="w-20 text-gray-600 pt-1.5">메모</span><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="바뀐 점 (선택)" rows={2} className="px-3 py-1.5 border border-gray-300 rounded flex-1" /></label>
          <div><button onClick={upload} disabled={busy || !file} className="px-5 py-2 bg-blue-600 text-white rounded font-medium disabled:opacity-50">{busy ? "올리는 중…" : "올리기"}</button></div>
        </div>
      </div>
    </div>
  );
}
