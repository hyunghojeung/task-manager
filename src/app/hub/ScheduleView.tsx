"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Item {
  id: string;
  on_date: string;
  title: string;
  content: string | null;
  color: string;
  done: boolean;
}
interface Holiday {
  on_date: string;
  name: string;
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const COLORS: Array<{ key: string; bar: string; dot: string; label: string }> = [
  { key: "yellow", bar: "bg-[#FEE500]", dot: "bg-[#E5B800]", label: "노랑" },
  { key: "blue", bar: "bg-[#4B7BEC]", dot: "bg-[#4B7BEC]", label: "파랑" },
  { key: "green", bar: "bg-[#38A169]", dot: "bg-[#38A169]", label: "초록" },
  { key: "rose", bar: "bg-[#E0453E]", dot: "bg-[#E0453E]", label: "빨강" },
];

function bar(color: string) {
  return COLORS.find((c) => c.key === color)?.bar || COLORS[0].bar;
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function labelOf(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 ${DOW[new Date(y, m - 1, d).getDay()]}요일`;
}

export default function ScheduleView() {
  const today = useMemo(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
  }, []);

  const [view, setView] = useState({ y: today.y, m: today.m });
  const [sel, setSel] = useState(ymd(today.y, today.m, today.d));
  const [items, setItems] = useState<Item[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [dayOpen, setDayOpen] = useState(false);
  const [detail, setDetail] = useState<Item | null>(null);
  const [form, setForm] = useState<{ id?: string; title: string; content: string; color: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const last = new Date(view.y, view.m, 0).getDate();
    const from = ymd(view.y, view.m, 1);
    const to = ymd(view.y, view.m, last);
    try {
      const r = await fetch(`/api/hub/schedules?from=${from}&to=${to}&_=${Date.now()}`);
      if (r.ok) {
        const d = await r.json();
        setItems(d.schedules || []);
        const map: Record<string, string> = {};
        (d.holidays || []).forEach((h: Holiday) => {
          map[h.on_date.slice(0, 10)] = h.name;
        });
        setHolidays(map);
      }
    } finally {
      setLoading(false);
    }
  }, [view.y, view.m]);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => {
    const m: Record<string, Item[]> = {};
    items.forEach((it) => {
      const k = it.on_date.slice(0, 10);
      (m[k] = m[k] || []).push(it);
    });
    return m;
  }, [items]);

  const selItems = byDate[sel] || [];
  const monthHolidays = useMemo(
    () =>
      Object.entries(holidays)
        .filter(([k]) => k.startsWith(`${view.y}-${pad(view.m)}`))
        .sort(),
    [holidays, view.y, view.m],
  );

  function moveMonth(delta: number) {
    let { y, m } = view;
    m += delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setView({ y, m });
  }
  function goToday() {
    setView({ y: today.y, m: today.m });
    setSel(ymd(today.y, today.m, today.d));
  }

  async function toggleDone(it: Item) {
    setBusy(true);
    try {
      const r = await fetch(`/api/hub/schedules/${it.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !it.done }),
      });
      if (r.ok) {
        const next = await r.json();
        setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)));
        setDetail((prev) => (prev && prev.id === next.id ? next : prev));
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const payload = { title: form.title, content: form.content, color: form.color };
      if (form.id) {
        const r = await fetch(`/api/hub/schedules/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          const next = await r.json();
          setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)));
          setDetail(next);
          setForm(null);
        } else alert((await r.json().catch(() => ({}))).error || "수정 실패");
      } else {
        const r = await fetch("/api/hub/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, on_date: sel }),
        });
        if (r.ok) {
          const created = await r.json();
          setItems((prev) => [...prev, created]);
          setForm(null);
        } else alert((await r.json().catch(() => ({}))).error || "저장 실패");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(it: Item) {
    if (!confirm("이 일정을 삭제할까요?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/hub/schedules/${it.id}`, { method: "DELETE" });
      if (r.ok) {
        setItems((prev) => prev.filter((p) => p.id !== it.id));
        setDetail(null);
      }
    } finally {
      setBusy(false);
    }
  }

  // ----- 달력 칸 계산 -----
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1).getDay();
    const days = new Date(view.y, view.m, 0).getDate();
    const total = Math.ceil((first + days) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const dt = new Date(view.y, view.m - 1, i - first + 1);
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const d = dt.getDate();
      const key = ymd(y, m, d);
      return { key, d, dow: dt.getDay(), other: m !== view.m || y !== view.y };
    });
  }, [view.y, view.m]);

  const isOff = (key: string, dow: number) => dow === 0 || !!holidays[key];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4 pb-24 md:pb-6">
      {/* 머리말 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">일정</h2>
          <p className="text-xs text-gray-500 mt-0.5">나만 보는 개인 일정입니다</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 border border-gray-300 rounded text-xs bg-white hover:bg-gray-50">
            오늘
          </button>
          <button
            onClick={() => setForm({ title: "", content: "", color: "yellow" })}
            className="hidden md:inline-flex px-3.5 py-1.5 rounded text-xs font-bold bg-[#FEE500] text-[#191919] hover:bg-[#f2da00]"
          >
            + 일정 추가
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] items-start">
        {/* ===== 달력 ===== */}
        <div>
          <div className="flex items-center justify-between px-1 pb-2">
            <button onClick={() => moveMonth(-1)} aria-label="이전 달" className="px-3 py-1 text-gray-600 hover:text-gray-900 text-lg">
              ‹
            </button>
            <span className="text-lg md:text-2xl font-bold tabular-nums">
              {view.y}년 {view.m}월
            </span>
            <button onClick={() => moveMonth(1)} aria-label="다음 달" className="px-3 py-1 text-gray-600 hover:text-gray-900 text-lg">
              ›
            </button>
          </div>

          {/* 모바일: 점 하나 */}
          <div className="md:hidden bg-[#B2C7D9] rounded-lg p-2.5">
            <div className="grid grid-cols-7">
              {DOW.map((n, i) => (
                <div key={n} className={`text-center text-xs font-bold pb-1 ${i === 0 ? "text-[#D93A33]" : "text-[#191919]/70"}`}>
                  {n}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((c) => {
                const off = isOff(c.key, c.dow);
                const has = (byDate[c.key] || []).length > 0;
                const selected = c.key === sel;
                return (
                  <button
                    key={c.key}
                    onClick={() => setSel(c.key)}
                    className={`aspect-square rounded flex flex-col items-center justify-center gap-1 text-base tabular-nums ${
                      selected ? "bg-[#FEE500] font-bold text-[#191919]" : c.other ? "text-[#191919]/25" : off ? "text-[#D93A33]" : "text-[#191919]"
                    } ${c.key === ymd(today.y, today.m, today.d) && !selected ? "font-bold underline underline-offset-4" : ""}`}
                  >
                    <span>{c.d}</span>
                    <span className={`w-[5px] h-[5px] rounded-full ${has ? (selected ? "bg-[#191919]" : "bg-[#191919]/70") : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
            {monthHolidays.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-[#191919]/10">
                <span className="text-[11px] text-[#191919]/60 py-0.5">이 달의 공휴일</span>
                {monthHolidays.map(([k, n]) => (
                  <span key={k} className="text-[11px] font-semibold text-[#D93A33] bg-white rounded-full px-2 py-0.5">
                    {Number(k.slice(8, 10))}일 {n}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* PC: 표 달력 */}
          <div className="hidden md:grid grid-cols-7 border-l border-t border-gray-200/70 bg-white">
            {DOW.map((n, i) => (
              <div
                key={n}
                className={`border-r border-b border-gray-200/70 bg-gray-50 py-1 text-center text-[15px] font-bold ${i === 0 ? "text-[#D93A33]" : "text-gray-800"}`}
              >
                {n}
              </div>
            ))}
            {cells.map((c) => {
              const off = isOff(c.key, c.dow);
              const list = byDate[c.key] || [];
              const selected = c.key === sel;
              return (
                <button
                  key={c.key}
                  onClick={() => setSel(c.key)}
                  className={`border-r border-b border-gray-200/70 min-h-[112px] p-2 flex flex-col gap-1 text-left overflow-hidden ${
                    selected ? "bg-[#FEE500]/25 ring-1 ring-inset ring-[#FEE500]" : c.other ? "bg-gray-50/60 hover:bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span
                      className={`tabular-nums ${
                        c.other ? "text-gray-400" : off ? "text-[#D93A33]" : "text-gray-900"
                      } ${c.key === ymd(today.y, today.m, today.d) ? "bg-[#191919] text-white rounded px-1.5 font-semibold" : ""}`}
                    >
                      {c.d}
                    </span>
                    {holidays[c.key] && <span className="text-xs text-[#D93A33] truncate">{holidays[c.key]}</span>}
                  </span>
                  {!c.other &&
                    list.slice(0, 3).map((it) => (
                      <span key={it.id} className="flex items-center gap-1.5 text-xs">
                        <i className={`w-[3px] h-3 rounded-sm shrink-0 ${bar(it.color)}`} />
                        <span className={`truncate ${it.done ? "line-through text-gray-400" : "text-gray-700"}`}>{it.title}</span>
                      </span>
                    ))}
                  {!c.other && list.length > 3 && <span className="text-[11px] text-gray-500 pl-2">+{list.length - 3}개 더</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== 선택한 날짜 ===== */}
        <aside className="flex flex-col gap-3">
          <button onClick={() => setDayOpen(true)} className="w-full flex items-baseline justify-between gap-2 text-left group">
            <span className="text-lg font-bold text-gray-900">
              {labelOf(sel)}
              {holidays[sel] && <em className="not-italic text-sm text-[#D93A33] ml-2">{holidays[sel]}</em>}
            </span>
            <span className="text-xs text-gray-400 shrink-0">
              {selItems.length > 0 ? `${selItems.length}건` : ""} <span className="text-base align-middle">›</span>
            </span>
          </button>

          {loading ? (
            <div className="text-center text-xs text-gray-400 py-8">불러오는 중…</div>
          ) : selItems.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8 border border-dashed border-gray-300 rounded-lg whitespace-pre-line">
              {"적어둔 것이 없습니다\n+ 를 눌러 추가하세요"}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selItems.map((it) => (
                <ItemRow key={it.id} it={it} onOpen={() => setDetail(it)} onToggle={() => toggleDone(it)} busy={busy} />
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* 모바일 추가 버튼 */}
      <button
        onClick={() => setForm({ title: "", content: "", color: "yellow" })}
        aria-label="일정 추가"
        className="md:hidden fixed right-5 bottom-6 w-14 h-14 rounded-full bg-[#FEE500] text-[#191919] text-3xl font-bold shadow-lg grid place-items-center leading-none"
      >
        +
      </button>

      {/* 하루 전체 보기 */}
      {dayOpen && (
        <Modal onClose={() => setDayOpen(false)} title={labelOf(sel)} sub={holidays[sel]}>
          <p className="text-xs text-gray-500">{selItems.length > 0 ? `적어둔 것 ${selItems.length}건` : "적어둔 것이 없습니다"}</p>
          <div className="flex flex-col gap-2 mt-1">
            {selItems.map((it) => (
              <ItemRow
                key={it.id}
                it={it}
                onOpen={() => {
                  setDayOpen(false);
                  setDetail(it);
                }}
                onToggle={() => toggleDone(it)}
                busy={busy}
              />
            ))}
          </div>
          <button
            onClick={() => {
              setDayOpen(false);
              setForm({ title: "", content: "", color: "yellow" });
            }}
            className="w-full py-3 rounded bg-[#FEE500] text-[#191919] text-sm font-bold"
          >
            + 이 날에 추가
          </button>
        </Modal>
      )}

      {/* 상세 */}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
            <i className={`w-3.5 h-3.5 rounded ${bar(detail.color)}`} />
            <span>
              {labelOf(detail.on_date.slice(0, 10))}
              {holidays[detail.on_date.slice(0, 10)] ? ` · ${holidays[detail.on_date.slice(0, 10)]}` : ""}
            </span>
          </div>
          <h3 className={`text-2xl font-bold ${detail.done ? "line-through text-gray-400" : "text-gray-900"}`}>{detail.title}</h3>
          <p className={`whitespace-pre-line leading-relaxed ${detail.content ? "text-gray-800 text-base" : "text-gray-400 text-sm"}`}>
            {detail.content || "적어둔 내용이 없습니다"}
          </p>
          <button
            onClick={() => toggleDone(detail)}
            disabled={busy}
            className="w-full py-3 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {detail.done ? "✓ 완료됨 — 해제하기" : "완료로 표시"}
          </button>
          <div className="flex justify-between gap-2">
            <button
              onClick={() => remove(detail)}
              disabled={busy}
              className="px-4 py-2.5 rounded border border-red-300 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
            <button
              onClick={() => setForm({ id: detail.id, title: detail.title, content: detail.content || "", color: detail.color })}
              className="px-5 py-2.5 rounded bg-[#FEE500] text-[#191919] text-sm font-bold"
            >
              수정
            </button>
          </div>
        </Modal>
      )}

      {/* 추가 · 수정 */}
      {form && (
        <Modal onClose={() => setForm(null)} title={form.id ? "일정 수정" : "일정 추가"} sub={form.id ? undefined : labelOf(sel)}>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-600">제목</span>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 치과 예약"
              className="border border-gray-300 rounded px-3 py-2.5 text-base outline-none focus:border-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-600">내용</span>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="자유롭게 적으세요"
              rows={4}
              className="border border-gray-300 rounded px-3 py-2.5 text-base outline-none focus:border-gray-900 resize-y"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-600">색상</span>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setForm({ ...form, color: c.key })}
                  aria-label={c.label}
                  aria-pressed={form.color === c.key}
                  className={`w-8 h-8 rounded-full ${c.bar} ${form.color === c.key ? "ring-2 ring-offset-2 ring-gray-900" : ""}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded border border-gray-300 text-sm">
              취소
            </button>
            <button onClick={save} disabled={busy} className="px-5 py-2.5 rounded bg-[#FEE500] text-[#191919] text-sm font-bold disabled:opacity-50">
              저장
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ItemRow({ it, onOpen, onToggle, busy }: { it: Item; onOpen: () => void; onToggle: () => void; busy: boolean }) {
  return (
    <div
      onClick={onOpen}
      className="flex items-start gap-3 bg-gray-50 hover:bg-[#FEE500]/20 rounded-lg px-3 py-2.5 cursor-pointer"
    >
      <i className={`w-[3px] self-stretch min-h-[22px] rounded-sm shrink-0 ${bar(it.color)}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-medium leading-snug ${it.done ? "line-through text-gray-400" : "text-gray-900"}`}>{it.title}</div>
        {it.content && <div className={`text-[13px] whitespace-pre-line ${it.done ? "text-gray-400" : "text-gray-600"}`}>{it.content}</div>}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={busy}
        aria-pressed={it.done}
        aria-label="완료 표시"
        className={`w-5 h-5 mt-0.5 rounded-full border shrink-0 grid place-items-center text-[11px] ${
          it.done ? "bg-[#FEE500] border-[#FEE500] text-[#191919]" : "border-gray-300 text-transparent"
        }`}
      >
        ✓
      </button>
    </div>
  );
}

function Modal({
  children,
  onClose,
  title,
  sub,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  sub?: string;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-white rounded-t-2xl md:rounded-xl p-5 flex flex-col gap-3.5 max-h-[88vh] overflow-y-auto">
        <div className="md:hidden w-9 h-1 rounded-full bg-gray-300 mx-auto -mt-1 mb-1" />
        {title && (
          <h3 className="text-lg font-bold text-gray-900">
            {title}
            {sub && <span className="text-sm font-medium text-[#D93A33] ml-2">{sub}</span>}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}
