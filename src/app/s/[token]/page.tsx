import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase-admin";
import LinkCard, { type LinkPreview } from "@/app/hub/memo/LinkCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 공유 링크는 검색에 걸리지 않게 한다
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface Photo {
  id: string;
  url: string;
  file_name: string | null;
}

/** 본문 속 주소를 눌러서 열 수 있게 만든다 */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"'`]+)/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//i.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default async function SharedMemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-z0-9]{8,32}$/.test(token)) notFound();

  const supabase = getSupabase();
  const { data: memo } = await supabase
    .from("hub_memos")
    .select("id, title, content, tags, link_previews, updated_at")
    .eq("share_token", token)
    .maybeSingle();

  if (!memo) notFound();

  const { data: photos } = await supabase
    .from("hub_photos")
    .select("id, url, file_name")
    .eq("memo_id", memo.id)
    .order("sort_order")
    .order("created_at");

  const body = (memo.content || "").trim();
  const previews = (Array.isArray(memo.link_previews) ? memo.link_previews : []) as LinkPreview[];
  const d = new Date(memo.updated_at);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <article className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-6 md:p-8 flex flex-col gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{memo.title || "제목 없음"}</h1>
        <p className="text-xs text-gray-400 md:border-b md:border-gray-200 md:pb-4 md:-mt-1">
          {d.getFullYear()}년 {d.getMonth() + 1}월 {d.getDate()}일 작성
          {(photos || []).length > 0 && ` · 사진 ${(photos || []).length}장`}
        </p>

        {body && (
          <p className="text-base leading-relaxed whitespace-pre-line text-gray-800">
            <Linkify text={body} />
          </p>
        )}

        {previews.length > 0 && (
          <div className="flex flex-col gap-2">
            {previews.map((p) => (
              <LinkCard key={p.url} preview={p} />
            ))}
          </div>
        )}

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
