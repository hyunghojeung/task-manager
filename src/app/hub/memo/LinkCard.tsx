"use client";

import { useState } from "react";

/** 메모에 적은 주소의 미리보기 카드 — 카톡 링크 카드와 같은 모양 */
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  site: string;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function LinkCard({
  preview,
  compact = false,
  loading = false,
  shareToken,
  onRemove,
}: {
  preview: LinkPreview;
  compact?: boolean;
  loading?: boolean;
  /** 공유받은 화면에서 이미지를 받아올 때 쓰는 메모 공유 토큰 */
  shareToken?: string;
  onRemove?: () => void;
}) {
  // 이미지는 우리 서버가 대신 받아 준다 (다른 사이트 접근을 막는 곳도 보이게)
  // 그래도 못 불러오면 이미지 칸을 숨긴다
  const [imgBroken, setImgBroken] = useState(false);
  const image =
    preview.image && !imgBroken
      ? `/api/hub/link-image?u=${encodeURIComponent(preview.image)}${shareToken ? `&t=${encodeURIComponent(shareToken)}` : ""}`
      : "";

  const host = hostOf(preview.url);
  // 아직 읽어오는 중이거나, 사이트가 정보를 주지 않은 경우
  const bare = !preview.title && !preview.description && !preview.image;
  const titleText = preview.title || preview.description || (loading ? "미리보기 불러오는 중…" : preview.url);

  // 목록용 — 작은 가로형
  if (compact) {
    return (
      <span className="flex items-center gap-2 w-full min-w-0 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            onError={() => setImgBroken(true)}
            className="w-11 h-11 object-cover shrink-0 bg-gray-200"
            loading="lazy"
          />
        )}
        <span className="min-w-0 flex-1 flex flex-col py-1 px-2">
          <span className="text-[12px] font-semibold text-gray-800 truncate">{preview.title || preview.url}</span>
          <span className="text-[10.5px] text-gray-400 truncate">{host}</span>
        </span>
      </span>
    );
  }

  // 카톡식 — 큰 이미지 위, 제목 두 줄, 설명, 파란 주소
  return (
    <div className="relative w-full max-w-sm border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <a href={preview.url} target="_blank" rel="noopener noreferrer" className="block no-underline text-inherit hover:bg-gray-50">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            onError={() => setImgBroken(true)}
            className="w-full aspect-[1.91/1] object-cover bg-gray-100 border-b border-gray-100"
            loading="lazy"
          />
        )}
        <span className="block px-3.5 pt-3 pb-3 min-w-0">
          <span
            className={`block text-[15px] leading-snug break-words ${
              bare ? "text-gray-500 break-all line-clamp-2" : "font-bold text-gray-900 line-clamp-2"
            }`}
          >
            {titleText}
          </span>
          {preview.description && preview.title && (
            <span className="block text-[13px] text-gray-500 leading-snug line-clamp-3 mt-1.5 break-words">{preview.description}</span>
          )}
          <span className="block text-[12.5px] text-blue-600 underline underline-offset-2 truncate mt-2">{host}</span>
        </span>
      </a>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="링크 카드 지우기"
          title="링크 카드 지우기"
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/45 text-white text-[11px] grid place-items-center hover:bg-black/65"
        >
          ✕
        </button>
      )}
    </div>
  );
}
