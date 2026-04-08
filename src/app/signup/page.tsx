"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_id: "", company_name: "", password: "", passwordConfirm: "",
    business_number: "", representative: "", phone: "", email: "",
    adminName: "", adminUserId: "", adminPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [idAvailable, setIdAvailable] = useState<boolean | null>(null);
  const [idChecking, setIdChecking] = useState(false);

  // 업체 ID 실시간 중복 체크
  useEffect(() => {
    if (!form.company_id || form.company_id.length < 3) {
      setIdAvailable(null);
      return;
    }
    if (!/^[a-z0-9_]+$/.test(form.company_id)) {
      setIdAvailable(null);
      return;
    }
    setIdChecking(true);
    const timer = setTimeout(() => {
      fetch(`/api/signup/check-id?id=${form.company_id}`)
        .then(r => r.json())
        .then(d => setIdAvailable(d.available))
        .catch(() => setIdAvailable(null))
        .finally(() => setIdChecking(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [form.company_id]);

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.company_id || !form.company_name || !form.password || !form.business_number || !form.representative || !form.phone || !form.email || !form.adminName || !form.adminUserId || !form.adminPassword) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(form.company_id)) {
      setError("업체 ID는 영문 소문자, 숫자, _ 만 사용 가능합니다. (3~30자)");
      return;
    }
    if (form.password.length < 4) {
      setError("비밀번호는 4자 이상 입력해주세요.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (idAvailable === false) {
      setError("이미 사용 중인 업체 ID입니다.");
      return;
    }

    setLoading(true);
    try {
      const { passwordConfirm, ...submitData } = form;
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "등록에 실패했습니다.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-8 md:p-10 rounded-lg shadow-md w-full max-w-sm text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">업체 등록 완료!</h2>
          <p className="text-sm text-gray-600 mb-1">업체 ID: <strong className="text-blue-600">{form.company_id}</strong></p>
          <p className="text-sm text-gray-600 mb-4">관리자 ID: <strong className="text-blue-600">{form.adminUserId}</strong></p>
          <p className="text-xs text-gray-400 mb-6">위 정보로 로그인하실 수 있습니다.</p>
          <button onClick={() => router.push("/")} className="w-full py-3 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 transition">
            로그인 하러 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
      <div className="bg-white p-8 md:p-10 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-1 text-center">
          <a href="/" className="text-gray-800 no-underline">Blackcopy.kr</a>
        </h1>
        <p className="text-sm font-semibold text-gray-500 mb-1 text-center">인쇄전용 ERP Bcount</p>
        <p className="text-xs text-gray-400 mb-6 text-center">신규업체 등록</p>

        <form onSubmit={handleSubmit}>
          <p className="text-sm font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">업체 정보</p>
          <div className="grid gap-3 text-sm mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">업체 ID <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="text" placeholder="영문 소문자, 숫자, _ (3~30자)" value={form.company_id} onChange={e => handleChange("company_id", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
                {form.company_id.length >= 3 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                    {idChecking ? "..." : idAvailable === true ? <span className="text-green-600">사용 가능</span> : idAvailable === false ? <span className="text-red-500">사용 불가</span> : null}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">업체명 <span className="text-red-500">*</span></label>
              <input type="text" placeholder="회사 이름" value={form.company_name} onChange={e => handleChange("company_name", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호 <span className="text-red-500">*</span></label>
              <input type="password" placeholder="4자 이상" value={form.password} onChange={e => handleChange("password", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호 확인 <span className="text-red-500">*</span></label>
              <input type="password" placeholder="비밀번호 재입력" value={form.passwordConfirm} onChange={e => handleChange("passwordConfirm", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">사업자번호 <span className="text-red-500">*</span></label>
                <input type="text" placeholder="사업자등록번호" value={form.business_number} onChange={e => handleChange("business_number", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">대표자 <span className="text-red-500">*</span></label>
                <input type="text" placeholder="대표자명" value={form.representative} onChange={e => handleChange("representative", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">연락처 <span className="text-red-500">*</span></label>
                <input type="text" placeholder="전화번호" value={form.phone} onChange={e => handleChange("phone", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">이메일 <span className="text-red-500">*</span></label>
                <input type="text" placeholder="이메일 주소" value={form.email} onChange={e => handleChange("email", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
              </div>
            </div>
          </div>

          <p className="text-sm font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">관리자 계정</p>
          <div className="grid gap-3 text-sm mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">관리자 이름 <span className="text-red-500">*</span></label>
              <input type="text" placeholder="관리자 표시 이름" value={form.adminName} onChange={e => handleChange("adminName", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">관리자 ID <span className="text-red-500">*</span></label>
              <input type="text" placeholder="로그인용 관리자 ID" value={form.adminUserId} onChange={e => handleChange("adminUserId", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">관리자 비밀번호 <span className="text-red-500">*</span></label>
              <input type="password" placeholder="관리자 로그인 비밀번호" value={form.adminPassword} onChange={e => handleChange("adminPassword", e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500" required />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

          <button type="submit" disabled={loading || idAvailable === false} className="w-full py-3 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? "등록 중..." : "업체 등록"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500 text-center">
          이미 계정이 있으신가요?{" "}
          <a href="/" className="text-blue-600 font-semibold hover:underline">로그인</a>
        </p>
      </div>
    </div>
  );
}
