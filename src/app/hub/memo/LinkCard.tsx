/** 메모에 적은 주소의 미리보기 카드 — 카톡 링크 카드처럼 이미지·제목·설명·사이트 */
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
  onRemove,
}: {
  preview: LinkPreview;
  compact?: boolean;
  loading?: boolean;
  onRemove?: () => void;
}) {
  const host = preview.site || hostOf(preview.url);
  // 아직 읽어오는 중이거나, 사이트가 정보를 주지 않은 경우
  const bare = !preview.title && !preview.description && !preview.image;
  const titleText = preview.title || (loading ? "미리보기 불러오는 중…" : preview.url);

  if (compact) {
    return (
      <span className="flex items-center gap-2 border border-gray-200 rounded-md overflow-hidden bg-gray-50">
        {preview.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.image} alt="" className="w-11 h-11 object-cover shrink-0 bg-gray-200" loading="lazy" />
        )}
        <span className="min-w-0 flex flex-col py-1 px-2">
          <span className="text-[12px] font-semibold text-gray-800 truncate">{preview.title || preview.url}</span>
          <span className="text-[10.5px] text-gray-400 truncate">{host}</span>
        </span>
      </span>
    );
  }

  return (
    <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-stretch no-underline text-inherit hover:bg-gray-50"
      >
        {preview.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.image} alt="" className="w-24 md:w-28 shrink-0 object-cover bg-gray-100" loading="lazy" />
        )}
        <span className="min-w-0 flex-1 flex flex-col gap-0.5 px-3 py-2.5">
          <span className="text-[10.5px] text-gray-400 truncate">{host}</span>
          <span className={`text-[13.5px] leading-snug ${bare ? "text-gray-500 break-all line-clamp-2" : "font-bold text-gray-900 line-clamp-2"}`}>
            {titleText}
          </span>
          {preview.description && <span className="text-[12px] text-gray-500 line-clamp-2 leading-snug">{preview.description}</span>}
        </span>
      </a>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="미리보기 지우기"
          title="미리보기 지우기"
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-200 text-gray-400 text-[11px] grid place-items-center hover:text-gray-900"
        >
          ✕
        </button>
      )}
    </div>
  );
}
