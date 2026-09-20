// bimposition.com "준비 중" 페이지 — 판매용 가입·내 제품 화면이 생기기 전까지 새 도메인으로 오는 사람에게 보여준다.
// 디자인은 B-imposition 프로그램 로그인 화면과 같은 결(전체 배경, 원 안의 B).
export const metadata = { title: "B — Online Print On Demand" };

export default function ComingSoonPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        backgroundColor: "#0b2a55",
        backgroundImage:
          "radial-gradient(60% 70% at 20% 15%,rgba(63,150,255,.55),transparent 60%),radial-gradient(50% 60% at 85% 80%,rgba(150,85,255,.45),transparent 60%),radial-gradient(70% 50% at 60% 40%,rgba(0,190,230,.28),transparent 65%)",
        textShadow: "0 1px 6px rgba(0,0,0,.45)",
        fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif',
        padding: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 420 }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255,255,255,.16)",
            border: "2px solid rgba(255,255,255,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-.03em",
          }}
        >
          B
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase", opacity: 0.9 }}>
          Online Print On Demand
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>B-imposition · B-ERP · B-PDF</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 22, lineHeight: 1.7 }}>
          인쇄·출력 현장을 위한 B 시리즈 프로그램을 준비하고 있습니다.
          <br />
          곧 이곳에서 가입하고 바로 사용할 수 있습니다.
        </div>
        <a
          href="https://www.blackcopy.kr"
          style={{ marginTop: 28, fontSize: 12, color: "#fff", opacity: 0.8, textDecoration: "underline" }}
        >
          기존 Bcount 회원은 www.blackcopy.kr 에서 로그인하세요
        </a>
      </div>
    </div>
  );
}
