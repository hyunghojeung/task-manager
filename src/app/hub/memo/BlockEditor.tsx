"use client";

import { useEffect, useRef, useState } from "react";
import LinkCard, { type LinkPreview } from "./LinkCard";
import { splitContent } from "@/lib/memo-text";

/**
 * 본문 편집기.
 * 본문(content)은 그대로 한 덩어리 글이지만, 그 안의 주소 자리에는
 * 글상자 대신 링크 카드를 보여준다. 글 → 카드 → 글 순서가 그대로 유지된다.
 */

function AutoTextarea({
  value,
  onChange,
  placeholder,
  focusRef,
  minHeight,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  focusRef?: (el: HTMLTextAreaElement | null) => void;
  minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, minHeight || 0) + "px";
  }, [value, minHeight]);
  return (
    <textarea
      ref={(el) => {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
        focusRef?.(el);
      }}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none outline-none text-base leading-relaxed placeholder:text-gray-300 bg-transparent block"
      style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}
    />
  );
}

export default function BlockEditor({
  content,
  previews,
  loadingUrls,
  onChange,
  onRemoveLink,
  placeholder,
}: {
  content: string;
  previews: LinkPreview[];
  loadingUrls: string[];
  onChange: (content: string) => void;
  onRemoveLink: (url: string) => void;
  placeholder?: string;
}) {
  const [segs, setSegs] = useState<string[]>(() => splitContent(content));
  const [seenContent, setSeenContent] = useState(content);
  const areaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const focusAfter = useRef<number | null>(null);

  // 바깥에서 본문이 바뀌면(주소 제거 등) 다시 나눈다 — 단 글자 편집 중에는 건드리지 않는다
  if (content !== seenContent) {
    setSeenContent(content);
    if (segs.join("") !== content) setSegs(splitContent(content));
  }

  // 글상자 안에 주소를 다 적고 잠시 멈추면 그 자리를 카드로 바꾼다
  useEffect(() => {
    const t = setTimeout(() => {
      const joined = segs.join("");
      const fresh = splitContent(joined);
      if (fresh.length === segs.length) return; // 새 주소 없음
      // 새로 생긴 카드 바로 뒤 글상자로 커서를 옮긴다
      let last = -1;
      fresh.forEach((_, i) => {
        if (i % 2 === 1) last = i;
      });
      focusAfter.current = last + 1;
      setSegs(fresh);
    }, 600);
    return () => clearTimeout(t);
  }, [segs]);

  useEffect(() => {
    if (focusAfter.current === null) return;
    const el = areaRefs.current[focusAfter.current];
    focusAfter.current = null;
    if (el) {
      el.focus();
      el.setSelectionRange(0, 0);
    }
  }, [segs]);

  const updateText = (i: number, v: string) => {
    const next = [...segs];
    next[i] = v;
    setSegs(next);
    onChange(next.join(""));
  };

  const removeLink = (i: number) => {
    const url = segs[i];
    const next = [...segs];
    // 카드를 빼고 앞뒤 글을 하나로 잇는다
    const merged = (next[i - 1] || "") + (next[i + 1] || "");
    next.splice(i - 1, 3, merged);
    setSegs(next);
    onChange(next.join(""));
    onRemoveLink(url);
  };

  const inContent = new Set(segs.filter((_, i) => i % 2 === 1));
  // 예전 방식으로 저장돼 본문에 주소가 없는 카드는 맨 아래에 둔다
  const orphan = previews.filter((p) => !inContent.has(p.url));
  const onlyText = segs.length === 1;

  return (
    <div className="flex flex-col gap-1.5">
      {segs.map((s, i) =>
        i % 2 === 1 ? (
          <LinkCard
            key={`u${i}-${s}`}
            preview={previews.find((p) => p.url === s) || { url: s, title: "", description: "", image: "", site: "" }}
            loading={loadingUrls.includes(s)}
            onRemove={() => removeLink(i)}
          />
        ) : (
          <AutoTextarea
            key={`t${i}`}
            value={s}
            onChange={(v) => updateText(i, v)}
            placeholder={i === 0 && onlyText ? placeholder : i === segs.length - 1 ? "" : undefined}
            focusRef={(el) => {
              areaRefs.current[i] = el;
            }}
            minHeight={onlyText ? 140 : i === segs.length - 1 ? 40 : undefined}
          />
        ),
      )}
      {orphan.map((p) => (
        <LinkCard key={`o-${p.url}`} preview={p} onRemove={() => onRemoveLink(p.url)} />
      ))}
    </div>
  );
}
