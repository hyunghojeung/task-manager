"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBackToClose } from "../useBackToClose";

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
  share_token?: string | null;
  updated_at: string;
  photos: Photo[];
}
/** 편집 중인 내용. id 가 없으면 아직 등록 전이다. */
interface Draft {
  id: string | null;
  title: string;
  content: string;
  pinned: boolean;
  share_token: string | null;
  photos: Photo[];
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 방법으로 다시 시도 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
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
  if (d.toDateString() === new Date().toDateString())
    return `오늘 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function MemoView() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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

  function edit(patch: Partial<Draft>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setDirty(true);
  }

  /** 사진을 붙이려면 메모가 먼저 있어야 해서, 없으면 조용히 만들어 둔다 */
  async function ensureSaved(): Promise<string | null> {
    if (!draft) return null;
    if (draft.id) {
      await fetch(`/api/hub/memos/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.title, content: draft.content }),
      });
      return draft.id;
    }
    const r = await fetch("/api/hub/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title, content: draft.content }),
    });
    if (!r.ok) {
      alert((await r.json().catch(() => ({}))).error || "메모를 저장하지 못했습니다");
      return null;
    }
    const created: Memo = await r.json();
    setDraft((d) => (d ? { ...d, id: created.id } : d));
    return created.id;
  }

  async function save() {
    if (!draft || saving) return;
    if (!draft.title.trim() && !draft.content.trim() && draft.photos.length === 0) {
      alert("내용을 입력하세요");
      return;
    }
    setSaving(true);
    try {
      const id = await ensureSaved();
      if (!id) return;
      // 등록 전에 켜 둔 고정을 여기서 반영한다
      if (draft.pinned) {
        await fetch(`/api/hub/memos/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: true }),
        });
      }
      setDirty(false);
      setDraft(null);
      await load(q);
    } finally {
      setSaving(false);
    }
  }

  const close = useCallback(() => {
    if (dirty && !confirm("저장하지 않고 닫을까요? 적은 내용이 사라집니다.")) return false;
    setDraft(null);
    setDirty(false);
    load(q);
    return true;
  }, [dirty, load, q]);

  // 폰 뒤로가기로 편집 창만 닫고 메모 목록에 남는다
  useBackToClose(draft !== null, close);

  function openMemo(m: Memo) {
    setDraft({
      id: m.id,
      title: m.title,
      content: m.content,
      pinned: m.pinned,
      share_token: m.share_token ?? null,
      photos: m.photos,
    });
    setDirty(false);
  }
  function newMemo() {
    setDraft({ id: null, title: "", content: "", pinned: false, share_token: null, photos: [] });
    setDirty(false);
  }

  /** 링크 공유 켜기 — 없으면 만들고, 있으면 그대로 쓴다 */
  async function startShare() {
    if (!draft) return;
    const id = draft.id || (await ensureSaved());
    if (!id) return;
    const r = await fetch(`/api/hub/memos/${id}/share`, { method: "POST" });
    if (!r.ok) {
      alert((await r.json().catch(() => ({}))).error || "공유 링크를 만들지 못했습니다");
      return;
    }
    const { share_token } = await r.json();
    setDraft((d) => (d ? { ...d, id, share_token } : d));
    setMemos((prev) => prev.map((p) => (p.id === id ? { ...p, share_token } : p)));
  }

  async function stopShare() {
    if (!draft?.id) return;
    if (!confirm("공유를 중지할까요? 이미 보낸 링크가 더 이상 열리지 않습니다.")) return;
    const r = await fetch(`/api/hub/memos/${draft.id}/share`, { method: "DELETE" });
    if (r.ok) {
      setDraft((d) => (d ? { ...d, share_token: null } : d));
      setMemos((prev) => prev.map((p) => (p.id === draft.id ? { ...p, share_token: null } : p)));
    }
  }

  async function copyShareLink() {
    if (!draft?.share_token) return;
    const url = `${window.location.origin}/s/${draft.share_token}`;
    const ok = await copyText(url);
    alert(ok ? "링크를 복사했습니다" : url);
  }

  /** 지금 보고 있는 화면의 고정 아이콘을 먼저 바꾸고, 뒤이어 서버에 반영한다 */
  async function togglePin() {
    if (!draft) return;
    const next = !draft.pinned;
    setDraft({ ...draft, pinned: next });

    // 아직 등록 전이면 저장할 때 함께 반영한다
    if (!draft.id) {
      setDirty(true);
      return;
    }

    const r = await fetch(`/api/hub/memos/${draft.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: next }),
    });
    if (r.ok) {
      setMemos((prev) => prev.map((p) => (p.id === draft.id ? { ...p, pinned: next } : p)));
    } else {
      setDraft((d) => (d ? { ...d, pinned: !next } : d)); // 실패하면 되돌린다
      alert("고정 상태를 바꾸지 못했습니다");
    }
  }

  async function removeMemo(id: string) {
    if (!confirm("이 메모를 삭제할까요? 첨부한 사진도 함께 지워집니다.")) return;
    const r = await fetch(`/api/hub/memos/${id}`, { method: "DELETE" });
    if (r.ok) {
      setMemos((prev) => prev.filter((p) => p.id !== id));
      setDraft(null);
      setDirty(false);
    }
  }

  async function attach(files: FileList | null) {
    if (!files || !draft) return;
    const memoId = await ensureSaved();
    if (!memoId) return;

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
          body: JSON.stringify({ url: upData.url, memo_id: memoId, file_name: file.name, file_size: file.size }),
        });
        if (r.ok) {
          const photo: Photo = await r.json();
          setDraft((d) => (d ? { ...d, photos: [...d.photos, photo] } : d));
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
    const r = await fetch(`/api/hub/photos/${p.id}`, { method: "DELETE" });
    if (r.ok) setDraft((d) => (d ? { ...d, photos: d.photos.filter((x) => x.id !== p.id) } : d));
  }

  const draftTags = draft ? tagsOf(draft.content) : [];

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
          onClick={newMemo}
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
              onClick={() => openMemo(m)}
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
                {m.share_token && <span className="text-[#8a6d00] font-bold">🔗 공유 중</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 새 메모 (폰) */}
      <button
        onClick={newMemo}
        aria-label="새 메모"
        style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
        className="md:hidden fixed right-5 w-14 h-14 rounded-full bg-[#FEE500] text-[#191919] text-3xl font-bold shadow-lg grid place-items-center leading-none"
      >
        +
      </button>

      {/* 편집 */}
      {draft && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-xl p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-gray-900">{draft.id ? "메모 수정" : "새 메모"}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={togglePin}
                  aria-pressed={draft.pinned}
                  aria-label={draft.pinned ? "고정 해제" : "고정"}
                  title={draft.pinned ? "고정 해제" : "고정"}
                  className={`w-9 h-9 grid place-items-center rounded-full text-base ${
                    draft.pinned ? "bg-[#FEE500]/40" : "hover:bg-gray-100"
                  }`}
                >
                  {draft.pinned ? "📌" : "📍"}
                </button>
                <button
                  onClick={close}
                  aria-label="닫기"
                  className="w-9 h-9 grid place-items-center rounded-full hover:bg-gray-100 text-gray-400 text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            <input
              value={draft.title}
              onChange={(e) => edit({ title: e.target.value })}
              placeholder="제목"
              className="text-xl font-bold outline-none w-full placeholder:text-gray-300 md:border-b md:border-gray-200 md:pb-2.5"
            />
            <textarea
              value={draft.content}
              onChange={(e) => edit({ content: e.target.value })}
              placeholder="내용을 입력하세요. #여행 처럼 적으면 태그가 됩니다."
              rows={7}
              className="text-base leading-relaxed outline-none w-full resize-y placeholder:text-gray-300"
            />

            <div className="flex flex-wrap items-center gap-1.5 bg-[#FEE500]/25 rounded-lg px-3 py-2.5">
              <span className="text-[11px] font-bold text-gray-900">태그</span>
              {draftTags.length === 0 ? (
                <span className="text-[11.5px] text-gray-500">본문에 #태그 를 적으면 여기에 모입니다</span>
              ) : (
                <>
                  {draftTags.map((t) => (
                    <em key={t} className="not-italic text-[11.5px] font-bold bg-white rounded-full px-2 py-0.5">
                      #{t}
                    </em>
                  ))}
                  {draft.photos.length > 0 && (
                    <span className="text-[11.5px] text-gray-600">첨부 {draft.photos.length}장에도 적용됨</span>
                  )}
                </>
              )}
            </div>

            {uploading > 0 && <div className="text-xs text-gray-500">사진 올리는 중… {uploading}장 남음</div>}

            {draft.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {draft.photos.map((p) => (
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

            {/* 링크 공유 */}
            {draft.share_token ? (
              <div className="flex flex-col gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900 shrink-0">🔗 공유 중</span>
                  <span className="text-[11px] text-gray-500 font-mono truncate">/s/{draft.share_token}</span>
                </div>
                <p className="text-[11.5px] text-gray-500 leading-relaxed">
                  이 링크를 가진 사람은 <b className="text-gray-800">로그인 없이</b> 제목·내용·첨부 사진을 볼 수 있습니다. 고치거나 지울 수는 없습니다.
                </p>
                <div className="flex gap-2">
                  <button onClick={copyShareLink} className="flex-1 py-2 rounded bg-[#FEE500] text-[#191919] text-xs font-bold">
                    링크 복사
                  </button>
                  <button onClick={stopShare} className="px-3 py-2 rounded border border-gray-300 text-xs text-gray-600">
                    공유 중지
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={startShare} className="self-start text-xs text-gray-600 border border-gray-300 rounded px-3 py-2">
                🔗 링크로 공유
              </button>
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

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 mt-1">
              <span className="text-[11.5px] text-gray-400">{dirty ? "저장하지 않은 변경이 있습니다" : ""}</span>
              <div className="flex gap-2">
                {draft.id && (
                  <button
                    onClick={() => removeMemo(draft.id!)}
                    className="px-4 py-2.5 rounded border border-red-300 text-red-600 text-sm hover:bg-red-50"
                  >
                    삭제
                  </button>
                )}
                <button onClick={close} className="px-4 py-2.5 rounded border border-gray-300 text-sm">
                  취소
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-6 py-2.5 rounded bg-[#FEE500] text-[#191919] text-sm font-bold disabled:opacity-50"
                >
                  {saving ? "저장 중…" : draft.id ? "저장" : "등록"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
