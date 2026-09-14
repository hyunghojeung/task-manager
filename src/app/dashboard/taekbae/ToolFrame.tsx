"use client";

import { useEffect, useRef, useState } from "react";

/** 헤더·메뉴 아래 남는 높이를 전부 차지하는 iframe */
export default function ToolFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    function fit() {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(400, window.innerHeight - top));
    }
    const id = setTimeout(fit, 0);
    window.addEventListener("resize", fit);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    // main 의 padding 을 되돌려 화면 폭 전체를 쓴다
    <div className="-m-4 md:-m-6">
      <iframe
        ref={ref}
        src={src}
        title={title}
        className="block w-full border-0 bg-white"
        style={{ height: height ? `${height}px` : "calc(100dvh - 160px)" }}
      />
    </div>
  );
}
