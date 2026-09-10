"use client";

import { useEffect, useRef } from "react";

/**
 * 창(뷰어·편집·시트)이 열려 있는 동안 폰의 뒤로가기 버튼이
 * 페이지를 떠나지 않고 그 창만 닫도록 한다.
 *
 * close 가 false 를 돌려주면 닫기를 취소한 것으로 보고 기록을 되돌려 둔다.
 * (예: 저장하지 않고 닫겠냐는 확인창에서 취소한 경우)
 */
export function useBackToClose(open: boolean, close: () => boolean | void) {
  const ref = useRef(close);
  useEffect(() => {
    ref.current = close;
  });

  useEffect(() => {
    if (!open) return;

    const onPop = () => {
      if (ref.current() === false) window.history.pushState({ hubOverlay: true }, "");
    };

    window.history.pushState({ hubOverlay: true }, "");
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // 화면의 버튼으로 닫은 경우에는 넣어 둔 기록을 되돌려 놓는다
      if (window.history.state?.hubOverlay) window.history.back();
    };
  }, [open]);
}
