"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBackToClose } from "../useBackToClose";

interface Album {
  id: string;
  name: string;
  count: number;
  cover: string | null;
  tags: string[];
}
interface Photo {
  id: string;
  url: string;
  file_name: string | null;
  caption: string | null;
  tags: string[];
  album_id: string | null;
  memo_id: string | null;
  source: "album" | "memo";
  source_name: string;
}

/**
 * 앨범 기능 감추기.
 * 지우지 않고 꺼 둔 것이라 true 로 바꾸면 앨범 목록·앨범 지정 업로드가 다시 나온다.
 */
const SHOW_ALBUMS = false;

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

export default function GalleryView() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"album" | "all">(SHOW_ALBUMS ? "album" : "all");
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<number | null>(null);
  const [upload, setUpload] = useState<{ album: string; tags: string } | null>(null);
  const [busy, setBusy] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const loadAlbums = useCallback(async () => {
    const r = await fetch(`/api/hub/albums?_=${Date.now()}`);
    if (r.ok) setAlbums((await r.json()).albums || []);
  }, []);

  const loadPhotos = useCallback(async (albumId?: string, keyword?: string) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (albumId) p.set("album", albumId);
      if (keyword) {
        p.set("q", keyword);
        // 갤러리 검색은 갤러리에 올린 사진만 — 메모 첨부 사진은 개인메모에서 찾는다
        p.set("source", "gallery");
      }
      const r = await fetch(`/api/hub/photos?${p.toString()}&_=${Date.now()}`);
      if (r.ok) setPhotos((await r.json()).photos || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (SHOW_ALBUMS) loadAlbums();
  }, [loadAlbums]);

  useEffect(() => {
    const t = setTimeout(() => {
      const kw = q.replace(/^#/, "").trim();
      if (kw) loadPhotos(undefined, kw);
      else if (openAlbum) loadPhotos(openAlbum.id);
      else if (mode === "all") loadPhotos();
      else setPhotos([]);
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, openAlbum, mode, loadPhotos]);

  const searching = q.replace(/^#/, "").trim().length > 0;
  const showGrid = searching || mode === "all" || !!openAlbum;

  const closeViewer = useCallback(() => setViewer(null), []);
  const closeUpload = useCallback(() => setUpload(null), []);
  useBackToClose(viewer !== null, closeViewer);
  useBackToClose(upload !== null && busy === 0, closeUpload);

  async function doUpload(files: FileList | null) {
    if (!files || !upload) return;
    const list = Array.from(files).slice(0, 20);
    setBusy(list.length);

    let albumId: string | null = null;
    const name = upload.album.trim();
    if (name) {
      const r = await fetch("/api/hub/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (r.ok) albumId = (await r.json()).id;
    }
    const tags = upload.tags.split(/\s+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);

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
        await fetch("/api/hub/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: upData.url, album_id: albumId, tags, file_name: file.name, file_size: file.size }),
        });
        setBusy((n) => n - 1);
      }
    } finally {
      setBusy(0);
      setUpload(null);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (SHOW_ALBUMS) await loadAlbums();
      if (openAlbum) loadPhotos(openAlbum.id);
      else if (mode === "all") loadPhotos();
    }
  }

  async function removePhoto(p: Photo) {
    if (!confirm("이 사진을 지울까요?")) return;
    const r = await fetch(`/api/hub/photos/${p.id}`, { method: "DELETE" });
    if (r.ok) {
      setPhotos((prev) => prev.filter((x) => x.id !== p.id));
      setViewer(null);
      if (SHOW_ALBUMS) loadAlbums();
    }
  }

  async function removeAlbum(a: Album) {
    if (!confirm(`앨범 "${a.name}"을 지울까요?\n사진은 지워지지 않고 전체 보기에 남습니다.`)) return;
    const r = await fetch(`/api/hub/albums/${a.id}`, { method: "DELETE" });
    if (r.ok) {
      setOpenAlbum(null);
      loadAlbums();
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
            placeholder="태그로 검색 — 갤러리에 올린 사진"
            className="flex-1 min-w-0 outline-none text-base bg-transparent"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="지우기" className="text-gray-400 px-1">
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => setUpload({ album: openAlbum?.name || "", tags: "" })}
          className="hidden md:inline-flex px-3.5 py-2.5 rounded text-xs font-bold bg-[#FEE500] text-[#191919] hover:bg-[#f2da00] whitespace-nowrap"
        >
          + 사진 올리기
        </button>
      </div>

      {/* 머리말 — 앨범을 감춘 동안에는 보여줄 것이 없다 */}
      {SHOW_ALBUMS && !searching && (
        <div className="flex items-center justify-between gap-2">
          {openAlbum ? (
            <button onClick={() => setOpenAlbum(null)} className="text-sm font-bold text-gray-900">
              ‹ 앨범 <span className="text-gray-500 font-medium">· {openAlbum.name} {openAlbum.count}장</span>
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={() => setMode("album")}
                className={`px-3 py-1.5 rounded text-xs ${mode === "album" ? "bg-[#FEE500] text-[#191919] font-bold" : "text-gray-500 border border-gray-300"}`}
              >
                앨범
              </button>
              <button
                onClick={() => setMode("all")}
                className={`px-3 py-1.5 rounded text-xs ${mode === "all" ? "bg-[#FEE500] text-[#191919] font-bold" : "text-gray-500 border border-gray-300"}`}
              >
                전체 보기
              </button>
            </div>
          )}
          {openAlbum && (
            <button onClick={() => removeAlbum(openAlbum)} className="text-xs text-red-500 border border-red-200 rounded px-2.5 py-1">
              앨범 삭제
            </button>
          )}
        </div>
      )}

      {searching && (
        <p className="text-xs text-gray-500">
          <b className="text-gray-900">#{q.replace(/^#/, "")}</b> — 갤러리 사진 {photos.length}장
        </p>
      )}

      {/* 앨범 목록 */}
      {SHOW_ALBUMS && !showGrid && (
        albums.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-12 border border-dashed border-gray-300 rounded-lg whitespace-pre-line">
            {"앨범이 없습니다\n+ 를 눌러 사진을 올려보세요"}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {albums.map((a) => (
              <button key={a.id} onClick={() => setOpenAlbum(a)} className="flex flex-col gap-1.5 text-left">
                <span className="aspect-square rounded-lg overflow-hidden bg-gray-200 block">
                  {a.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.cover} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full grid place-items-center text-gray-400 text-xs">비어 있음</span>
                  )}
                </span>
                <span className="text-sm font-bold text-gray-900 truncate">{a.name}</span>
                <span className="text-[11px] text-gray-400">{a.count}장</span>
                {a.tags.length > 0 && (
                  <span className="text-[11px] text-[#8a6d00] font-bold truncate">
                    {a.tags.map((t) => `#${t}`).join(" ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {/* 사진 격자 */}
      {showGrid &&
        (loading ? (
          <div className="text-center text-xs text-gray-400 py-10">불러오는 중…</div>
        ) : photos.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-12 border border-dashed border-gray-300 rounded-lg">
            {searching ? `'#${q.replace(/^#/, "")}' 로 찾은 사진이 없습니다` : "사진이 없습니다"}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 xl:grid-cols-8 gap-1.5">
            {photos.map((p, i) => (
              <button key={p.id} onClick={() => setViewer(i)} className="relative aspect-square rounded overflow-hidden bg-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || p.file_name || "사진"} className="w-full h-full object-cover" loading="lazy" />
                {p.source === "memo" && (
                  <span className="absolute left-1 bottom-1 text-[9px] font-bold bg-[#FEE500] text-[#191919] rounded px-1">메모</span>
                )}
              </button>
            ))}
          </div>
        ))}

      {/* 올리기 (폰) */}
      <button
        onClick={() => setUpload({ album: openAlbum?.name || "", tags: "" })}
        aria-label="사진 올리기"
        style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
        className="md:hidden fixed right-5 w-14 h-14 rounded-full bg-[#FEE500] text-[#191919] text-3xl font-bold shadow-lg grid place-items-center leading-none"
      >
        +
      </button>

      {/* 업로드 창 */}
      {upload && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => busy === 0 && setUpload(null)} />
          <div className="relative w-full md:max-w-md bg-white rounded-t-2xl md:rounded-xl p-5 flex flex-col gap-3.5">
            <h3 className="text-lg font-bold pr-10">사진 올리기</h3>
            <button
              onClick={() => busy === 0 && setUpload(null)}
              aria-label="닫기"
              className="absolute right-3 top-3 w-9 h-9 grid place-items-center rounded-full text-gray-400 hover:bg-gray-100 text-lg"
            >
              ✕
            </button>
            {SHOW_ALBUMS && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-600">앨범</span>
                <input
                  value={upload.album}
                  onChange={(e) => setUpload({ ...upload, album: e.target.value })}
                  list="hub-albums"
                  placeholder="예: 제주 여행"
                  className="border border-gray-300 rounded px-3 py-2.5 text-base outline-none focus:border-gray-900"
                />
                <datalist id="hub-albums">
                  {albums.map((a) => (
                    <option key={a.id} value={a.name} />
                  ))}
                </datalist>
                <span className="text-[11px] text-gray-400">없는 이름을 적으면 새 앨범이 만들어집니다. 비워두면 앨범 없이 올라갑니다.</span>
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">태그</span>
              <input
                value={upload.tags}
                onChange={(e) => setUpload({ ...upload, tags: e.target.value })}
                placeholder="#여행 #바다"
                className="border border-gray-300 rounded px-3 py-2.5 text-base outline-none focus:border-gray-900"
              />
              <span className="text-[11px] text-gray-400">공백으로 구분해 여러 개. 메모의 #태그와 같은 검색에 걸립니다.</span>
            </label>
            {busy > 0 ? (
              <p className="text-sm text-gray-600 text-center py-2">올리는 중… {busy}장 남음</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="py-3 rounded border border-gray-300 text-sm font-medium"
                >
                  📷 사진 찍기
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="py-3 rounded bg-[#FEE500] text-[#191919] text-sm font-bold"
                >
                  🖼 사진 고르기
                </button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => doUpload(e.target.files)} />
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => doUpload(e.target.files)} />
          </div>
        </div>
      )}

      {/* 사진 뷰어 */}
      {viewer !== null && photos[viewer] && (
        <div className="fixed inset-0 z-[70] bg-[#101010] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 text-gray-200 text-sm">
            <button onClick={() => setViewer(null)} aria-label="닫기" className="w-9 h-9 grid place-items-center text-xl">
              ✕
            </button>
            <span>
              {viewer + 1} / {photos.length}
            </span>
            <button
              onClick={() => setViewer((v) => ((v ?? 0) + 1) % photos.length)}
              aria-label="다음"
              className="w-9 h-9 grid place-items-center text-xl"
            >
              ›
            </button>
          </div>
          <div className="flex-1 min-h-0 grid place-items-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[viewer].url}
              alt={photos[viewer].caption || photos[viewer].file_name || "사진"}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="px-5 py-4 text-gray-300 text-xs flex flex-col gap-2" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            <span className="text-gray-100 text-sm">{photos[viewer].file_name || "사진"}</span>
            {(photos[viewer].source === "memo" || SHOW_ALBUMS) && (
              <span>
                {photos[viewer].source === "memo"
                  ? `메모 「${photos[viewer].source_name}」의 첨부 사진`
                  : `앨범 「${photos[viewer].source_name}」`}
              </span>
            )}
            {photos[viewer].tags.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {photos[viewer].tags.map((t) => (
                  <em key={t} className="not-italic bg-[#FEE500]/20 text-[#FEE500] rounded-full px-2 py-0.5">
                    #{t}
                  </em>
                ))}
              </span>
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                onClick={async () => {
                  const ok = await copyText(photos[viewer].url);
                  alert(ok ? "사진 링크를 복사했습니다" : photos[viewer].url);
                }}
                className="border border-[#FEE500]/60 text-[#FEE500] rounded px-3 py-1.5"
              >
                🔗 사진 링크 복사
              </button>
              <button
                onClick={() => removePhoto(photos[viewer])}
                className="border border-red-400/50 text-red-300 rounded px-3 py-1.5"
              >
                사진 삭제
              </button>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              복사한 링크는 로그인 없이 이 사진만 열립니다. 한 번 만들어진 주소는 사진을 지워야 막힙니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
