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
  order_count: number;
  memo_count: number;
  po_count: number;
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
    business_type: "", business_category: "", password: "",
    adminName: "", adminUserId: "", adminPassword: "",
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
        setForm({ company_code: "", company_id: "", company_name: "", business_number: "", representative: "", phone: "", fax: "", email: "", address: "", business_type: "", business_category: "", password: "", adminName: "", adminUserId: "", adminPassword: "" });
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

  async function openEdit(c: CompanyData) {
    setEditId(c.id);
    // 관리자 사용자 조회
    let adminName = "", adminUserId = "", adminPassword = "";
    try {
      const res = await fetch(`/api/admin/companies/${c.id}/admin?_=${Date.now()}`);
      if (res.ok) {
        const admin = await res.json();
        adminName = admin.name || "";
        adminUserId = admin.user_id || "";
        adminPassword = admin.password || "";
      }
    } catch { /* ignore */ }
    setForm({
      company_code: c.company_code || "", company_id: c.company_id || "",
      company_name: c.company_name || "", business_number: c.business_number || "",
      representative: c.representative || "", phone: c.phone || "",
      fax: c.fax || "", email: c.email || "", address: c.address || "",
      business_type: c.business_type || "", business_category: c.business_category || "",
      password: c.password || "", adminName, adminUserId, adminPassword,
    });
    setShowModal(true);
  }

  function openCreate() {
    setEditId(null);
    setForm({ company_code: "", company_id: "", company_name: "", business_number: "", representative: "", phone: "", fax: "", email: "", address: "", business_type: "", business_category: "", password: "", adminName: "", adminUserId: "", adminPassword: "" });
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
      if (res.ok) {
        // 관리자 정보도 업데이트
        if (form.adminName || form.adminUserId) {
          await fetch(`/api/admin/companies/${editId}/admin`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: form.adminName, user_id: form.adminUserId, password: form.adminPassword }),
          });
        }
        setShowModal(false); alert("수정되었습니다."); setTimeout(() => refreshList(), 500);
      } else { const d = await res.json(); setErrorMsg(d.error || "수정 실패"); }
    } catch (err) { setErrorMsg("서버 오류: " + (err instanceof Error ? err.message : "")); }
    finally { setSubmitting(false); }
  }

  async function impersonate(companyId: string, target: string) {
    const res = await fetch("/api/admin/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
    if (res.ok) window.open(target, "_blank");
    else alert("업체 접속 실패");
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요? 업체의 모든 데이터가 삭제됩니다.")) return;
    await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
    refreshList();
  }

  function SettingsTab() {
    const [settings, setSettings] = useState({ system_name: "Blackcopy.kr", admin_id: "blackcopy2" });
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [settingsSaving, setSettingsSaving] = useState(false);

    useEffect(() => {
      fetch(`/api/admin/settings?_=${Date.now()}`).then(r => r.json()).then(d => {
        setSettings({ system_name: d.system_name || "Blackcopy.kr", admin_id: d.admin_id || "blackcopy2" });
        setSettingsLoading(false);
      }).catch(() => setSettingsLoading(false));
    }, []);

    async function saveSettings() {
      setSettingsSaving(true);
      const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      if (res.ok) alert("저장되었습니다.");
      else alert("저장 실패");
      setSettingsSaving(false);
    }

    if (settingsLoading) return <div className="bg-white rounded-lg shadow p-6"><p className="text-sm text-gray-400">로딩중...</p></div>;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">시스템 설정</h3>
        <div className="grid grid-cols-1 gap-3 text-sm max-w-lg">
          <div className="flex items-center gap-3">
            <label className="w-32 text-xs font-semibold text-gray-600">시스템명</label>
            <input type="text" value={settings.system_name} onChange={e => setSettings(p => ({ ...p, system_name: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <label className="w-32 text-xs font-semibold text-gray-600">관리자 ID</label>
            <input type="text" value={settings.admin_id} onChange={e => setSettings(p => ({ ...p, admin_id: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" />
          </div>
        </div>
        <button onClick={saveSettings} disabled={settingsSaving} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">{settingsSaving ? "저장중..." : "설정 저장"}</button>
      </div>
    );
  }

  function AdsTab() {
    const [ad, setAd] = useState({ content: "", link_url: "", button_text: "FREE" });
    const [adLoading, setAdLoading] = useState(true);
    const [adSaving, setAdSaving] = useState(false);

    useEffect(() => {
      fetch(`/api/admin/ads?_=${Date.now()}`).then(r => r.json()).then(d => {
        setAd({ content: d.content || "", link_url: d.link_url || "", button_text: d.button_text || "FREE" });
        setAdLoading(false);
      }).catch(() => setAdLoading(false));
    }, []);

    async function saveAd() {
      setAdSaving(true);
      const res = await fetch("/api/admin/ads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ad) });
      if (res.ok) alert("저장되었습니다.");
      else alert("저장 실패");
      setAdSaving(false);
    }

    if (adLoading) return <div className="bg-white rounded-lg shadow p-6"><p className="text-sm text-gray-400">로딩중...</p></div>;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">배너 광고 관리</h3>
        <p className="text-xs text-gray-500 mb-4">배너에 표시될 텍스트, 클릭 시 이동할 URL, 버튼 텍스트를 설정합니다.</p>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1">미리보기</label>
          <div className="bg-gradient-to-r from-slate-800 via-blue-600 to-sky-500 px-6 py-2.5 rounded-md flex justify-between items-center">
            <span className="text-white text-sm font-bold">{ad.content || "(배너 텍스트)"}</span>
            <span className="bg-amber-400 text-slate-900 px-3 py-0.5 rounded-full text-xs font-bold">{ad.button_text || "FREE"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">배너 텍스트</label>
            <input type="text" value={ad.content} onChange={e => setAd(p => ({ ...p, content: e.target.value }))}
              placeholder="배너에 표시될 문구" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">클릭 시 이동 URL</label>
            <input type="text" value={ad.link_url} onChange={e => setAd(p => ({ ...p, link_url: e.target.value }))}
              placeholder="https://example.com" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">버튼 텍스트</label>
            <input type="text" value={ad.button_text} onChange={e => setAd(p => ({ ...p, button_text: e.target.value }))}
              placeholder="FREE" className="w-full px-3 py-2 border border-gray-300 rounded text-sm max-w-[200px]" />
          </div>
        </div>

        <button onClick={saveAd} disabled={adSaving} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
          {adSaving ? "저장중..." : "저장"}
        </button>
      </div>
    );
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
          <button onClick={() => { if (typeof window !== "undefined") sessionStorage.removeItem("superAdminAuth"); window.location.href = "/super-admin"; }} className="text-slate-400 hover:text-white">로그아웃</button>
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
              <div className="flex gap-2">
                <button onClick={async () => { if(!confirm("pwindow 양식을 모든 업체에 복사하시겠습니까?")) return; const r = await fetch("/api/admin/sync-templates",{method:"POST"}); const d = await r.json(); alert(d.message || d.error); }} className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium">양식 일괄복사</button>
                <button onClick={openCreate} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ 업체 등록</button>
              </div>
            </div>
            {loading ? <p className="text-sm text-gray-400">로딩중...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs border border-gray-300">
                  <thead><tr className="bg-slate-900 text-white">
                    <th className="border border-slate-700 px-2 py-2.5">순번</th><th className="border border-slate-700 px-2 py-2.5">업체ID</th><th className="border border-slate-700 px-2 py-2.5">업체코드</th><th className="border border-slate-700 px-2 py-2.5">업체명</th><th className="border border-slate-700 px-2 py-2.5">사업자번호</th><th className="border border-slate-700 px-2 py-2.5">대표자</th><th className="border border-slate-700 px-2 py-2.5">등록일</th><th className="border border-slate-700 px-2 py-2.5">상태</th><th className="border border-slate-700 px-2 py-2.5">사용자</th><th className="border border-slate-700 px-2 py-2.5">작업리스트</th><th className="border border-slate-700 px-2 py-2.5">메모</th><th className="border border-slate-700 px-2 py-2.5">발주서</th><th className="border border-slate-700 px-2 py-2.5">관리</th>
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
                        <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={() => impersonate(c.company_id, "/dashboard")} className="text-blue-600 hover:underline font-bold">{c.order_count || 0}</button></td>
                        <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={() => impersonate(c.company_id, "/dashboard/memo")} className="text-blue-600 hover:underline font-bold">{c.memo_count || 0}</button></td>
                        <td className="border border-gray-200 px-2 py-2 text-center"><button onClick={() => impersonate(c.company_id, "/dashboard/orders")} className="text-blue-600 hover:underline font-bold">{c.po_count || 0}</button></td>
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

        {tab === "ads" && <AdsTab />}

        {tab === "settings" && <SettingsTab />}
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
