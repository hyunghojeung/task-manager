import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase-admin";
import LinkCard, { type LinkPreview } from "@/app/hub/memo/LinkCard";
import { splitContent, URL_SPLIT } from "@/lib/memo-text";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Photo {
  id: string;
  url: string;
  file_name: string | null;
}

async function loadShared(token: string) {
  if (!/^[a-z0-9]{8,32}$/.test(token)) return null;
  const supabase = getSupabase();
  const { data: memo } = await supabase
    .from("hub_memos")
    .select("id, title, content, tags, link_previews, updated_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!memo) return null;
  const { data: photos } = await supabase
    .from("hub_photos")
    .select("id, url, file_name")
    .eq("memo_id", memo.id)
    .order("sort_order")
    .order("created_at");
  return { memo, photos: (photos || []) as Photo[] };
}

// 카톡 등에 링크를 보냈을 때 뜨는 미리보기를 메모 내용으로 채운다.
// (사이트 기본값인 "Blackcopy.kr ERP" 대신 제목·본문·사진이 보이게)
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const shared = await loadShared(token);
  if (!shared) return { title: "메모를 찾을 수 없습니다", robots: { index: false, follow: false } };

  const { memo, photos } = shared;
  const previews = (Array.isArray(memo.link_previews) ? memo.link_previews : []) as LinkPreview[];
  const title = memo.title || "제목 없는 메모";
  const text = (memo.content || "").replace(URL_SPLIT, "").replace(/\s+/g, " ").trim();
  const description = text.slice(0, 120) || previews[0]?.title || "공유받은 메모";
  const image = photos[0]?.url || previews.find((p) => p.image)?.image;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "업무관리",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

/** 본문을 글과 링크 카드가 섞인 순서 그대로 보여준다 */
function Body({ content, previews }: { content: string; previews: LinkPreview[] }) {
  const segs = splitContent(content);
  const inContent = new Set(segs.filter((_, i) => i % 2 === 1));
  const orphan = previews.filter((p) => !inContent.has(p.url));
  return (
    <div className="flex flex-col gap-2">
      {segs.map((s, i) =>
        i % 2 === 1 ? (
          <LinkCard key={`u${i}`} preview={previews.find((p) => p.url === s) || { url: s, title: "", description: "", image: "", site: "" }} />
        ) : s.trim() ? (
          <p key={`t${i}`} className="text-base leading-relaxed whitespace-pre-line text-gray-800">
            {s.replace(/^\n+|\n+$/g, "")}
          </p>
        ) : null,
      )}
      {orphan.map((p) => (
        <LinkCard key={`o-${p.url}`} preview={p} />
      ))}
    </div>
  );
}

export default async function SharedMemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await loadShared(token);
  if (!shared) notFound();

  const { memo, photos } = shared;
  const body = (memo.content || "").trim();
  const previews = (Array.isArray(memo.link_previews) ? memo.link_previews : []) as LinkPreview[];
  const d = new Date(memo.updated_at);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <article className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-6 md:p-8 flex flex-col gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{memo.title || "제목 없음"}</h1>
        <p className="text-xs text-gray-400 border-b border-gray-200 pb-4 -mt-1">
          {d.getFullYear()}년 {d.getMonth() + 1}월 {d.getDate()}일 작성
          {(photos || []).length > 0 && ` · 사진 ${(photos || []).length}장`}
        </p>

        {(body || previews.length > 0) && <Body content={body} previews={previews} />}

        {(memo.tags || []).length > 0 && (
          <p className="flex flex-wrap gap-2">
            {(memo.tags as string[]).map((t) => (
              <span key={t} className="text-xs font-bold text-[#8a6d00] bg-[#FEE500]/30 rounded-full px-2.5 py-1">
                #{t}
              </span>
            ))}
          </p>
        )}

        {(photos || []).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(photos as Photo[]).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.url}
                alt={p.file_name || "첨부 사진"}
                className="w-full aspect-square object-cover rounded-lg bg-gray-100"
                loading="lazy"
              />
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-4 mt-1">
          공유받은 메모입니다. 내용을 고치거나 지울 수는 없습니다.
        </p>
      </article>
    </div>
  );
}
