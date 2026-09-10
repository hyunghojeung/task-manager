"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Photo {
  id: string;
  url: string;
  file_name: string | null;
  memo_id: string | null;
}
interface Memo {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  updated_at: string;
  photos: Photo[];
}

function tagsOf(text: string) {
  const out: string[] = [];
  const re = /#([^\s#]{1,30})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || "")) !== null) {
    const t = m[1].trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
function stripTags(text: string) {
  return (text || "").replace(/#[^\s#]+/g, "").trim();
}
function when(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `오늘 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function MemoView() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Memo | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (keyword: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hub/memos?q=${encodeURIComponent(keyword)}&_=${Date.now()}`);
      if (r.ok) setMemos((await r.json()).memos || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1800);
  }

  // 편집 중 자동 저장 (입력이 멎고 0.7초 뒤)
  function edit(patch: Partial<Memo>) {
    if (!open) return;
    const next = { ...open, ...patch };
    if (patch.content !== undefined) next.tags = tagsOf(patch.content);
    setOpen(next);
    setMemos((prev) => prev.map((m) => (m.id === next.id ? next : m)));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const r = await fetch(`/api/hub/memos/${next.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.title, content: next.content }),
      });
      if (r.ok) flashSaved();
    }, 700);
  }

  async function createMemo() {
    const r = await fetch("/api/hub/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", content: "" }),
    });
    if (!r.ok) {
      alert((await r.json().catch(() => ({}))).error || "메모를 만들지 못했습니다");
      return;
    }
    const m: Memo = await r.json();
    setMemos((prev) => [m, ...prev]);
    setOpen(m);
  }

  async function togglePin(m: Memo) {
    const r = await fetch(`/api/hub/memos/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !m.pinned }),
    });
    if (r.ok) load(q);
  }

  async function removeMemo(m: Memo) {
    if (!confirm("이 메모를 삭제할까요? 첨부한 사진도 함께 지워집니다.")) return;
    const r = await fetch(`/api/hub/memos/${m.id}`, { method: "DELETE" });
    if (r.ok) {
      setMemos((prev) => prev.filter((p) => p.id !== m.id));
      setOpen(null);
    }
  }

  async function attach(files: FileList | null) {
    if (!files || !open) return;
    const list = Array.from(files).slice(0, 10);
    setUploading(list.length);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "hub");
        const up = await fetch("/api/memo/upload", { method: "POST", body: fd });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) {
          alert("업로드 실패: " + (upData.error || up.status));
          break;
        }
        const r = await fetch("/api/hub/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: upData.url, memo_id: open.id, file_name: file.name, file_size: file.size }),
        });
        if (r.ok) {
          const photo: Photo = await r.json();
          setOpen((prev) => (prev ? { ...prev, photos: [...prev.photos, photo] } : prev));
          setMemos((prev) => prev.map((m) => (m.id === open.id ? { ...m, photos: [...m.photos, photo] } : m)));
        }
        setUploading((n) => n - 1);
      }
    } finally {
      setUploading(0);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function removePhoto(p: Photo) {
    if (!open) return;
    const r = await fetch(`/api/hub/photos/${p.id}`, { method: "DELETE" });
    if (r.ok) {
      setOpen((prev) => (prev ? { ...prev, photos: prev.photos.filter((x) => x.id !== p.id) } : prev));
      setMemos((prev) => prev.map((m) => (m.id === open.id ? { ...m, photos: m.photos.filter((x) => x.id !== p.id) } : m)));
    }
  }

  return (
    <div className="w-full flex flex-col gap-3 pb-28 md:pb-6">
      {/* 검색 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 border border-gray-300 bg-white rounded-full px-4 py-2.5">
          <span className="font-bold text-gray-900">#</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="태그나 내용으로 검색"
            className="flex-1 min-w-0 outline-none text-base bg-transparent"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="지우기" className="text-gray-400 px-1">
              ✕
            </button>
          )}
        </div>
        <button
          onClick={createMemo}
          className="hidden md:inline-flex px-3.5 py-2.5 rounded text-xs font-bold bg-[#FEE500] text-[#191919] hover:bg-[#f2da00] whitespace-nowrap"
        >
          + 새 메모
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center text-xs text-gray-400 py-10">불러오는 중…</div>
      ) : memos.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-12 border border-dashed border-gray-300 rounded-lg whitespace-pre-line">
          {q ? `'${q}' 로 찾은 메모가 없습니다` : "메모가 없습니다\n+ 를 눌러 적어보세요"}
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {memos.map((m) => (
            <button
              key={m.id}
              onClick={() => setOpen(m)}
              className="text-left border border-gray-200 bg-white rounded-lg p-3.5 flex flex-col gap-1.5 hover:border-gray-400"
            >
              <span className="text-[15px] font-bold text-gray-900 flex items-center gap-1.5">
                {m.pinned && <span className="text-xs">📌</span>}
                {m.title || "제목 없음"}
              </span>
              {stripTags(m.content) && (
                <span className="text-[13px] text-gray-500 line-clamp-2 whitespace-pre-line">{stripTags(m.content)}</span>
              )}
              {m.tags.length > 0 && (
                <span className="flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <em key={t} className="not-italic text-[11px] font-bold text-[#8a6d00]">
                      #{t}
                    </em>
                  ))}
                </span>
              )}
              <span className="flex gap-2.5 text-[11px] text-gray-400">
                <span>{when(m.updated_at)}</span>
                {m.photos.length > 0 && <span>🖼 {m.photos.length}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 새 메모 (폰) */}
      <button
        onClick={createMemo}
        aria-label="새 메모"
        style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
        className="md:hidden fixed right-5 w-14 h-14 rounded-full bg-[#FEE500] text-[#191919] text-3xl font-bold shadow-lg grid place-items-center leading-none"
      >
        +
      </button>

      {/* 편집 */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setOpen(null);
              load(q);
            }}
          />
          <div className="relative w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-xl p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs transition-opacity ${saved ? "opacity-100 text-gray-500" : "opacity-0"}`}>✓ 저장됨</span>
              <div className="flex items-center gap-1">
                <button onClick={() => togglePin(open)} aria-label="고정" className="w-9 h-9 grid place-items-center rounded-full hover:bg-gray-100 text-base">
                  {open.pinned ? "📌" : "📍"}
                </button>
                <button
                  onClick={() => removeMemo(open)}
                  aria-label="삭제"
                  className="w-9 h-9 grid place-items-center rounded-full hover:bg-red-50 text-red-500 text-sm"
                >
                  🗑
                </button>
                <button
                  onClick={() => {
                    setOpen(null);
                    load(q);
                  }}
                  aria-label="닫기"
                  className="w-9 h-9 grid place-items-center rounded-full hover:bg-gray-100 text-gray-400 text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            <input
              value={open.title}
              onChange={(e) => edit({ title: e.target.value })}
              placeholder="제목"
              className="text-xl font-bold outline-none w-full placeholder:text-gray-300"
            />
            <textarea
              value={open.content}
              onChange={(e) => edit({ content: e.target.value })}
              placeholder="내용을 입력하세요. #여행 처럼 적으면 태그가 됩니다."
              rows={7}
              className="text-base leading-relaxed outline-none w-full resize-y placeholder:text-gray-300"
            />

            <div className="flex flex-wrap items-center gap-1.5 bg-[#FEE500]/25 rounded-lg px-3 py-2.5">
              <span className="text-[11px] font-bold text-gray-900">태그</span>
              {open.tags.length === 0 ? (
                <span className="text-[11.5px] text-gray-500">본문에 #태그 를 적으면 여기에 모입니다</span>
              ) : (
                <>
                  {open.tags.map((t) => (
                    <em key={t} className="not-italic text-[11.5px] font-bold bg-white rounded-full px-2 py-0.5">
                      #{t}
                    </em>
                  ))}
                  {open.photos.length > 0 && (
                    <span className="text-[11.5px] text-gray-600">첨부 {open.photos.length}장에도 적용됨</span>
                  )}
                </>
              )}
            </div>

            {uploading > 0 && <div className="text-xs text-gray-500">사진 올리는 중… {uploading}장 남음</div>}

            {open.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {open.photos.map((p) => (
                  <div key={p.id} className="relative aspect-square rounded overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.file_name || "첨부 사진"} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(p)}
                      aria-label="사진 삭제"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/55 text-white text-[10px] grid place-items-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => cameraRef.current?.click()} className="border border-gray-300 rounded py-2.5 text-xs">
                📷 촬영
              </button>
              <button onClick={() => fileRef.current?.click()} className="border border-gray-300 rounded py-2.5 text-xs">
                🖼 앨범
              </button>
              <button onClick={() => fileRef.current?.click()} className="border border-gray-300 rounded py-2.5 text-xs">
                📁 파일
              </button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => attach(e.target.files)} />
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => attach(e.target.files)} />
          </div>
        </div>
      )}
    </div>
  );
}
