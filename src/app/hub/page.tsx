const TABS = [
  { href: "/hub", label: "일정", icon: "📅", desc: "달력에 날짜별로 적어두기" },
  { href: "/hub/gallery", label: "갤러리", icon: "🖼", desc: "앨범과 태그로 사진 정리" },
  { href: "/hub/memo", label: "개인메모", icon: "📝", desc: "사진 첨부와 태그, 링크 공유" },
];

export default function HubPage() {
  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-bold text-gray-900">업무관리</h2>
        <span className="text-xs text-gray-500">나만 보는 개인 공간입니다</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TABS.map((t) => (
          <div
            key={t.label}
            className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-1"
          >
            <span className="text-2xl leading-none">{t.icon}</span>
            <span className="text-sm font-bold text-gray-900 mt-1">{t.label}</span>
            <span className="text-xs text-gray-500">{t.desc}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#FEE500] rounded-lg p-5">
        <p className="text-sm font-bold text-[#191919]">여기까지가 1단계입니다.</p>
        <p className="text-xs text-[#191919] mt-1.5 leading-relaxed">
          관리자가 켜 준 사람에게만 이 화면이 열립니다. 권한이 없는 사람은 주소를 직접 입력해도
          작업리스트로 돌려보냅니다.
          <br />
          다음 단계에서 달력과 일정 등록부터 차례로 붙입니다.
        </p>
      </div>
    </div>
  );
}
