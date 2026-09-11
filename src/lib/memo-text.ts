/** 메모 본문 속 주소 처리 — 편집기(클라이언트)와 공유 화면(서버)이 함께 쓴다 */

// 주소 규칙 — 끝에 붙은 구두점은 주소로 치지 않는다
export const URL_SPLIT = /(https?:\/\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]}])/gi;

/** 본문을 [글, 주소, 글, 주소, ... 글] 로 나눈다. 항상 글로 시작하고 글로 끝난다. */
export function splitContent(content: string): string[] {
  const parts = (content || "").split(URL_SPLIT);
  if (parts.length === 0) return [""];
  return parts;
}

/** 본문에 든 주소 목록 (순서 유지, 중복 제거, 최대 5개) */
export function extractUrls(content: string): string[] {
  const out: string[] = [];
  splitContent(content).forEach((s, i) => {
    if (i % 2 === 1 && !out.includes(s) && out.length < 5) out.push(s);
  });
  return out;
}

/** 목록·미리보기용 — 주소를 뺀 글만 */
export function textOnly(content: string): string {
  return (content || "").replace(URL_SPLIT, "").replace(/\n{2,}/g, "\n").trim();
}
