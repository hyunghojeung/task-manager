"use client";

import { useState, useEffect, useCallback } from "react";

type Tab = "dashboard" | "companies" | "ads" | "settings";

interface CompanyData {
  id: string;
  company_id: string;
  company_code: string;
  company_name: string;
  business_number: string;
  representative: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  business_type: string;
  business_category: string;
  password: string;
  status: string;
  user_count: number;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_code: "", company_id: "", company_name: "", business_number: "",
    representative: "", phone: "", fax: "", email: "", address: "",
    business_type: "", business_category: "", password: "@admin1234",
    adminName: "", adminUserId: "", adminPassword: "@admin1234",
  });

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/companies?_=${Date.now()}`)
      .then(res => res.json())
      .then(data => { if (!cancelled) { setCompanies(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  function refreshList() {
    setRefreshKey(k => k + 1);
  }

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        setForm({ company_code: "", company_id: "", company_name: "", business_number: "", representative: "", phone: "", fax: "", email: "", address: "", business_type: "", business_category: "", password: "@admin1234", adminName: "", adminUserId: "", adminPassword: "@admin1234" });
        alert("업체가 등록되었습니다.");
        setTimeout(() => refreshList(), 500);
      } else {
        setErrorMsg(data.error || "등록에 실패했습니다.");
      }
    } catch (err) {
      setErrorMsg("서버 연결에 실패했습니다: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    await fetch(`/api/admin/companies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    refreshList();
  }

  function openEdit(c: CompanyData) {
    setEditId(c.id);
    setForm({
      company_code: c.company_code || "", company_id: c.company_id || "",
      company_name: c.company_name || "", business_number: c.business_number || "",
      representative: c.representative || "", phone: c.phone || "",
      fax: c.fax || "", email: c.email || "", address: c.address || "",
      business_type: c.business_type || "", business_category: c.business_category || "",
      password: c.password || "", adminName: "", adminUserId: "", adminPassword: "",
    });
    setShowModal(true);
  }

  function openCreate() {
    setEditId(null);
    setForm({ company_code: "", company_id: "", company_name: "", business_number: "", representative: "", phone: "", fax: "", email: "", address: "", business_type: "", business_category: "", password: "@admin1234", adminName: "", adminUserId: "", adminPassword: "@admin1234" });
    setShowModal(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/companies/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: form.company_id, company_name: form.company_name,
          business_number: form.business_number, representative: form.representative,
          phone: form.phone, fax: form.fax, email: form.email, address: form.address,
          business_type: form.business_type, business_category: form.business_category,
          password: form.password,
        }),
      });
      if (res.ok) { setShowModal(false); alert("수정되었습니다."); setTimeout(() => refreshList(), 500); }
      else { const d = await res.json(); setErrorMsg(d.error || "수정 실패"); }
    } catch (err) { setErrorMsg("서버 오류: " + (err instanceof Error ? err.message : "")); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요? 업체의 모든 데이터가 삭제됩니다.")) return;
    await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
    refreshList();
  }

  const activeCount = companies.filter(c => c.status === "active").length;
  const inactiveCount = companies.filter(c => c.status !== "active").length;
  const totalUsers = companies.reduce((sum, c) => sum + (c.user_count || 0), 0);

  const statusBadge = (s: string) => {
    if (s === "active") return <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">활성</span>;
    if (s === "inactive") return <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">비활성</span>;
    return <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">대기</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg font-bold">Platform Admin - <a href="https://blackcopy.kr" className="text-blue-400 no-underline">Blackcopy.kr</a></h1>
        <div className="flex items-center gap-3 text-sm">
          <span>최고관리자</span>
          <a href="/super-admin" className="text-slate-400 hover:text-white">로그아웃</a>
        </div>
      </div>

      <div className="bg-slate-800 px-6 flex gap-0">
        {(["dashboard", "companies", "ads", "settings"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-semibold border-b-[3px] transition ${tab === t ? "text-blue-400 border-blue-400" : "text-slate-400 border-transparent hover:text-gray-200"}`}>
            {t === "dashboard" ? "대시보드" : t === "companies" ? "업체관리" : t === "ads" ? "광고관리" : "시스템설정"}
          </button>
        ))}
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {tab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "등록 업체", value: companies.length, color: "text-gray-800" },
                { label: "활성 업체", value: activeCount, color: "text-emerald-600" },
                { label: "비활성 업체", value: inactiveCount, color: "text-red-600" },
                { label: "전체 사용자", value: totalUsers, color: "text-blue-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg shadow p-5 text-center">
                  <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">업체 목록</h3>
              {loading ? <p className="text-sm text-gray-400">로딩중...</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs border border-gray-300">
                    <thead><tr className="bg-slate-900 text-white">
                      <th className="border border-slate-700 px-2 py-2.5">순번</th><th className="border border-slate-700 px-2 py-2.5">업체ID</th><th className="border border-slate-700 px-2 py-2.5">업체명</th><th className="border border-slate-700 px-2 py-2.5">대표자</th><th className="border border-slate-700 px-2 py-2.5">연락처</th><th className="border border-slate-700 px-2 py-2.5">등록일</th><th className="border border-slate-700 px-2 py-2.5">상태</th><th className="border border-slate-700 px-2 py-2.5">사용자</th><th className="border border-slate-700 px-2 py-2.5">관리</th>
                    </tr></thead>
                    <tbody>
                      {companies.map((c, i) => (
                        <tr key={c.id} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                          <td className="border border-gray-200 px-2 py-2 text-center">{i + 1}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center font-bold">{c.company_id}</td>
                          <td className="border border-gray-200 px-2 py-2 text-left">{c.company_name}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center">{c.representative}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center">{c.phone}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center">{c.created_at?.slice(0, 10)}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center">{statusBadge(c.status)}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center">{c.user_count}명</td>
                          <td className="border border-gray-200 px-2 py-2 text-center whitespace-nowrap">
                            <button onClick={()=>openEdit(c)} className="text-blue-600 border border-blue-600 px-2 py-0.5 rounded text-xs mr-1">수정</button>
                            <button onClick={()=>handleStatusChange(c.id, c.status==="active"?"inactive":"active")} className={`px-2 py-0.5 rounded text-xs mr-1 border ${c.status==="active"?"text-red-600 border-red-600":"text-emerald-600 border-emerald-600"}`}>{c.status==="active"?"정지":"활성"}</button>
                            <button onClick={()=>handleDelete(c.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "companies" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-800">업체 목록</h3>
              <button onClick={openCreate} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ 업체 등록</button>
            </div>
            {loading ? <p className="text-sm text-gray-400">로딩중...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs border border-gray-300">
                  <thead><tr className="bg-slate-900 text-white">
                    <th className="border border-slate-700 px-2 py-2.5">순번</th><th className="border border-slate-700 px-2 py-2.5">업체ID</th><th className="border border-slate-700 px-2 py-2.5">업체코드</th><th className="border border-slate-700 px-2 py-2.5">업체명</th><th className="border border-slate-700 px-2 py-2.5">사업자번호</th><th className="border border-slate-700 px-2 py-2.5">대표자</th><th className="border border-slate-700 px-2 py-2.5">등록일</th><th className="border border-slate-700 px-2 py-2.5">상태</th><th className="border border-slate-700 px-2 py-2.5">사용자</th><th className="border border-slate-700 px-2 py-2.5">관리</th>
                  </tr></thead>
                  <tbody>
                    {companies.map((c, i) => (
                      <tr key={c.id} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                        <td className="border border-gray-200 px-2 py-2 text-center">{i + 1}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center font-bold">{c.company_id}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">{c.company_code}</td>
                        <td className="border border-gray-200 px-2 py-2 text-left">{c.company_name}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">{c.business_number}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">{c.representative}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">{c.created_at?.slice(0, 10)}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">{statusBadge(c.status)}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">{c.user_count}명</td>
                        <td className="border border-gray-200 px-2 py-2 text-center whitespace-nowrap">
                          <button onClick={()=>openEdit(c)} className="text-blue-600 border border-blue-600 px-2 py-0.5 rounded text-xs mr-1">수정</button>
                          <button onClick={()=>handleStatusChange(c.id, c.status==="active"?"inactive":"active")} className={`px-2 py-0.5 rounded text-xs mr-1 border ${c.status==="active"?"text-red-600 border-red-600":"text-emerald-600 border-emerald-600"}`}>{c.status==="active"?"정지":"활성"}</button>
                          <button onClick={()=>handleDelete(c.id)} className="text-red-600 border border-red-600 px-2 py-0.5 rounded text-xs">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "ads" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">배너 광고 관리</h3>
            <div className="bg-gradient-to-r from-slate-800 via-blue-600 to-sky-500 px-6 py-2.5 rounded-md flex justify-between items-center mb-6">
              <span className="text-white text-sm font-bold">인쇄/출력 작업기록, 견적서, 거래명세서, 발주서까지 올인원 업무관리</span>
              <span className="bg-amber-400 text-slate-900 px-3 py-0.5 rounded-full text-xs font-bold">FREE</span>
            </div>
            <p className="text-xs text-gray-500">광고 관리 기능은 추후 업데이트 예정입니다.</p>
          </div>
        )}

        {tab === "settings" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">시스템 설정</h3>
            <div className="grid grid-cols-1 gap-3 text-sm max-w-lg">
              <div className="flex items-center gap-3"><label className="w-32 text-xs font-semibold text-gray-600">시스템명</label><input type="text" defaultValue="Blackcopy.kr" className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" /></div>
              <div className="flex items-center gap-3"><label className="w-32 text-xs font-semibold text-gray-600">관리자 ID</label><input type="text" defaultValue="blackcopy2" className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" /></div>
            </div>
            <button className="mt-4 px-5 py-2 bg-blue-600 text-white rounded text-sm">설정 저장</button>
          </div>
        )}
      </div>

      {/* 업체 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
            <h4 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">{editId ? "업체 수정" : "업체 등록"}</h4>
            <form onSubmit={editId ? handleUpdate : handleCreateCompany}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["업체ID", "company_id", "영문 소문자 (로그인용)"],
                  ["업체명", "company_name", "업체명"],
                  ["사업자번호", "business_number", "000-00-00000"],
                  ["대표자", "representative", "대표자명"],
                  ["연락처", "phone", "02-0000-0000"],
                  ["이메일", "email", "email@example.com"],
                  ["비밀번호", "password", "업체 관리자 비밀번호"],
                ].map(([label, key, placeholder]) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <input type={key === "password" ? "password" : "text"} placeholder={placeholder}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      required={["company_id", "company_code", "company_name", "password"].includes(key)} />
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-800 mb-2">관리자 계정</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">관리자 이름</label>
                    <input type="text" placeholder="관리자 이름" value={form.adminName}
                      onChange={(e) => setForm(prev => ({ ...prev, adminName: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">관리자 ID</label>
                    <input type="text" placeholder="영문 소문자" value={form.adminUserId}
                      onChange={(e) => setForm(prev => ({ ...prev, adminUserId: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" required />
                  </div>
                </div>
              </div>

              {errorMsg && <p className="text-red-500 text-xs mt-3 bg-red-50 p-2 rounded">{errorMsg}</p>}
              <div className="flex gap-2 justify-end mt-4">
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">{submitting ? "처리중..." : editId ? "수정" : "등록"}</button>
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded text-sm">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
