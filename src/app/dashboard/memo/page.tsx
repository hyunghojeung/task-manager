"use client";

import { useState, useEffect, useRef } from "react";

type View = "list" | "write" | "view" | "edit";
interface FileInfo { name: string; url: string; size: number }
interface MemoData { id: string; title: string; content: string; created_at: string; images?: string[]; attachments?: FileInfo[]; users?: { name: string; user_id: string } }

export default function MemoPage() {
  const [view, setView] = useState<View>("list");
  const [memos, setMemos] = useState<MemoData[]>([]);
  const [current, setCurrent] = useState<MemoData | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [isPwindow, setIsPwindow] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const cookies = document.cookie.split(";").map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith("session="));
      if (sessionCookie) {
        const decoded = decodeURIComponent(sessionCookie.split("=").slice(1).join("="));
        const session = JSON.parse(decoded);
        setCurrentUser(`${session.user?.name || ""}(${session.user?.user_id || ""})`);
        setIsPwindow(session.company?.company_id === "pwindow");
      }
    } catch { /* ignore */ }
  }, []);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch(`/api/memos?page=${page}&_=${Date.now()}`).then(r => r.json()).then(d => {
      setMemos(d.data || []); setTotal(d.total || 0);
    });
  }, [page, refreshKey]);

  async function uploadToDropbox(file: File, folder: string): Promise<{ url: string; name: string; size: number } | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const res = await fetch("/api/memo/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { alert("업로드 실패: " + (data.error || res.status)); return null; }
    return { url: data.url, name: file.name, size: file.size };
  }

  // 본문 이미지 붙여넣기 (pwindow만)
  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!isPwindow) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        setUploading(true);
        const result = await uploadToDropbox(file, "body");
        setUploading(false);
        if (result) setImages(prev => [...prev, result.url]);
      }
    }
  }

  // 이미지 첨부 버튼 (본문 이미지)
  async function handleImageAttach(file: File) {
    if (!isPwindow) return;
    setUploading(true);
    const result = await uploadToDropbox(file, "body");
    setUploading(false);
    if (result) setImages(prev => [...prev, result.url]);
  }

  // 파일 첨부 (모든 파일)
  async function handleFileAttach(files: FileList | File[]) {
    if (!isPwindow) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const result = await uploadToDropbox(file, "file");
      if (result) setAttachments(prev => [...prev, result]);
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!title) { alert("제목을 입력해주세요."); return; }
    const isEdit = view === "edit" && current;
    const url = isEdit ? `/api/memos/${current!.id}` : "/api/memos";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, images, attachments }) });
    if (res.ok) { resetForm(); setView("list"); setRefreshKey(k => k + 1); }
    else alert("저장 실패");
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/memos/${id}`, { method: "DELETE" });
    setView("list"); setRefreshKey(k => k + 1);
  }

  function resetForm() { setTitle(""); setContent(""); setImages([]); setAttachments([]); }
  function openView(m: MemoData) { setCurrent(m); setView("view"); }
  function openEdit() {
    if (current) {
      setTitle(current.title); setContent(current.content || "");
      setImages(current.images || []); setAttachments(current.attachments || []);
      setView("edit");
    }
  }
  function openWrite() { resetForm(); setCurrent(null); setView("write"); }

  const totalPages = Math.ceil(total / 15);

  // 글쓰기/수정
  if (view === "write" || view === "edit") {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">{view === "edit" ? "메모 수정" : "메모 작성"}</h3>
          <label className="block text-xs font-semibold text-gray-600 mb-1">작성자</label>
          <input type="text" value={currentUser} readOnly className="w-full px-3 py-2 border border-gray-200 rounded text-sm mb-3 bg-gray-50 text-gray-500" />
          <label className="block text-xs font-semibold text-gray-600 mb-1">제목</label>
          <input type="text" placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-3" />
          <label className="block text-xs font-semibold text-gray-600 mb-1">내용</label>
          <textarea
            ref={contentRef}
            placeholder={isPwindow ? "내용을 입력하세요. 이미지를 붙여넣기(Ctrl+V)할 수 있습니다." : "내용"}
            value={content}
            onChange={e => setContent(e.target.value)}
            onPaste={handlePaste}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm min-h-[250px] resize-y"
          />
          {isPwindow && (
            <div className="mt-2 flex items-center gap-2">
              <label className="px-3 py-1 bg-gray-600 text-white rounded text-xs cursor-pointer hover:bg-gray-700">
                이미지 첨부
                <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImageAttach(e.target.files[0]); e.target.value = ""; }} />
              </label>
              {uploading && <span className="text-xs text-gray-400">업로드 중...</span>}
              <span className="text-[10px] text-gray-400">Ctrl+V로 캡처 이미지 붙여넣기 가능</span>
            </div>
          )}
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`첨부${i+1}`} className="w-24 h-24 object-cover rounded border border-gray-300" />
                  <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs leading-4 text-center opacity-0 group-hover:opacity-100 transition">×</button>
                </div>
              ))}
            </div>
          )}
          {/* 첨부파일 영역 */}
          {isPwindow ? (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">첨부파일</label>
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleFileAttach(e.dataTransfer.files); }}
                className={`block border-2 border-dashed rounded p-3 text-center text-xs cursor-pointer transition ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 text-gray-400 hover:border-blue-500"}`}
              >
                <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) handleFileAttach(e.target.files); e.target.value = ""; }} />
                {uploading ? "업로드 중..." : "+ 파일을 드래그하여 놓거나 클릭하여 첨부"}
              </label>
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((a, i) => (
                    <li key={i} className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded">
                      <a href={`/api/memo/download?url=${encodeURIComponent(a.url)}&name=${encodeURIComponent(a.name)}`} className="text-blue-600 hover:underline truncate flex-1">{a.name}</a>
                      <span className="text-gray-400 mx-2">{(a.size / 1024).toFixed(1)} KB</span>
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700">삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              ⓘ 첨부파일 기능과 본문 이미지 복사붙혀넣기 기능은 현재 준비중입니다
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={uploading} className="px-6 py-2 bg-emerald-600 text-white rounded text-sm disabled:opacity-50">저장</button>
            <button onClick={() => setView("list")} className="px-6 py-2 border border-gray-300 rounded text-sm">취소</button>
          </div>
        </div>
      </div>
    );
  }

  // 글 상세
  if (view === "view" && current) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2">{current.title}</h3>
          <p className="text-xs text-gray-400 mb-4 pb-3 border-b border-gray-200">작성자: {current.users ? `${current.users.name}(${current.users.user_id})` : "-"} | 작성일: {current.created_at?.slice(0, 16).replace("T", " ")}</p>
          <div className="text-sm text-gray-700 leading-7 min-h-[150px] mb-5 whitespace-pre-wrap">{current.content}</div>
          {current.images && current.images.length > 0 && (
            <div className="mb-5">
              {current.images.map((url, i) => (
                <img key={i} src={url} alt={`첨부이미지${i+1}`} className="max-w-full my-2 rounded border border-gray-200" />
              ))}
            </div>
          )}
          {current.attachments && current.attachments.length > 0 && (
            <div className="mb-5 pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">첨부파일</p>
              <ul className="space-y-1">
                {current.attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs bg-gray-50 px-2 py-1 rounded">
                    <a href={`/api/memo/download?url=${encodeURIComponent(a.url)}&name=${encodeURIComponent(a.name)}`} className="text-blue-600 hover:underline">{a.name}</a>
                    <span className="text-gray-400">{(a.size / 1024).toFixed(1)} KB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setView("list")} className="px-6 py-2 border border-gray-300 rounded text-sm">목록</button>
            <button onClick={openEdit} className="px-6 py-2 bg-emerald-600 text-white rounded text-sm">수정</button>
            <button onClick={() => handleDelete(current.id)} className="px-6 py-2 bg-red-600 text-white rounded text-sm">삭제</button>
          </div>
        </div>
      </div>
    );
  }

  // 글 목록
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <input type="text" placeholder="제목 또는 내용 검색" value={keyword} onChange={e => setKeyword(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm w-52" />
          <button className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs">검색</button>
        </div>
        <button onClick={openWrite} className="px-5 py-2 bg-emerald-600 text-white rounded text-sm font-medium">+ 메모 작성</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead><tr className="bg-[#3b4b5b] text-white">
            <th className="border border-[#2d3a47] px-2 py-2.5 w-12">번호</th><th className="border border-[#2d3a47] px-2 py-2.5">제목</th><th className="border border-[#2d3a47] px-2 py-2.5 w-24">작성자</th><th className="border border-[#2d3a47] px-2 py-2.5 w-32 whitespace-nowrap">작성일</th>
          </tr></thead>
          <tbody>
            {memos.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-gray-400">등록된 메모가 없습니다.</td></tr> :
            memos.map((m, i) => (
              <tr key={m.id} className={`${i % 2 === 1 ? "bg-gray-50" : ""} hover:bg-blue-50 cursor-pointer`} onClick={() => openView(m)}>
                <td className="border border-gray-200 px-2 py-2 text-center">{(page - 1) * 15 + i + 1}</td>
                <td className="border border-gray-200 px-2 py-2 text-left">
                  {m.title}
                  {m.images && m.images.length > 0 && <span className="ml-1 text-[10px] text-gray-500">🖼️{m.images.length}</span>}
                  {m.attachments && m.attachments.length > 0 && <span className="ml-1 text-[10px] text-gray-500">📎{m.attachments.length}</span>}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center">{m.users ? `${m.users.name}(${m.users.user_id})` : "-"}</td>
                <td className="border border-gray-200 px-2 py-2 text-center whitespace-nowrap">{m.created_at?.slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 rounded border text-xs ${p === page ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-300 text-gray-500"}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
