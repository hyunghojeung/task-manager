"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBackToClose } from "../useBackToClose";
import LinkCard, { type LinkPreview } from "./LinkCard";
import BlockEditor from "./BlockEditor";
import { extractUrls, textOnly } from "@/lib/memo-text";

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
  link_previews?: LinkPreview[];
  updated_at: string;
  photos: Photo[];
}
/** 편집 중인 내용. id 가 없으면 아직 등록 전이다. */
interface Draft {
  id: string | null;
  title: string;
  content: string;
  tagText: string;
  pinned: boolean;
  share_token: string | null;
  previews: LinkPreview[];
  photos: Photo[];
}

/** "여행 바다" → ["여행","바다"]. 앞의 # 은 떼고 중복은 없앤다 */
function parseTags(text: string) {
  const out: string[] = [];
  text.split(/[\s,]+/).forEach((r) => {
    const t = r.replace(/^#+/, "").trim();
    if (t && !out.includes(t)) out.push(t);
  });
  return out;
}
function when(iso: string) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString())
    return `오늘 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
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

export default function MemoView() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [fetchingUrls, setFetchingUrls] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previewCache = useRef<Map<string, LinkPreview | null>>(new Map());

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

  // ----- 본문에 적은 주소의 미리보기를 읽어온다 -----
  // 주소는 본문 속 제자리에 그대로 두고, 편집기가 그 자리를 카드로 보여준다.
  const draftContent = draft?.content ?? "";
  const draftOpen = draft !== null;
  useEffect(() => {
    if (!draftOpen) return;
    const urls = extractUrls(draftContent);
    if (urls.length === 0) return;

    const t = setTimeout(async () => {
      // 이미 읽어 둔 것은 바로 채운다
      setDraft((d) => {
        if (!d) return d;
        const add = urls
          .map((u) => previewCache.current.get(u))
          .filter((p): p is LinkPreview => !!p && !d.previews.some((x) => x.url === p.url));
        return add.length ? { ...d, previews: [...d.previews, ...add] } : d;
      });

      const missing = urls.filter((u) => !previewCache.current.has(u));
      if (missing.length === 0) return;
      setFetchingUrls(missing);
      await Promise.all(
        missing.map(async (u) => {
          try {
            const r = await fetch(`/api/hub/link-preview?url=${encodeURIComponent(u)}`);
            const data = r.ok ? (await r.json()).preview : null;
            previewCache.current.set(u, data);
            if (data) {
              setDraft((d) => (d && !d.previews.some((p) => p.url === u) ? { ...d, previews: [...d.previews, data] } : d));
            }
          } catch {
            previewCache.current.set(u, null);
          }
        }),
      );
      setFetchingUrls([]);
    }, 700);
    return () => clearTimeout(t);
  }, [draftContent, draftOpen]);

  function edit(patch: Partial<Draft>) {
    // 같은 순간에 두 번 불려도 서로 덮어쓰지 않게 최신 상태 기준으로 합친다
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  }

  function payload(d: Draft) {
    return {
      title: d.title,
      content: d.content,
      tags: parseTags(d.tagText),
      link_previews: d.previews,
    };
  }

  /** 사진을 붙이거나 공유하려면 메모가 먼저 있어야 해서, 없으면 조용히 만들어 둔다 */
  async function ensureSaved(): Promise<string | null> {
    if (!draft) return null;
    if (draft.id) {
      await fetch(`/api/hub/memos/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(draft)),
      });
      return draft.id;
    }
    const r = await fetch("/api/hub/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(draft)),
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

  useBackToClose(draft !== null, close);

  function openMemo(m: Memo) {
    (m.link_previews || []).forEach((p) => previewCache.current.set(p.url, p));
    setDraft({
      id: m.id,
      title: m.title,
      content: m.content,
      tagText: (m.tags || []).join(" "),
      pinned: m.pinned,
      share_token: m.share_token ?? null,
      previews: m.link_previews || [],
      photos: m.photos,
    });
    setDirty(false);
  }
  function newMemo() {
    setDraft({ id: null, title: "", content: "", tagText: "", pinned: false, share_token: null, previews: [], photos: [] });
    setDirty(false);
  }

  async function togglePin() {
    if (!draft) return;
    const next = !draft.pinned;
    setDraft({ ...draft, pinned: next });
    if (!draft.id) {
      setDirty(true);
      return;
    }
    const r = await fetch(`/api/hub/memos/${draft.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: next }),
    });
    if (r.ok) setMemos((prev) => prev.map((p) => (p.id === draft.id ? { ...p, pinned: next } : p)));
    else {
      setDraft((d) => (d ? { ...d, pinned: !next } : d));
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

  const draftTags = draft ? parseTags(draft.tagText) : [];

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
              {textOnly(m.content) && (
                <span className="text-[13px] text-gray-500 line-clamp-2 whitespace-pre-line">{textOnly(m.content)}</span>
              )}
              {(m.link_previews || []).length > 0 && <LinkCard preview={m.link_previews![0]} compact />}
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
                  className={`w-9 h-9 grid place-items-center rounded-full text-base ${draft.pinned ? "bg-[#FEE500]/40" : "hover:bg-gray-100"}`}
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
              className="text-xl font-bold outline-none w-full placeholder:text-gray-300 border-b border-gray-200 pb-2.5"
            />

            {/* 본문 — 주소를 적으면 그 자리가 카드로 바뀌고, 아래에 글을 계속 쓸 수 있다 */}
            <BlockEditor
              key={draft.id ?? "new"}
              content={draft.content}
              previews={draft.previews}
              loadingUrls={fetchingUrls}
              onChange={(c) => edit({ content: c })}
              onRemoveLink={(u) => {
                setDraft((d) => (d ? { ...d, previews: d.previews.filter((x) => x.url !== u) } : d));
                setDirty(true);
              }}
              placeholder="내용을 입력하세요. 주소를 적으면 그 자리에 미리보기 카드가 붙습니다."
            />

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

            {/* 태그 입력 */}
            <div className="flex flex-col gap-1.5 bg-[#FEE500]/25 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-900 shrink-0">태그</span>
                <input
                  value={draft.tagText}
                  onChange={(e) => edit({ tagText: e.target.value })}
                  placeholder="띄어쓰기로 구분 — 예: 여행 바다"
                  className="flex-1 min-w-0 bg-white/70 rounded px-2.5 py-1.5 text-sm outline-none focus:bg-white placeholder:text-gray-400"
                />
              </div>
              {draftTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {draftTags.map((t) => (
                    <em key={t} className="not-italic text-[11.5px] font-bold bg-white rounded-full px-2 py-0.5">
                      #{t}
                    </em>
                  ))}
                  {draft.photos.length > 0 && <span className="text-[11.5px] text-gray-600">첨부 {draft.photos.length}장에도 적용됨</span>}
                </div>
              )}
            </div>

            {dirty && <span className="text-[11.5px] text-gray-400">저장하지 않은 변경이 있습니다</span>}
            {draft.share_token && (
              <span className="text-[11.5px] text-gray-500">
                🔗 <b className="text-gray-800">공유 중</b> — 링크를 가진 사람은 로그인 없이 볼 수 있습니다
              </span>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                {draft.share_token ? (
                  <>
                    <button onClick={copyShareLink} className="px-3 py-2.5 rounded bg-[#FEE500] text-[#191919] text-xs font-bold">
                      🔗 링크 복사
                    </button>
                    <button onClick={stopShare} className="px-2 py-2.5 text-xs text-gray-500 underline underline-offset-2">
                      공유 중지
                    </button>
                  </>
                ) : (
                  <button onClick={startShare} className="px-3 py-2.5 rounded border border-gray-300 text-xs text-gray-600">
                    🔗 링크로 공유
                  </button>
                )}
              </div>
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
