"use client";

// 개인메모 검색창과 같은 모양의 둥근 검색창 — 통합검색(PC 탭줄, 폰 검색 탭)에서 쓴다
export default function SearchBox({
  value, onChange, autoFocus, compact, placeholder = "일정·메모·사진 태그 검색",
}: { value: string; onChange: (v: string) => void; autoFocus?: boolean; compact?: boolean; placeholder?: string }) {
  return (
    <div className={`flex items-center gap-2 border border-gray-300 bg-white rounded-full ${compact ? "px-3.5 py-1.5" : "px-4 py-2.5"}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="업무관리 검색"
        autoFocus={autoFocus}
        className={`flex-1 min-w-0 outline-none bg-transparent ${compact ? "text-sm" : "text-base"}`}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="지우기" className="text-gray-400 px-1">
          ✕
        </button>
      )}
    </div>
  );
}
