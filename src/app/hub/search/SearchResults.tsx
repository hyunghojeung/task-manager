"use client";

import { useEffect, useState } from "react";
import { textOnly } from "@/lib/memo-text";

// 업무관리 통합검색 결과 — 일정 · 개인메모 · 갤러리(태그)를 한 번에 찾아 세 묶음으로 보여준다.
// PC 는 탭줄의 검색창(HubTabs)이, 폰은 검색 탭 화면이 이 컴포넌트를 쓴다.

interface Schedule { id: string; on_date: string; title: string; content: string | null; color: string; done: boolean; bold: boolean }
interface Memo { id: string; title: string; content: string; tags: string[] | null; updated_at: string }
interface Photo { id: string; url: string; tags: string[] | null; source: string; source_name: string }

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
function labelOf(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${DOW[dt.getDay()]})`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const DOT: Record<string, string> = { yellow: "bg-yellow-300", blue: "bg-blue-300", pink: "bg-pink-300", green: "bg-green-300", gray: "bg-gray-300" };

/** 맞는 글자를 노랗게 */
function Hl({ text, q }: { text: string; q: string }) {
  const t = text || "";
  const i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{t}</>;
  return (
    <>
      {t.slice(0, i)}
      <mark className="bg-[#fff3a3] text-inherit rounded-sm px-px">{t.slice(i, i + q.length)}</mark>
      {t.slice(i + q.length)}
    </>
  );
}

export default function SearchResults({ q }: { q: string }) {
  const term = q.replace(/^#/, "").trim();
  const tagOnly = q.trim().startsWith("#");
  const [res, setRes] = useState<{ key: string; sch: Schedule[]; memos: Memo[]; photos: Photo[] }>({ key: "", sch: [], memos: [], photos: [] });

  useEffect(() => {
    if (!term) return;
    let alive = true;
    const enc = encodeURIComponent(q.trim());
    Promise.all([
      tagOnly ? Promise.resolve({ schedules: [] }) : fetch(`/api/hub/schedules?q=${enc}&_=${Date.now()}`).then((r) => (r.ok ? r.json() : { schedules: [] })),
      fetch(`/api/hub/memos?q=${enc}&_=${Date.now()}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/hub/photos?q=${enc}&source=gallery&_=${Date.now()}`).then((r) => (r.ok ? r.json() : { photos: [] })),
    ]).then(([s, m, p]) => {
      if (!alive) return;
      setRes({ key: q, sch: s.schedules || [], memos: Array.isArray(m) ? m : m.memos || [], photos: p.photos || [] });
    }).catch(() => {});
    return () => { alive = false; };
  }, [q, term, tagOnly]);

  // 아직 이번 검색어의 결과가 안 왔으면 '찾는 중'
  const loading = !!term && res.key !== q;
  const sch = res.key === q ? res.sch : [];
  const memos = res.key === q ? res.memos : [];
  const photos = res.key === q ? res.photos : [];

  if (!term) {
    return (
      <p className="text-xs text-gray-400 px-1 py-2">
        검색어를 치면 일정 · 개인메모 · 갤러리에서 한 번에 찾습니다.
        <br />#태그로 치면 태그만 찾습니다.
      </p>
    );
  }

  const today = todayKey();
  const empty = (msg: string) => <div className="border border-dashed border-gray-300 rounded-lg py-6 text-center text-xs text-gray-400">{msg}</div>;
  const head = (label: string, count: string, href: string) => (
    <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-gray-900 mb-2">
      {label} <span className="text-[11px] font-normal text-gray-500">{count}</span>
      {loading && <span className="text-[11px] font-normal text-gray-400">찾는 중…</span>}
      <a href={href} className="ml-auto text-xs font-normal text-gray-500 hover:text-gray-900">그 탭에서 보기 ›</a>
    </h3>
  );

  return (
    <div className="grid gap-5 md:grid-cols-3 items-start">
      {/* 일정 */}
      <section>
        {head("일정", `${sch.length}건`, `/hub`)}
        {sch.length === 0 ? empty(tagOnly ? "일정은 태그가 없어 #검색에서 빠집니다" : "맞는 일정이 없습니다") : (
          <div className="flex flex-col gap-2">
            {sch.map((it) => {
              const key = it.on_date.slice(0, 10);
              const past = key < today && !it.done;
              return (
                <a key={it.id} href={`/hub?d=${key}&id=${it.id}`} className="flex gap-2.5 items-start border border-gray-200 rounded-lg bg-white px-3 py-2.5 hover:bg-gray-50">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${DOT[it.color] || DOT.yellow}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${it.bold ? "font-bold" : "font-semibold"} ${it.done ? "line-through opacity-50" : ""}`}><Hl text={it.title} q={term} /></div>
                    {it.content && <div className="text-xs text-gray-600 mt-0.5 line-clamp-2"><Hl text={textOnly(it.content)} q={term} /></div>}
                  </div>
                  <span className={`text-xs whitespace-nowrap tabular-nums ${past ? "text-[#D93A33]" : "text-gray-500"}`}>{labelOf(key)}{it.done ? " ✓" : ""}</span>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* 개인메모 */}
      <section>
        {head("개인메모", `${memos.length}건`, `/hub/memo?q=${encodeURIComponent(q.trim())}`)}
        {memos.length === 0 ? empty("맞는 메모가 없습니다") : (
          <div className="flex flex-col gap-2">
            {memos.map((m) => (
              <a key={m.id} href={`/hub/memo?q=${encodeURIComponent(q.trim())}&open=${m.id}`} className="flex gap-2.5 items-start border border-gray-200 rounded-lg bg-white px-3 py-2.5 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold"><Hl text={m.title || "제목 없음"} q={term} /></div>
                  {m.content && <div className="text-xs text-gray-600 mt-0.5 line-clamp-2"><Hl text={textOnly(m.content)} q={term} /></div>}
                  {m.tags && m.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.tags.map((t) => <span key={t} className="text-[11px] bg-gray-100 text-gray-600 rounded px-1.5">#<Hl text={t} q={term} /></span>)}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap tabular-nums">{m.updated_at?.slice(5, 10).replace("-", ".")}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* 갤러리 */}
      <section>
        {head("갤러리", `${photos.length}장`, `/hub/gallery?q=${encodeURIComponent(term)}`)}
        {photos.length === 0 ? empty("맞는 사진이 없습니다 (사진은 태그로 찾습니다)") : (
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map((p) => (
              <a key={p.id} href={`/hub/gallery?q=${encodeURIComponent(term)}&open=${p.id}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                {p.tags && p.tags[0] && <span className="absolute left-1 bottom-1 text-[10px] bg-black/55 text-white rounded px-1">#{p.tags[0]}</span>}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
