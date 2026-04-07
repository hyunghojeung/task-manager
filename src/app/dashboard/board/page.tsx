"use client";

import React, { useState, useEffect } from "react";

type View = "list" | "write" | "view" | "edit";
interface Post { id: string; title: string; content: string; author: string; view_count: number; comment_count: number; created_at: string; comments?: Comment[]; images?: string[] }
interface Comment { id: string; post_id: string; parent_id: string | null; author: string; content: string; created_at: string }

export default function BoardPage() {
  const [view, setView] = useState<View>("list");
  const [currentUser, setCurrentUser] = useState("");

  useEffect(() => {
    // 쿠키에서 세션 정보 추출
    try {
      const cookies = document.cookie.split(";").map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith("session="));
      if (sessionCookie) {
        const decoded = decodeURIComponent(sessionCookie.split("=").slice(1).join("="));
        const session = JSON.parse(decoded);
        const userName = `${session.user?.name || ""}(${session.user?.user_id || ""})`;
        setCurrentUser(userName);
        setFormAuthor(userName);
        setCommentAuthor(userName);
      }
    } catch { /* ignore */ }
  }, []);
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [current, setCurrent] = useState<Post | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 글쓰기 폼
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);

  // 댓글 폼
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentPassword, setCommentPassword] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  // 삭제/수정 비밀번호
  const [actionPassword, setActionPassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/board?page=${page}&keyword=${keyword}&_=${Date.now()}`).then(r => r.json()).then(d => { setPosts(d.data || []); setTotal(d.total || 0); });
  }, [page, refreshKey]);

  function search() { setPage(1); setRefreshKey(k => k + 1); }

  async function loadPost(id: string) {
    const r = await fetch(`/api/board/${id}?_=${Date.now()}`);
    if (r.ok) { const d = await r.json(); setCurrent(d); setView("view"); }
  }

  async function handleSave() {
    if (!formTitle || !formAuthor || !formPassword) { alert("제목, 작성자, 비밀번호를 입력해주세요."); return; }
    if (view === "edit" && current) {
      const r = await fetch(`/api/board/${current.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: formTitle, content: formContent, password: formPassword, images: formImages }) });
      if (r.ok) { loadPost(current.id); } else { const d = await r.json(); alert(d.error); }
    } else {
      const r = await fetch("/api/board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: formTitle, content: formContent, author: formAuthor, password: formPassword, images: formImages }) });
      if (r.ok) { setView("list"); setRefreshKey(k => k + 1); resetForm(); }
    }
  }

  async function handleDelete() {
    if (!current || !actionPassword) return;
    const r = await fetch(`/api/board/${current.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: actionPassword }) });
    if (r.ok) { setView("list"); setRefreshKey(k => k + 1); setShowDeleteConfirm(false); setActionPassword(""); }
    else { const d = await r.json(); alert(d.error); }
  }

  async function handleComment() {
    if (!current || !commentAuthor || !commentPassword || !commentContent) { alert("작성자, 비밀번호, 내용을 입력해주세요."); return; }
    const r = await fetch(`/api/board/${current.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: commentAuthor, password: commentPassword, content: commentContent, parent_id: replyTo }) });
    if (r.ok) { setCommentContent(""); setReplyTo(null); loadPost(current.id); }
  }

  async function deleteComment(commentId: string) {
    const pw = prompt("댓글 비밀번호를 입력하세요:");
    if (!pw) return;
    const r = await fetch(`/api/board/comments/${commentId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok && current) loadPost(current.id);
    else { const d = await r.json(); alert(d.error); }
  }

  async function editComment(commentId: string, currentContent: string) {
    const newContent = prompt("수정할 내용을 입력하세요:", currentContent);
    if (newContent === null || newContent === currentContent) return;
    const pw = prompt("댓글 비밀번호를 입력하세요:");
    if (!pw) return;
    const r = await fetch(`/api/board/comments/${commentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw, content: newContent }) });
    if (r.ok && current) loadPost(current.id);
    else { const d = await r.json(); alert(d.error); }
  }

  async function uploadBoardImage(file: File) {
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/board/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (res.ok && d.url) {
        setFormImages(prev => [...prev, d.url]);
      } else {
        alert("이미지 업로드 실패: " + (d.error || ""));
      }
    } catch { alert("이미지 업로드 실패"); }
    finally { setImageUploading(false); }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) uploadBoardImage(file);
        return;
      }
    }
  }

  function resetForm() { setFormTitle(""); setFormContent(""); setFormAuthor(""); setFormPassword(""); setFormImages([]); }
  function openWrite() { resetForm(); setFormAuthor(currentUser); setCommentAuthor(currentUser); setView("write"); }
  function openEdit() { if (current) { setFormTitle(current.title); setFormContent(current.content); setFormAuthor(current.author); setFormPassword(""); setFormImages(current.images || []); setView("edit"); } }

  const totalPages = Math.ceil(total / 20);
  const comments = current?.comments || [];
  const topComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  // 글쓰기/수정
  if (view === "write" || view === "edit") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">{view === "edit" ? "글 수정" : "글쓰기"}</h3>
          <div className="grid gap-3 text-sm">
            <div className="flex gap-3">
              <div className="flex-1"><label className="block text-xs font-semibold text-gray-600 mb-1">작성자</label><input type="text" value={formAuthor} readOnly className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-500" /></div>
              <div className="flex-1"><label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label><input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="수정/삭제 시 필요" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" /></div>
            </div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">제목</label><input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" /></div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">내용</label>
              <textarea value={formContent} onChange={e => setFormContent(e.target.value)} onPaste={handlePaste} placeholder="내용을 입력하세요. 이미지를 붙여넣기(Ctrl+V)할 수 있습니다." className="w-full px-3 py-2 border border-gray-300 rounded text-sm min-h-[250px] resize-y" />
              <div className="mt-2 flex items-center gap-2">
                <label className="px-3 py-1 bg-gray-600 text-white rounded text-xs cursor-pointer hover:bg-gray-700">
                  이미지 첨부
                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadBoardImage(e.target.files[0]); e.target.value = ""; }} />
                </label>
                {imageUploading && <span className="text-xs text-gray-400">업로드 중...</span>}
                <span className="text-[10px] text-gray-400">Ctrl+V로 캡처 이미지 붙여넣기 가능</span>
              </div>
              {formImages.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formImages.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt={`첨부${i+1}`} className="w-24 h-24 object-cover rounded border border-gray-300" />
                      <button type="button" onClick={() => setFormImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs leading-4 text-center opacity-0 group-hover:opacity-100 transition">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded text-sm">저장</button>
            <button onClick={() => { if (current && view === "edit") setView("view"); else setView("list"); }} className="px-6 py-2 border border-gray-300 rounded text-sm">취소</button>
          </div>
        </div>
      </div>
    );
  }

  // 글 상세
  if (view === "view" && current) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2">{current.title}</h3>
          <div className="flex gap-4 text-xs text-gray-400 mb-4 pb-3 border-b border-gray-200">
            <span>작성자: {current.author}</span>
            <span>작성일: {current.created_at?.slice(0, 10)}</span>
            <span>조회: {current.view_count}</span>
          </div>
          <div className="text-sm text-gray-700 leading-7 whitespace-pre-wrap min-h-[100px] mb-5">{current.content}</div>
          {current.images && current.images.length > 0 && (
            <div className="mb-5 space-y-2">
              {current.images.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`첨부이미지${i+1}`} className="max-w-full md:max-w-lg rounded border border-gray-300 shadow-sm hover:shadow-md transition" />
                </a>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <button onClick={() => setView("list")} className="px-5 py-2 border border-gray-300 rounded text-sm">목록</button>
            <button onClick={() => { setActionPassword(""); setShowDeleteConfirm(false); openEdit(); }} className="px-5 py-2 bg-indigo-600 text-white rounded text-sm">수정</button>
            <button onClick={() => setShowDeleteConfirm(true)} className="px-5 py-2 bg-red-600 text-white rounded text-sm">삭제</button>
          </div>
          {showDeleteConfirm && (
            <div className="mt-3 flex gap-2 items-center bg-red-50 p-3 rounded">
              <input type="password" placeholder="비밀번호 입력" value={actionPassword} onChange={e => setActionPassword(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-40" />
              <button onClick={handleDelete} className="px-4 py-1.5 bg-red-600 text-white rounded text-xs">확인</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-1.5 border border-gray-300 rounded text-xs">취소</button>
            </div>
          )}
        </div>

        {/* 댓글 영역 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-bold text-gray-800 mb-3">댓글 ({comments.length})</h4>
          {topComments.map(c => (
            <div key={c.id} className="mb-3">
              <div className="bg-gray-50 rounded p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-gray-700">{c.author}</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400">{c.created_at?.slice(0, 10)}</span>
                    <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-xs text-blue-500">답글</button>
                    <button onClick={() => editComment(c.id, c.content)} className="text-xs text-emerald-500">수정</button>
                    <button onClick={() => deleteComment(c.id)} className="text-xs text-red-500">삭제</button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
              {/* 대댓글 */}
              {getReplies(c.id).map(r => (
                <div key={r.id} className="ml-8 mt-2 bg-blue-50 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-700">↳ {r.author}</span>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-gray-400">{r.created_at?.slice(0, 10)}</span>
                      <button onClick={() => editComment(r.id, r.content)} className="text-xs text-emerald-500">수정</button>
                      <button onClick={() => deleteComment(r.id)} className="text-xs text-red-500">삭제</button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
                </div>
              ))}
              {/* 답글 입력 */}
              {replyTo === c.id && (
                <div className="ml-8 mt-2 flex gap-2 items-start">
                  <input type="text" value={commentAuthor} readOnly className="px-2 py-1.5 border border-gray-200 rounded text-xs w-20 bg-gray-50 text-gray-500" />
                  <input type="password" placeholder="비번" value={commentPassword} onChange={e => setCommentPassword(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs w-20" />
                  <input type="text" placeholder="답글 내용" value={commentContent} onChange={e => setCommentContent(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs" />
                  <button onClick={handleComment} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs whitespace-nowrap">등록</button>
                </div>
              )}
            </div>
          ))}

          {/* 댓글 작성 */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex gap-2 items-start">
              <input type="text" value={commentAuthor} readOnly className="px-2 py-1.5 border border-gray-200 rounded text-sm w-28 bg-gray-50 text-gray-500" />
              <input type="password" placeholder="비밀번호" value={commentPassword} onChange={e => setCommentPassword(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-24" />
              <input type="text" placeholder="댓글 내용을 입력하세요" value={commentContent} onChange={e => setCommentContent(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setReplyTo(null); handleComment(); }}} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
              <button onClick={() => { setReplyTo(null); handleComment(); }} className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm whitespace-nowrap">댓글 등록</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 리스트
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <input type="text" placeholder="제목 또는 내용 검색" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") search(); }} className="px-3 py-1.5 border border-gray-300 rounded text-sm w-52" />
          <button onClick={search} className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs">검색</button>
        </div>
        <button onClick={openWrite} className="px-5 py-2 bg-indigo-600 text-white rounded text-sm font-medium">+ 글쓰기</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead><tr className="bg-[#3b4b5b] text-white">
            <th className="border border-[#2d3a47] px-2 py-2.5 w-12">번호</th>
            <th className="border border-[#2d3a47] px-2 py-2.5">제목</th>
            <th className="border border-[#2d3a47] px-2 py-2.5 w-20">작성자</th>
            <th className="border border-[#2d3a47] px-2 py-2.5 w-24">작성일</th>
            <th className="border border-[#2d3a47] px-2 py-2.5 w-14">조회</th>
          </tr></thead>
          <tbody>
            {posts.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">등록된 게시글이 없습니다.</td></tr> :
            posts.map((p, i) => (
              <React.Fragment key={p.id}>
              <tr className={`${i % 2 === 1 ? "bg-gray-50" : ""} hover:bg-blue-50 cursor-pointer`} onClick={() => loadPost(p.id)}>
                <td className="border border-gray-200 px-2 py-2 text-center">{(page - 1) * 20 + i + 1}</td>
                <td className="border border-gray-200 px-2 py-2 text-left font-semibold">
                  {p.title}
                  {p.comment_count > 0 && <span className="text-blue-500 ml-1 text-xs">[{p.comment_count}]</span>}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center">{p.author}</td>
                <td className="border border-gray-200 px-2 py-2 text-center">{p.created_at?.slice(0, 10)}</td>
                <td className="border border-gray-200 px-2 py-2 text-center">{p.view_count}</td>
              </tr>
              {(p.comments || []).map((c: {id:string;author:string;content:string;created_at:string}) => (
                <tr key={c.id} className="bg-gray-50/70">
                  <td className="border border-gray-100 px-2 py-1.5 text-center text-gray-400">↳</td>
                  <td className="border border-gray-100 px-2 py-1.5 text-left text-gray-600 pl-6">{c.content?.slice(0, 80)}</td>
                  <td className="border border-gray-100 px-2 py-1.5 text-center text-gray-500">{c.author}</td>
                  <td className="border border-gray-100 px-2 py-1.5 text-center text-gray-400">{c.created_at?.slice(0, 10)}</td>
                  <td className="border border-gray-100 px-2 py-1.5"></td>
                </tr>
              ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 rounded border text-xs ${p === page ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-500"}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
