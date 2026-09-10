import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession } from "@/lib/api-helpers";
import type { SessionData } from "@/types/database";

/**
 * 업무관리 API 공통 권한 확인.
 * 로그인 여부 + 관리자가 켜 준 hub_enabled 를 매번 확인한다.
 * 화면에서 버튼을 숨기는 것과 별개로 여기서 실제로 막는다.
 */
export async function requireHub(): Promise<
  { ok: true; session: SessionData } | { ok: false; res: NextResponse }
> {
  const session = await getApiSession();
  if (!session) {
    return { ok: false, res: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }

  const supabase = getSupabase();
  const { data } = await supabase
    .from("users")
    .select("hub_enabled")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!data?.hub_enabled) {
    return { ok: false, res: NextResponse.json({ error: "업무관리 사용 권한이 없습니다." }, { status: 403 }) };
  }

  return { ok: true, session };
}

/** 일정 색상 — 화면과 DB가 같은 이름을 쓴다 */
export const HUB_COLORS = ["yellow", "blue", "green", "rose"] as const;
export type HubColor = (typeof HUB_COLORS)[number];

export function normalizeColor(v: unknown): HubColor {
  return HUB_COLORS.includes(v as HubColor) ? (v as HubColor) : "yellow";
}

/** 본문에서 #태그를 뽑아낸다. 중복은 제거하고 순서는 유지한다. */
export function extractTags(text: string): string[] {
  const out: string[] = [];
  const re = /#([^\s#]{1,30})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || "")) !== null) {
    const t = m[1].trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 20);
}

export interface HubMemo {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  updated_at: string;
  photos?: HubPhoto[];
}

export interface HubPhoto {
  id: string;
  url: string;
  file_name: string | null;
  memo_id: string | null;
}

export interface HubSchedule {
  id: string;
  on_date: string;
  title: string;
  content: string | null;
  color: string;
  done: boolean;
}
