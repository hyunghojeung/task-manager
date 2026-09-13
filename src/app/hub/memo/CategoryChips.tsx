"use client";

import { useRef } from "react";

export interface Category {
  id: string;
  name: string;
  count: number;
}

/**
 * 카테고리 칩 한 줄.
 * - 누르면 선택
 * - 길게 누르면(0.6초) 이름 바꾸기·삭제
 * - 맨 뒤 "+ 추가"
 */
export default function CategoryChips({
  categories,
  value,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  allLabel,
  allCount,
  noneLabel,
  noneCount,
  showNone = true,
}: {
  categories: Category[];
  /** 선택값: "all" | "none" | 카테고리 id */
  value: string;
  onSelect: (v: string) => void;
  onAdd: () => void;
  onRename: (c: Category) => void;
  onDelete: (c: Category) => void;
  allLabel?: string;
  allCount?: number;
  noneLabel?: string;
  noneCount?: number;
  showNone?: boolean;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  function startPress(c: Category) {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (navigator.vibrate) navigator.vibrate(15);
      const action = window.prompt(`"${c.name}" 카테고리\n\n새 이름을 적으면 바꾸고, 비워서 확인하면 삭제합니다.\n(삭제해도 메모는 지워지지 않고 미분류가 됩니다)`, c.name);
      if (action === null) return;
      const name = action.trim();
      if (!name) {
        if (confirm(`"${c.name}" 카테고리를 삭제할까요?\n안의 메모 ${c.count}개는 미분류로 옮겨집니다.`)) onDelete(c);
      } else if (name !== c.name) onRename({ ...c, name });
    }, 600);
  }
  function endPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  const chip = (active: boolean) =>
    `shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap select-none ${
      active ? "bg-[#FEE500] text-[#191919] font-bold" : "bg-white text-gray-600 border border-gray-300"
    }`;

  return (
    <div className="flex gap-1.5 overflow-x-auto py-0.5 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {allLabel && (
        <button onClick={() => onSelect("all")} className={chip(value === "all")}>
          {allLabel}
          {typeof allCount === "number" && <span className="opacity-60 ml-1">{allCount}</span>}
        </button>
      )}
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            onSelect(c.id);
          }}
          onPointerDown={() => startPress(c)}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(e) => e.preventDefault()}
          className={chip(value === c.id)}
          title="길게 누르면 이름 바꾸기·삭제"
        >
          {c.name}
          <span className="opacity-60 ml-1">{c.count}</span>
        </button>
      ))}
      {showNone && (
        <button onClick={() => onSelect("none")} className={chip(value === "none")}>
          {noneLabel || "미분류"}
          {typeof noneCount === "number" && <span className="opacity-60 ml-1">{noneCount}</span>}
        </button>
      )}
      <button
        onClick={onAdd}
        className="shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border border-dashed border-gray-400 text-gray-500"
      >
        + 추가
      </button>
    </div>
  );
}
